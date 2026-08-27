#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sadeed API — FastAPI.

خادمان يُشغَّلان مرّة واحدة عند الإقلاع ويبقيان حيّين:

    التضمين  bge-m3      ~0.9GB  منفذ 8081  بحث القانون وتضمين البنود
    التوليد  Qwen3.5-4B  ~4.4GB  منفذ 8080  التدقيق والمحادثة معاً

خادم التوليد يعمل بمَسلكين (‎-np 2‎): نسخة واحدة من النموذج في الذاكرة،
وذاكرة برومبت مؤقتة مستقلّة لكل مَسلك — فلا يُبطل التدقيق بادئة المحادثة
ولا العكس. (كان يُحمَّل مرّتين على منفذين فيلتهم 8.8 جيجا ويترك 0.2 حرّة.)

جُرّب نموذج 2B أصغر للمحادثة ورُفض بالقياس — انظر rag/llama.py.

**ما لا يمرّ بالنموذج إطلاقاً:** التحيّات وأسئلة حالة الجلسة. جوابها معروف
سلفاً من بيانات عندنا، فيُبنى مباشرةً — فوريّ ودقيق بدل ~8 ثوانٍ وتخمين.

المجموع ~5.3 جيجا. أغلق المتصفّح وما سواه قبل العرض، أو شغّل `run.ps1 -Demo`.

    uvicorn api.main:app --port 8000
"""

import json
import os
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "rag"))
sys.path.insert(0, os.path.join(ROOT, "agent"))
sys.path.insert(0, os.path.join(ROOT, "api"))

from llama import (embedding_server, llm_server,     # noqa: E402
                   chat_server, chat_model_name)
from retriever import Retriever                     # noqa: E402
from router import LawRouter                        # noqa: E402
from extract import extract, ExtractionError        # noqa: E402
from parser import parse_clauses                    # noqa: E402
from validator import validate_clause, SYSTEM       # noqa: E402
from guard import apply_guard                       # noqa: E402
import chat as chatmod                              # noqa: E402
from greetings import (canned_reply, is_session,     # noqa: E402
                       session_reply)
from scorer import score_contract                   # noqa: E402
import store                                        # noqa: E402

UPLOAD_DIR = os.path.join(ROOT, "uploads")
TOP_K = int(os.environ.get("LAWMIND_TOP_K", "2"))
MAX_UPLOAD_MB = 10

app = FastAPI(title="Sadeed API", version="0.1.0")

# أصول CORS المسموحة — من البيئة ليُضاف نطاق Vercel عند النشر.
#   SADEED_CORS_ORIGINS="https://your-app.vercel.app,http://localhost:3000"
# أو "*" للسماح للجميع (للعرض فقط). نستخدم رمز الجلسة من localStorage لا
# الكوكيز، فالسماح للجميع لا يتطلّب allow_credentials.
_origins = [o.strip() for o in os.environ.get(
    "SADEED_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
_allow_all = "*" in _origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _origins,
    allow_credentials=not _allow_all,
    allow_methods=["*"], allow_headers=["*"],
)

STATE = {"retriever": None, "embed": None, "llm": None,
         "chat": None, "art_vecs": None, "router": None}
POOL = ThreadPoolExecutor(max_workers=2)
JOBS = {}          # aid -> {stage, clause_count, clauses, report, error} (سبر)


# ── دورة الحياة ────────────────────────────────────────────────────────────
@app.on_event("startup")
def _startup():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    store.init()
    r = Retriever()
    STATE["retriever"] = r
    STATE["art_vecs"] = {a["article_no"]: r.vectors[i]
                         for i, a in enumerate(r.articles)}
    # مراكز ثقل القوانين تُحسب مرّة واحدة — ثابتة ما دام الكوربوس ثابتاً
    STATE["router"] = LawRouter(r.articles, r.vectors)
    e = embedding_server(ctx=4096)
    e.start()
    STATE["embed"] = e
    # خادم توليد واحد بمَسلكين (‎-np 2‎): التدقيق والمحادثة يتشاركان نسخة
    # واحدة من النموذج في الذاكرة، ولكلٍّ ذاكرة برومبت مؤقتة مستقلّة.
    # (كان يُحمَّل مرّتين فيلتهم 8.8 جيجا ويترك 0.2 جيجا حرّة.)
    # ctx والمَسالك من البيئة — على VPS ضعيف نخفّضهما (LAWMIND_NP=1،
    # LAWMIND_CTX=4096) لتوفير الذاكرة وتسريع المعالجة المسبقة.
    l = llm_server(ctx=int(os.environ.get("LAWMIND_CTX", "8192")),
                   parallel=int(os.environ.get("LAWMIND_NP", "2")))
    l.start()
    STATE["llm"] = STATE["chat"] = l
    print("سديد: جاهز — نموذج توليد واحد بمَسلكين + خادم تضمين")


@app.on_event("shutdown")
def _shutdown():
    for srv in {id(STATE[k]): STATE[k] for k in ("embed", "llm", "chat")
                if STATE.get(k)}.values():
        srv.stop()


# ── نماذج البيانات ─────────────────────────────────────────────────────────
class ApproveBody(BaseModel):
    approved_by: str


class SuggestBody(BaseModel):
    clause_id: str


class RevisionBody(BaseModel):
    clause_id: str
    status: str          # accepted | rejected | pending


class ClientBody(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    notes: str | None = None


class AssignBody(BaseModel):
    client_id: str | None = None


class OfficeBody(BaseModel):
    office_name: str | None = None
    lawyer_name: str | None = None
    license_no: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    logo: str | None = None          # data URL أو فارغ


class PricingItem(BaseModel):
    contract_type: str
    price: float = 0


class PricingBody(BaseModel):
    items: list[PricingItem]


class FeeBody(BaseModel):
    contract_type: str
    fee: float


class InvoiceBody(BaseModel):
    analysis_id: str
    amount: float | None = None      # يتجاوز أتعاب التحليل إن أُرسل


class InvoiceStatusBody(BaseModel):
    status: str                       # issued | paid


class SignupBody(BaseModel):
    username: str
    name: str
    password: str


class LoginBody(BaseModel):
    username: str
    password: str


class DeadlineBody(BaseModel):
    title: str
    due_date: str
    client_id: str | None = None
    analysis_id: str | None = None
    note: str | None = None


class DeadlineDoneBody(BaseModel):
    done: bool


class ConsultationBody(BaseModel):
    question: str
    answer: str
    articles: list[dict] = []


class SaveClauseBody(BaseModel):
    heading: str | None = None
    text: str
    verdict: str | None = None
    law_name: str | None = None
    article_no: int | None = None
    source_analysis_id: str | None = None
    source_filename: str | None = None
    note: str | None = None


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatBody(BaseModel):
    message: str
    history: list[ChatTurn] = []


# ── المصادقة (A2) ──────────────────────────────────────────────────────────
@app.get("/auth/state")
def auth_state():
    """هل يوجد مستخدم مسجَّل؟ — تحدّد الواجهةُ بين «إنشاء أول حساب» و«دخول»."""
    return {"has_users": store.user_count() > 0}


@app.post("/auth/signup")
def auth_signup(body: SignupBody):
    if not (body.username or "").strip() or not (body.name or "").strip():
        raise HTTPException(400, "الاسم واسم المستخدم مطلوبان")
    if len(body.password or "") < 6:
        raise HTTPException(400, "كلمة المرور ستّة أحرف على الأقلّ")
    user = store.create_user(body.username, body.name, body.password)
    if not user:
        raise HTTPException(409, "اسم المستخدم مُستخدَم")
    token = store.new_session(user["id"])
    return {"token": token, "user": user}


@app.post("/auth/login")
def auth_login(body: LoginBody):
    user = store.verify_user(body.username, body.password)
    if not user:
        raise HTTPException(401, "اسم المستخدم أو كلمة المرور غير صحيحة")
    token = store.new_session(user["id"])
    return {"token": token, "user": user}


@app.get("/auth/me")
def auth_me(token: str = ""):
    user = store.user_for_token(token)
    if not user:
        raise HTTPException(401, "جلسة غير صالحة")
    return {"user": user}


@app.post("/auth/logout")
def auth_logout(token: str = ""):
    store.end_session(token)
    return {"ok": True}


# ── الصحّة ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    r = STATE["retriever"]
    return {
        "status": "ok",
        "laws": r.corpus.get("laws", []),
        "law_count": len(r.corpus.get("laws", [])),
        "article_count": r.corpus.get("article_count", len(r.articles)),
        "top_k": TOP_K,
        "models": {"audit": os.path.basename(
                       __import__("llama").LLM_MODEL),
                   "chat": chat_model_name()},
    }


# ── البحث في القانون ───────────────────────────────────────────────────────
@app.get("/law/search")
def law_search(q: str, k: int = 5):
    """بحث هجين في مواد القانون — نفس المسترجِع الذي يغذّي الوكيل."""
    if not q.strip():
        raise HTTPException(400, "استعلام فارغ")
    t0 = time.perf_counter()
    vec = STATE["embed"].embed(q)[0]
    weights = STATE["router"].weights(q, vec)
    hits = STATE["retriever"].search(q, vec, k=k, debug=True,
                                     law_weights=weights)
    return {
        "query": q,
        "count": len(hits),
        "ms": round((time.perf_counter() - t0) * 1000),
        "results": hits,
    }


@app.get("/law/articles/{no}")
def law_article(no: int):
    a = STATE["retriever"].by_no.get(no)
    if not a:
        raise HTTPException(404, f"لا توجد مادة برقم {no}")
    return a


@app.get("/law/articles")
def law_articles(book: str | None = None):
    arts = STATE["retriever"].articles
    if book:
        arts = [a for a in arts if a.get("book") == book]
    return {"count": len(arts),
            "articles": [{"article_no": a["article_no"], "book": a.get("book"),
                          "chapter": a.get("chapter"),
                          "preview": a["text"][:120]} for a in arts]}


# ── رفع العقد ──────────────────────────────────────────────────────────────
@app.post("/contracts/upload")
async def upload(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".pdf", ".docx", ".doc", ".txt"):
        raise HTTPException(400, "يُقبل PDF أو Word فقط")
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"الحد الأقصى {MAX_UPLOAD_MB} ميجابايت")

    cid = uuid.uuid4().hex[:12]
    path = os.path.join(UPLOAD_DIR, f"{cid}{ext}")
    with open(path, "wb") as f:
        f.write(data)

    try:
        text = extract(path)
        clauses = parse_clauses(text)
    except ExtractionError as e:
        os.remove(path)
        raise HTTPException(422, str(e))
    if not clauses:
        os.remove(path)
        raise HTTPException(422, "لم أتمكّن من تمييز أي بند في هذا الملف.")

    store.save_contract(cid, file.filename, path, len(text), len(clauses))
    return {"contract_id": cid, "filename": file.filename,
            "chars": len(text), "clause_count": len(clauses), "status": "ready"}


# ── التحليل ────────────────────────────────────────────────────────────────
def _run_analysis(cid, aid):
    """يعمل في خيط منفصل؛ يسجّل التقدّم في JOBS[aid] ليُسبَر دورياً.

    استُبدل البثّ (SSE) بالسبر (polling): نفق Cloudflare المجانيّ يُخزّن البثّ
    المفتوح ويقطعه بعد ~100ث، والتحليل على VPS ضعيف يتجاوزها. السبر يعتمد
    طلبات قصيرة تعبر أيّ نفق، ونحفظ لقطة التقدّم هنا ليقرأها /progress.
    """
    job = JOBS[aid]
    try:
        c = store.get_contract(cid)
        text = extract(c["path"])
        clauses = parse_clauses(text)
        job["clause_count"] = len(clauses)
        job["stage"] = "parsed"

        r, embed, llm = STATE["retriever"], STATE["embed"], STATE["llm"]
        vecs = embed.embed([cl["text"] for cl in clauses])
        # ترجيح القوانين يُشتقّ من العقد كاملاً مرّة واحدة, لا لكل بند
        contract_vec = embed.embed(text[:4000])[0]
        router = STATE["router"]
        routing = router.explain(text, contract_vec)
        job["stage"] = "retrieved"

        results = []
        guard_log = []
        for i, (cl, qv) in enumerate(zip(clauses, vecs)):
            hits = r.search(
                cl["text"], qv, k=TOP_K,
                law_weights=router.blended_weights(text, contract_vec,
                                                   cl["text"], qv))
            t0 = time.perf_counter()
            parsed, _ = validate_clause(llm, cl["text"], hits)
            g = apply_guard(parsed, hits, clause_vec=qv,
                            article_vecs=STATE["art_vecs"])
            cited = [h for h in hits if h["article_no"] in g.article_numbers]
            row = {
                "clause_id": cl["clause_id"],
                "heading": cl.get("heading", ""),
                "text": cl["text"],
                "verdict": g.verdict, "reasoning": g.reasoning,
                "confidence": round(g.confidence, 2),
                "needs_review": g.needs_review,
                "citations": [{"law_id": h["law_id"],
                               "law_name": h["law_name"],
                               "decree_no": h.get("decree_no"),
                               "article_no": h["article_no"],
                               "article_text": h["text"],
                               "book": h.get("book"),
                               "chapter": h.get("chapter")} for h in cited],
                "considered": [{"law_name": h["law_name"],
                                "article_no": h["article_no"]} for h in hits],
                "suggested_text": None,
                "seconds": round(time.perf_counter() - t0, 1),
            }
            results.append(row)
            if g.log:
                guard_log.append({"clause_id": cl["clause_id"],
                                  "entries": g.log})
            # لقطة التقدّم: البنود المكتملة حتى الآن (نسخة ليقرأها السابر بأمان)
            job["clauses"] = list(results)
            job["stage"] = "clause"

        summary = {"مخالف": 0, "ناقص": 0, "سليم": 0, "لا مادة ذات صلة": 0}
        for x in results:
            summary[x["verdict"]] += 1
        report = {
            "analysis_id": aid, "contract_id": cid,
            "filename": c["filename"],
            "laws": r.corpus.get("laws", []),
            "article_count": r.corpus.get("article_count", len(r.articles)),
            "routing": routing,
            "clause_count": len(results), "summary": summary,
            "score": score_contract(results, full_text=text),
            "clauses": results, "guard_log": guard_log,
            "top_k": TOP_K, "status": "done",
            "approved_by": None, "approved_at": None,
        }
        store.save_analysis(aid, cid, report)
        # A4 — تصنيف تلقائيّ لنوع العقد وملء أتعابه من قائمة الأسعار.
        # النوع من موجّه النطاق (القانون الأساسيّ)، والسعر من قائمة المحامي.
        # كلاهما قابل للتعديل لاحقاً من لوحة الأتعاب. لا نُفوتر تلقائياً.
        ctype = store.suggest_type(report)
        price = store.price_for_type(ctype)
        if price is not None:
            store.set_fee(aid, ctype, price)
            report["contract_type"] = ctype
            report["fee"] = price
        job["report"] = report
        job["stage"] = "done"
    except Exception as e:                       # noqa: BLE001
        job["error"] = str(e)
        job["stage"] = "error"


@app.post("/contracts/{cid}/analyze")
def analyze(cid: str):
    if not store.get_contract(cid):
        raise HTTPException(404, "عقد غير موجود")
    aid = uuid.uuid4().hex[:12]
    # لقطة التقدّم — يقرؤها /progress بالسبر الدوريّ. لا طابور ولا حلقة
    # غير متزامنة: التحليل يعمل في الخيط، والواجهة تسأل «أين وصلت؟» كل ثانية.
    JOBS[aid] = {"stage": "queued", "clause_count": None,
                 "clauses": [], "report": None, "error": None}
    POOL.submit(_run_analysis, cid, aid)
    return {"analysis_id": aid, "status": "processing"}


@app.get("/analyses/{aid}/progress")
def analysis_progress(aid: str):
    """لقطة تقدّم التحليل — طلب قصير يعبر النفق (بديل SSE الذي يُخزَّن ويُقطَع).

    إن لم تعد اللقطة في الذاكرة (أعيد تشغيل الخادم) نرجع التحليل المحفوظ من
    القاعدة مكتملاً — فلا يتجمّد العرض.
    """
    job = JOBS.get(aid)
    if job is None:
        rep = store.get_analysis(aid)
        if rep:
            return {"stage": "done", "clause_count": rep.get("clause_count"),
                    "clauses": rep.get("clauses", []), "report": rep,
                    "error": None}
        raise HTTPException(404, "تحليل غير موجود")
    return {"stage": job["stage"], "clause_count": job["clause_count"],
            "clauses": job["clauses"], "report": job["report"],
            "error": job["error"]}


@app.get("/analyses/{aid}")
def get_analysis(aid: str):
    rep = store.get_analysis(aid)
    if not rep:
        raise HTTPException(404, "تحليل غير موجود")
    return rep


@app.get("/analyses")
def list_analyses():
    return {"analyses": store.list_analyses()}


@app.post("/analyses/{aid}/approve")
def approve(aid: str, body: ApproveBody):
    rep = store.get_analysis(aid)
    if not rep:
        raise HTTPException(404, "تحليل غير موجود")
    stamp = store.approve(aid, body.approved_by)
    return {"approved_by": body.approved_by, "approved_at": stamp}


# ── طابور المراجعة (B7) ────────────────────────────────────────────────────
@app.get("/review/queue")
def review_queue():
    """البنود التي تحتاج انتباه المحامي عبر كل التحاليل — مُعلّمة أو منخفضة الثقة."""
    return {"items": store.review_queue()}


# ── متابعة المهل (B4) ──────────────────────────────────────────────────────
@app.get("/deadlines")
def deadlines_list():
    return {"items": store.list_deadlines()}


@app.post("/deadlines")
def deadline_create(body: DeadlineBody):
    if not (body.title or "").strip() or not (body.due_date or "").strip():
        raise HTTPException(400, "العنوان والتاريخ مطلوبان")
    did = store.create_deadline(body.model_dump())
    return {"id": did}


@app.post("/deadlines/{did}/done")
def deadline_done(did: str, body: DeadlineDoneBody):
    store.set_deadline_done(did, body.done)
    return {"id": did, "done": body.done}


@app.delete("/deadlines/{did}")
def deadline_delete(did: str):
    store.delete_deadline(did)
    return {"deleted": did}


# ── سجلّ الاستشارات (B8) ───────────────────────────────────────────────────
@app.get("/consultations")
def consultations_list():
    return {"items": store.list_consultations()}


@app.post("/consultations")
def consultation_save(body: ConsultationBody):
    if not (body.question or "").strip() or not (body.answer or "").strip():
        raise HTTPException(400, "السؤال والجواب مطلوبان")
    cid = store.save_consultation(body.question, body.answer, body.articles)
    return {"id": cid}


@app.delete("/consultations/{cid}")
def consultation_delete(cid: str):
    store.delete_consultation(cid)
    return {"deleted": cid}


# ── البحث والمكتبة (B6) ────────────────────────────────────────────────────
@app.get("/search/clauses")
def search_clauses(q: str):
    """بحث نصّيّ في بنود كل العقود المحلَّلة."""
    return {"query": q, "results": store.search_clauses(q)}


@app.get("/library")
def library_list():
    return {"items": store.list_saved_clauses()}


@app.post("/library")
def library_add(body: SaveClauseBody):
    if not (body.text or "").strip():
        raise HTTPException(400, "نصّ البند مطلوب")
    sid = store.save_clause(body.model_dump())
    return {"id": sid}


@app.delete("/library/{sid}")
def library_delete(sid: str):
    store.delete_saved_clause(sid)
    return {"deleted": sid}


# ── العملاء (B3) ───────────────────────────────────────────────────────────
@app.get("/clients")
def clients_list():
    return {"clients": store.list_clients()}


@app.post("/clients")
def client_create(body: ClientBody):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(400, "اسم العميل مطلوب")
    cid = uuid.uuid4().hex[:12]
    store.save_client(cid, name, body.phone, body.email, body.notes)
    return {"id": cid, **store.get_client(cid)}


@app.get("/clients/{cid}")
def client_get(cid: str):
    cl = store.get_client(cid)
    if not cl:
        raise HTTPException(404, "عميل غير موجود")
    return {**cl, "analyses": store.analyses_for_client(cid)}


@app.put("/clients/{cid}")
def client_update(cid: str, body: ClientBody):
    if not store.get_client(cid):
        raise HTTPException(404, "عميل غير موجود")
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(400, "اسم العميل مطلوب")
    store.save_client(cid, name, body.phone, body.email, body.notes)
    return store.get_client(cid)


@app.delete("/clients/{cid}")
def client_delete(cid: str):
    if not store.get_client(cid):
        raise HTTPException(404, "عميل غير موجود")
    store.delete_client(cid)
    return {"deleted": cid}


@app.post("/contracts/{contract_id}/client")
def contract_assign_client(contract_id: str, body: AssignBody):
    if not store.get_contract(contract_id):
        raise HTTPException(404, "عقد غير موجود")
    if body.client_id and not store.get_client(body.client_id):
        raise HTTPException(404, "عميل غير موجود")
    store.assign_contract_client(contract_id, body.client_id)
    return {"contract_id": contract_id, "client_id": body.client_id}


# ── هوية المكتب (B5) ───────────────────────────────────────────────────────
@app.get("/office")
def office_get():
    return store.get_office()


@app.put("/office")
def office_put(body: OfficeBody):
    return store.save_office(body.model_dump())


# ── الأسعار والأتعاب (B2) ──────────────────────────────────────────────────
@app.get("/pricing")
def pricing_get():
    return {"items": store.get_pricing()}


@app.put("/pricing")
def pricing_put(body: PricingBody):
    return {"items": store.save_pricing([i.model_dump() for i in body.items])}


@app.post("/analyses/{aid}/fee")
def analysis_fee(aid: str, body: FeeBody):
    if not store.get_analysis(aid):
        raise HTTPException(404, "تحليل غير موجود")
    store.set_fee(aid, body.contract_type, body.fee)
    return {"analysis_id": aid, "contract_type": body.contract_type,
            "fee": body.fee}


# ── الفواتير والإيرادات (B2) ───────────────────────────────────────────────
@app.get("/invoices")
def invoices_list():
    return {"invoices": store.list_invoices()}


@app.post("/invoices")
def invoice_create(body: InvoiceBody):
    rep = store.get_analysis(body.analysis_id)
    if not rep:
        raise HTTPException(404, "تحليل غير موجود")
    amount = body.amount if body.amount is not None else rep.get("fee")
    if amount is None:
        raise HTTPException(400, "لا أتعاب محدّدة لهذا العقد — حدّدها أولاً")
    inv = store.create_invoice(rep.get("client_id"), body.analysis_id, amount)
    return inv


@app.get("/invoices/{iid}")
def invoice_get(iid: str):
    inv = store.get_invoice(iid)
    if not inv:
        raise HTTPException(404, "فاتورة غير موجودة")
    return inv


@app.post("/invoices/{iid}/status")
def invoice_status(iid: str, body: InvoiceStatusBody):
    if body.status not in ("issued", "paid"):
        raise HTTPException(400, "حالة غير صالحة")
    if not store.get_invoice(iid):
        raise HTTPException(404, "فاتورة غير موجودة")
    store.set_invoice_status(iid, body.status)
    return {"id": iid, "status": body.status}


@app.get("/revenue")
def revenue():
    return store.revenue_summary()


# ── حالة تعديل البند (B1) ──────────────────────────────────────────────────
@app.post("/analyses/{aid}/revision")
def revision(aid: str, body: RevisionBody):
    if body.status not in ("accepted", "rejected", "pending"):
        raise HTTPException(400, "حالة غير صالحة")
    if not store.get_analysis(aid):
        raise HTTPException(404, "تحليل غير موجود")
    res = store.set_revision(aid, body.clause_id, body.status)
    if res is None:
        raise HTTPException(404, "بند غير موجود")
    return {"clause_id": body.clause_id, "status": res}


# ── الصياغة البديلة عند الطلب ──────────────────────────────────────────────
SUGGEST_SYSTEM = """أنت صائغ عقود قانوني في سلطنة عمان.
يُعطى إليك بند مخالف أو ناقص، ونصّ المادة القانونية التي خالفها.
مهمّتك: إعادة صياغة البند ليتوافق مع المادة.

قواعد ملزمة:
1. التزم بما تنصّ عليه المادة المعطاة فقط. لا تضف أحكاماً من عندك.
2. حافظ على غرض البند الأصلي وأسلوب العقود.
3. أعد نصّ البند البديل فقط، بلا مقدّمات ولا شرح.
4. اكتب بالعربية الفصحى القانونية."""


@app.post("/analyses/{aid}/suggest")
def suggest(aid: str, body: SuggestBody):
    rep = store.get_analysis(aid)
    if not rep:
        raise HTTPException(404, "تحليل غير موجود")
    clause = next((c for c in rep["clauses"]
                   if c["clause_id"] == body.clause_id), None)
    if not clause:
        raise HTTPException(404, "بند غير موجود")
    if not clause["citations"]:
        raise HTTPException(400, "لا توجد مادة يُستند إليها في الصياغة")

    arts = "\n".join(f"[المادة {c['article_no']}] {c['article_text']}"
                     for c in clause["citations"])
    user = (f"### المادة القانونية\n{arts}\n\n"
            f"### البند المخالف\n«{clause['text']}»\n\n"
            f"### سبب المخالفة\n{clause['reasoning']}\n\n"
            f"اكتب البند البديل المتوافق:")
    text, _ = STATE["llm"].chat(SUGGEST_SYSTEM, user, max_tokens=400,
                                temperature=0.2)
    text = text.strip().strip('"«»')
    store.set_suggestion(aid, body.clause_id, text)
    return {"clause_id": body.clause_id, "suggested_text": text}


# ── المساعد القانونيّ العام (A3) ───────────────────────────────────────────
# بلا عقد: يجيب أسئلة قانونية عامّة من مواد القوانين السبعة المسترجَعة.
# استرجاع أوسع من التدقيق — السؤال العام يستفيد من مواد أكثر.
#
# **لا نطبّق موجّه النطاق هنا.** الموجّه يرجّح القوانين بحسب نوع العقد،
# وهو مضبوط لوثيقة كاملة لا لسؤال محادثيّ. قياس فعليّ: «موكّلي تعرّض لسرقة»
# رجّحه الموجّه نحو التجارة/المدنيّ (بسبب «موكّل»، «تعرّض») فأقصى مواد
# السرقة في الجزاء. بترجيح متساوٍ تصعد المادة الصحيحة. فالبحث هنا محايد
# عبر القوانين السبعة.
GENERAL_TOP_K = 6


@app.post("/chat")
async def general_chat(body: ChatBody):
    question = (body.message or "").strip()
    if not question:
        raise HTTPException(400, "رسالة فارغة")
    if len(question) > 2000:
        raise HTTPException(400, "الرسالة طويلة جداً")

    # التحية وطلب تنفيذ فعل: جوابهما معروف سلفاً، يُبنى بلا نموذج — فوريّ
    # ودقيق. طلب الفعل خاصّةً يجب أن يتخطّى الاسترجاع: مواد قد تُضلّل الجواب
    # («احجز لي أرضاً» ← مواد «الحَجْر»).
    instant = canned_reply(question, None)
    instant_mode = "greeting"
    if instant is None and chatmod.is_action(question):
        instant = chatmod.action_reply()
        instant_mode = "meta"
    if instant is not None:
        def quick():
            for stage in (
                {"stage": "meta", "mode": instant_mode, "articles": []},
                {"stage": "token", "text": instant},
                {"stage": "done", "answer": instant, "articles": [],
                 "guard_log": []},
            ):
                yield "data: " + json.dumps(stage, ensure_ascii=False) + "\n\n"
        return StreamingResponse(quick(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache",
                                          "X-Accel-Buffering": "no"})

    corpus = STATE["retriever"].corpus
    hits = []
    if chatmod.is_meta(question):
        mode = "meta"
    else:
        mode = "grounded"
        qv = STATE["embed"].embed(question)[0]
        # بلا ترجيح نطاق — بحث محايد عبر القوانين السبعة (انظر أعلاه).
        hits = STATE["retriever"].search(question, qv, k=GENERAL_TOP_K)

    history = [t.model_dump() for t in body.history]
    messages, _ = chatmod.build_general_messages(question, hits, history, corpus)

    def gen():
        yield ("data: " + json.dumps(
            {"stage": "meta", "mode": mode,
             "articles": [h["article_no"] for h in hits]},
            ensure_ascii=False) + "\n\n")
        parts = []
        try:
            temp = 0.1 if mode == "meta" else 0.3
            cap = 150 if mode == "meta" else 260
            for piece in STATE["chat"].chat_stream(
                    messages, max_tokens=cap, temperature=temp):
                parts.append(piece)
                yield ("data: " + json.dumps(
                    {"stage": "token", "text": piece},
                    ensure_ascii=False) + "\n\n")
        except Exception as e:                          # noqa: BLE001
            yield ("data: " + json.dumps(
                {"stage": "error", "message": str(e)},
                ensure_ascii=False) + "\n\n")
            return

        answer, guard_log, cited = chatmod.guard_answer(
            "".join(parts), hits, None)
        by_no = {h["article_no"]: h for h in hits}
        cited_full = [{"article_no": n, "law_name": by_no[n]["law_name"],
                       "text": by_no[n]["text"]}
                      for n in cited if n in by_no]
        yield ("data: " + json.dumps(
            {"stage": "done", "answer": answer, "articles": cited_full,
             "guard_log": guard_log}, ensure_ascii=False) + "\n\n")

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})


# ── المحادثة ───────────────────────────────────────────────────────────────
@app.post("/analyses/{aid}/chat")
async def chat(aid: str, body: ChatBody):
    """
    محادثة مُدرَّجة الحدود حول عقد مُدقَّق.

    التحيّة تتخطّى الاسترجاع كلياً (بضع ثوانٍ)، وما عداها يمرّ باسترجاع
    هجين قبل التوليد. الردّ يُبَثّ توكناً توكناً، ويُفحَص بعد اكتماله:
    أي «المادة (ن)» خارج المواد المسترجَعة تُحذف ويُسجَّل التدخّل.
    """
    rep = store.get_analysis(aid)
    if not rep:
        raise HTTPException(404, "تحليل غير موجود")
    question = (body.message or "").strip()
    if not question:
        raise HTTPException(400, "رسالة فارغة")
    if len(question) > 2000:
        raise HTTPException(400, "الرسالة طويلة جداً")

    contract = store.get_contract(rep["contract_id"])
    try:
        contract_text = extract(contract["path"]) if contract else ""
    except ExtractionError:
        contract_text = ""

    # التحيّة يُردّ عليها من جدول ثابت بلا نموذج إطلاقاً: ردّها معروف سلفاً،
    # وتشغيل نموذج ليخمّنه يكلّف ~8 ثوانٍ ويُخطئ (كان يردّ «وعليكم السلام»
    # على «أهلاً» لأنها أقرب مثال رآه). الجدول فوريّ وصحيح دائماً.
    # التحية وسؤال حالة الجلسة كلاهما جوابه معروف من بيانات عندنا،
    # فيُبنى مباشرةً بلا نموذج: فوريّ ودقيق.
    instant = canned_reply(question, rep)
    instant_mode = "greeting"
    if instant is None and is_session(question):
        instant = session_reply(rep, [t.model_dump() for t in body.history])
        instant_mode = "session"
    if instant is not None:
        def quick():
            yield ("data: " + json.dumps(
                {"stage": "meta", "mode": instant_mode, "articles": []},
                ensure_ascii=False) + '\n\n')
            yield ("data: " + json.dumps(
                {"stage": "token", "text": instant},
                ensure_ascii=False) + '\n\n')
            yield ("data: " + json.dumps(
                {"stage": "done", "answer": instant, "articles": [],
                 "guard_log": []}, ensure_ascii=False) + '\n\n')
        return StreamingResponse(quick(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache",
                                          "X-Accel-Buffering": "no"})

    # أسئلة الهوية لا تحتاج استرجاعاً — تخطّيه يوفّر ~400 توكن معالجة مسبقة.
    if chatmod.is_meta(question):
        mode = "meta"
    else:
        mode = "grounded"

    hits = []
    if mode == "grounded":
        # سؤال يشير إلى بند برقمه («هل البند الثالث مخالف؟») لا يحمل محتوى
        # قانونياً، فالبحث بنصّه يجيب مواداً عشوائية. نبحث بنصّ البند نفسه،
        # ونضمّ المواد التي استُشهد بها في التقرير لذلك البند.
        ref = chatmod.referenced_clause(question, rep)
        query = f"{ref['text']} {question}" if ref else question
        qv = STATE["embed"].embed(query)[0]
        law_weights = STATE["router"].weights(query, qv)
        hits = STATE["retriever"].search(query, qv, k=TOP_K,
                                         law_weights=law_weights)
        if ref:
            seen = {h["article_no"] for h in hits}
            for cit in ref.get("citations", []):
                if cit["article_no"] not in seen:
                    hits.insert(0, {
                        "article_no": cit["article_no"],
                        "law_name": cit["law_name"],
                        "text": cit["article_text"],
                        "book": cit.get("book"),
                        "chapter": cit.get("chapter"),
                    })
                    seen.add(cit["article_no"])

    history = [t.model_dump() for t in body.history]
    messages, _ = chatmod.build_messages(
        question, contract_text, rep, hits, history)

    def gen():
        meta = {
            "stage": "meta",
            "mode": mode,
            "articles": [h["article_no"] for h in hits],
        }
        yield f"data: {json.dumps(meta, ensure_ascii=False)}\n\n"

        parts = []
        try:
            # التحيّة والهوية جوابهما حقائق ثابتة: حرارة شبه صفرية تمنع
            # زلّات نموذج 4B (تكرار الكلمة، خلط تذكير الخطاب بتأنيثه).
            temp = 0.1 if mode == "meta" else 0.3
            # سقف يسع ثلاث جمل عربية مع هامش — يمنع القطع في
            # منتصف عبارة دون أن يفتح الباب للإطناب.
            cap = 150 if mode == "meta" else 240
            for piece in STATE["chat"].chat_stream(
                    messages, max_tokens=cap, temperature=temp):
                parts.append(piece)
                yield ("data: " + json.dumps(
                    {"stage": "token", "text": piece},
                    ensure_ascii=False) + "\n\n")
        except Exception as e:                          # noqa: BLE001
            yield ("data: " + json.dumps(
                {"stage": "error", "message": str(e)},
                ensure_ascii=False) + "\n\n")
            return

        answer, guard_log, cited = chatmod.guard_answer(
            "".join(parts), hits, rep)
        # نعرض فقط المواد التي استشهد بها الجواب فعلاً، لا كل ما استُرجع —
        # إظهار مواد لم تُستعمل يوحي زوراً بأن الجواب مبنيّ عليها.
        by_no = {h["article_no"]: h for h in hits}
        cited_full = [{"article_no": n,
                       "law_name": by_no[n]["law_name"],
                       "text": by_no[n]["text"]}
                      for n in cited if n in by_no]
        yield ("data: " + json.dumps(
            {"stage": "done", "answer": answer,
             "articles": cited_full,
             "guard_log": guard_log},
            ensure_ascii=False) + "\n\n")

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})
