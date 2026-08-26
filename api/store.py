#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تخزين بسيط على SQLite — جدولان، SQL خام، بلا ORM.

المطلوب في هذه المرحلة تخزين السجلّ والاعتمادات فقط. ORM أو نظام هجرات
هنا تكلفة بلا عائد.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import uuid
from datetime import datetime, timezone

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "lawmind.db")
_lock = threading.Lock()


def _conn():
    c = sqlite3.connect(DB, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def init():
    with _lock, _conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS contracts (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            path TEXT NOT NULL,
            chars INTEGER,
            clause_count INTEGER,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            contract_id TEXT NOT NULL,
            report_json TEXT NOT NULL,
            score INTEGER,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            approved_by TEXT,
            approved_at TEXT,
            FOREIGN KEY (contract_id) REFERENCES contracts(id)
        );
        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS office (
            id TEXT PRIMARY KEY,
            office_name TEXT,
            lawyer_name TEXT,
            license_no TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            logo TEXT
        );
        CREATE TABLE IF NOT EXISTS pricing (
            contract_type TEXT PRIMARY KEY,
            price REAL NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            invoice_no TEXT NOT NULL,
            client_id TEXT,
            analysis_id TEXT,
            amount REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'issued',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            pw_hash TEXT NOT NULL,
            pw_salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS deadlines (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            due_date TEXT NOT NULL,
            client_id TEXT,
            analysis_id TEXT,
            note TEXT,
            done INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS consultations (
            id TEXT PRIMARY KEY,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            articles TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS saved_clauses (
            id TEXT PRIMARY KEY,
            heading TEXT,
            text TEXT NOT NULL,
            verdict TEXT,
            law_name TEXT,
            article_no INTEGER,
            source_analysis_id TEXT,
            source_filename TEXT,
            note TEXT,
            created_at TEXT NOT NULL
        );
        """)
        # ترحيل: عمود ربط العقد بعميل — يُضاف مرّة إن لم يكن موجوداً.
        cols = {r["name"] for r in c.execute(
            "PRAGMA table_info(contracts)").fetchall()}
        if "client_id" not in cols:
            c.execute("ALTER TABLE contracts ADD COLUMN client_id TEXT")
        # ترحيل: أتعاب العقد ونوعه على التحليل — للوحة الإيرادات (B2).
        acols = {r["name"] for r in c.execute(
            "PRAGMA table_info(analyses)").fetchall()}
        if "fee" not in acols:
            c.execute("ALTER TABLE analyses ADD COLUMN fee REAL")
        if "contract_type" not in acols:
            c.execute("ALTER TABLE analyses ADD COLUMN contract_type TEXT")
        # بذرة قائمة الأسعار — أنواع شائعة بسعر صفر يضبطها المحامي.
        if not c.execute("SELECT 1 FROM pricing LIMIT 1").fetchone():
            for t in ("عقد عمل", "عقد إيجار", "عقد بيع", "عقد توريد",
                      "عقد مقاولة", "عقد أتعاب", "عقد خدمات", "أخرى"):
                c.execute("INSERT OR IGNORE INTO pricing VALUES (?,0)", (t,))


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def save_contract(cid, filename, path, chars, clause_count, client_id=None):
    with _lock, _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO contracts "
            "(id, filename, path, chars, clause_count, created_at, client_id) "
            "VALUES (?,?,?,?,?,?,?)",
            (cid, filename, path, chars, clause_count, _now(), client_id))


def get_contract(cid):
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM contracts WHERE id=?", (cid,)).fetchone()
        return dict(row) if row else None


def save_analysis(aid, cid, report):
    with _lock, _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO analyses "
            "(id, contract_id, report_json, score, status, created_at, "
            " approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?)",
            (aid, cid, json.dumps(report, ensure_ascii=False),
             report.get("score", {}).get("overall"), "done", _now(),
             None, None))


def get_analysis(aid):
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM analyses WHERE id=?", (aid,)).fetchone()
        if not row:
            return None
        rep = json.loads(row["report_json"])
        rep["approved_by"] = row["approved_by"]
        rep["approved_at"] = row["approved_at"]
        ct = c.execute(
            "SELECT ct.client_id, cl.name AS client_name FROM contracts ct "
            "LEFT JOIN clients cl ON cl.id = ct.client_id WHERE ct.id=?",
            (rep.get("contract_id"),)).fetchone()
        rep["client_id"] = ct["client_id"] if ct else None
        rep["client_name"] = ct["client_name"] if ct else None
        rep["fee"] = row["fee"] if "fee" in row.keys() else None
        rep["contract_type"] = (row["contract_type"]
                                if "contract_type" in row.keys() else None)
    # نوع مبدئيّ مقترح من الموجّه — يُعرَض حين لم يحدّد المحامي نوعاً بعد
    rep["suggested_type"] = suggest_type(rep)
    return rep


def list_analyses(limit=50):
    with _lock, _conn() as c:
        rows = c.execute("""
            SELECT a.id, a.contract_id, a.score, a.status, a.created_at,
                   a.approved_by, a.approved_at, c.filename, c.clause_count,
                   c.client_id, cl.name AS client_name
            FROM analyses a JOIN contracts c ON c.id = a.contract_id
            LEFT JOIN clients cl ON cl.id = c.client_id
            ORDER BY a.created_at DESC LIMIT ?""", (limit,)).fetchall()
        return [dict(r) for r in rows]


# ── العملاء (B3) ───────────────────────────────────────────────────────────
def save_client(cid, name, phone=None, email=None, notes=None):
    with _lock, _conn() as c:
        exists = c.execute("SELECT created_at FROM clients WHERE id=?",
                           (cid,)).fetchone()
        created = exists["created_at"] if exists else _now()
        c.execute(
            "INSERT OR REPLACE INTO clients "
            "(id, name, phone, email, notes, created_at) VALUES (?,?,?,?,?,?)",
            (cid, name, phone, email, notes, created))


def get_client(cid):
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM clients WHERE id=?", (cid,)).fetchone()
        return dict(row) if row else None


def list_clients():
    """العملاء مع عدد عقودهم — للعرض في القائمة."""
    with _lock, _conn() as c:
        rows = c.execute("""
            SELECT cl.*, COUNT(ct.id) AS contract_count
            FROM clients cl
            LEFT JOIN contracts ct ON ct.client_id = cl.id
            GROUP BY cl.id
            ORDER BY cl.created_at DESC""").fetchall()
        return [dict(r) for r in rows]


def delete_client(cid):
    """يحذف العميل ويفكّ ربط عقوده (لا تُحذف العقود ولا تحاليلها)."""
    with _lock, _conn() as c:
        c.execute("UPDATE contracts SET client_id=NULL WHERE client_id=?",
                  (cid,))
        c.execute("DELETE FROM clients WHERE id=?", (cid,))


def assign_contract_client(contract_id, client_id):
    """يربط عقداً بعميل (client_id=None يفكّ الربط)."""
    with _lock, _conn() as c:
        c.execute("UPDATE contracts SET client_id=? WHERE id=?",
                  (client_id, contract_id))


def analyses_for_client(client_id):
    with _lock, _conn() as c:
        rows = c.execute("""
            SELECT a.id, a.score, a.status, a.created_at, a.approved_by,
                   a.fee, c.filename, c.clause_count, c.id AS contract_id
            FROM analyses a JOIN contracts c ON c.id = a.contract_id
            WHERE c.client_id = ?
            ORDER BY a.created_at DESC""", (client_id,)).fetchall()
        return [dict(r) for r in rows]


# ── هوية المكتب (B5) ───────────────────────────────────────────────────────
_OFFICE_FIELDS = ("office_name", "lawyer_name", "license_no",
                  "phone", "email", "address", "logo")


def get_office():
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM office WHERE id='office'").fetchone()
        return dict(row) if row else {"id": "office",
                                      **{f: None for f in _OFFICE_FIELDS}}


def save_office(data):
    vals = [data.get(f) for f in _OFFICE_FIELDS]
    with _lock, _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO office "
            "(id, office_name, lawyer_name, license_no, phone, email, "
            " address, logo) VALUES ('office',?,?,?,?,?,?,?)", vals)
    return get_office()


# ── الأسعار والأتعاب (B2) ──────────────────────────────────────────────────
# ربط القانون الأساسيّ المُكتشَف بنوع عقد مبدئيّ — يؤكّده المحامي.
_TYPE_BY_LAW = {
    "OM-LABOUR": "عقد عمل",
    "OM-CIVIL": "عقد إيجار",
    "OM-COMMERCE": "عقد توريد",
}


def suggest_type(rep):
    routing = rep.get("routing") or []
    if not routing:
        return "أخرى"
    lid = routing[0].get("law_id", "")
    for key, t in _TYPE_BY_LAW.items():
        if lid.startswith(key):
            return t
    return "أخرى"


def get_pricing():
    with _lock, _conn() as c:
        rows = c.execute(
            "SELECT contract_type, price FROM pricing ORDER BY rowid").fetchall()
        return [dict(r) for r in rows]


def save_pricing(items):
    """يستبدل قائمة الأسعار كاملةً بالمُرسَلة."""
    with _lock, _conn() as c:
        c.execute("DELETE FROM pricing")
        for it in items:
            t = (it.get("contract_type") or "").strip()
            if not t:
                continue
            c.execute("INSERT OR REPLACE INTO pricing VALUES (?,?)",
                      (t, float(it.get("price") or 0)))
    return get_pricing()


def price_for_type(contract_type):
    with _lock, _conn() as c:
        row = c.execute("SELECT price FROM pricing WHERE contract_type=?",
                        (contract_type,)).fetchone()
        return row["price"] if row else None


def set_fee(aid, contract_type, fee):
    with _lock, _conn() as c:
        c.execute("UPDATE analyses SET contract_type=?, fee=? WHERE id=?",
                  (contract_type, fee, aid))


def _analysis_meta(aid):
    """(fee, contract_type) الحاليّان للتحليل — من الأعمدة لا report_json."""
    with _lock, _conn() as c:
        row = c.execute("SELECT fee, contract_type FROM analyses WHERE id=?",
                        (aid,)).fetchone()
        return (row["fee"], row["contract_type"]) if row else (None, None)


# ── الفواتير (B2) ──────────────────────────────────────────────────────────
def _next_invoice_no():
    year = _now()[:4]
    with _lock, _conn() as c:
        n = c.execute("SELECT COUNT(*) AS n FROM invoices").fetchone()["n"]
    return f"INV-{year}-{n + 1:04d}"


def create_invoice(client_id, analysis_id, amount):
    iid = uuid.uuid4().hex[:12]
    no = _next_invoice_no()
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO invoices "
            "(id, invoice_no, client_id, analysis_id, amount, status, "
            " created_at) VALUES (?,?,?,?,?,?,?)",
            (iid, no, client_id, analysis_id, float(amount), "issued", _now()))
    return get_invoice(iid)


def get_invoice(iid):
    with _lock, _conn() as c:
        row = c.execute("""
            SELECT i.*, cl.name AS client_name, cl.phone AS client_phone,
                   cl.email AS client_email, c.filename
            FROM invoices i
            LEFT JOIN clients cl ON cl.id = i.client_id
            LEFT JOIN analyses a ON a.id = i.analysis_id
            LEFT JOIN contracts c ON c.id = a.contract_id
            WHERE i.id=?""", (iid,)).fetchone()
        return dict(row) if row else None


def list_invoices():
    with _lock, _conn() as c:
        rows = c.execute("""
            SELECT i.*, cl.name AS client_name, c.filename
            FROM invoices i
            LEFT JOIN clients cl ON cl.id = i.client_id
            LEFT JOIN analyses a ON a.id = i.analysis_id
            LEFT JOIN contracts c ON c.id = a.contract_id
            ORDER BY i.created_at DESC""").fetchall()
        return [dict(r) for r in rows]


def set_invoice_status(iid, status):
    with _lock, _conn() as c:
        c.execute("UPDATE invoices SET status=? WHERE id=?", (status, iid))


# ── متابعة المهل (B4) ──────────────────────────────────────────────────────
def create_deadline(data):
    did = uuid.uuid4().hex[:12]
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO deadlines "
            "(id, title, due_date, client_id, analysis_id, note, done, "
            " created_at) VALUES (?,?,?,?,?,?,0,?)",
            (did, data.get("title", "").strip(), data.get("due_date"),
             data.get("client_id"), data.get("analysis_id"),
             data.get("note"), _now()))
    return did


def list_deadlines():
    with _lock, _conn() as c:
        rows = c.execute("""
            SELECT d.*, cl.name AS client_name
            FROM deadlines d LEFT JOIN clients cl ON cl.id = d.client_id
            ORDER BY d.done ASC, d.due_date ASC""").fetchall()
        return [dict(r) for r in rows]


def set_deadline_done(did, done):
    with _lock, _conn() as c:
        c.execute("UPDATE deadlines SET done=? WHERE id=?",
                  (1 if done else 0, did))


def delete_deadline(did):
    with _lock, _conn() as c:
        c.execute("DELETE FROM deadlines WHERE id=?", (did,))


# ── سجلّ الاستشارات (B8) ───────────────────────────────────────────────────
def save_consultation(question, answer, articles):
    cid = uuid.uuid4().hex[:12]
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO consultations (id, question, answer, articles, "
            "created_at) VALUES (?,?,?,?,?)",
            (cid, question, answer,
             json.dumps(articles or [], ensure_ascii=False), _now()))
    return cid


def list_consultations():
    with _lock, _conn() as c:
        rows = c.execute(
            "SELECT * FROM consultations ORDER BY created_at DESC").fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["articles"] = json.loads(d.get("articles") or "[]")
        except Exception:
            d["articles"] = []
        out.append(d)
    return out


def delete_consultation(cid):
    with _lock, _conn() as c:
        c.execute("DELETE FROM consultations WHERE id=?", (cid,))


# ── المصادقة المحلية (A2) ──────────────────────────────────────────────────
# تعمية محلية بالكامل: pbkdf2-hmac-sha256 من المكتبة القياسية، بلا أي طرف
# خارجي. الجلسة رمز عشوائيّ يُخزَّن محلياً. هذه بوّابة وصول لأداة مكتبيّة
# محليّة أحاديّة المستخدم، لا حصن أمنيّ ضدّ مهاجم على الجهاز نفسه.
def _hash_pw(password, salt=None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                            salt.encode("utf-8"), 120_000)
    return h.hex(), salt


def user_count():
    with _lock, _conn() as c:
        return c.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]


def create_user(username, name, password):
    username = (username or "").strip().lower()
    with _lock, _conn() as c:
        if c.execute("SELECT 1 FROM users WHERE username=?",
                     (username,)).fetchone():
            return None
        uid = uuid.uuid4().hex[:12]
        pw_hash, salt = _hash_pw(password)
        c.execute("INSERT INTO users VALUES (?,?,?,?,?,?)",
                  (uid, username, name, pw_hash, salt, _now()))
    return {"id": uid, "username": username, "name": name}


def verify_user(username, password):
    username = (username or "").strip().lower()
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM users WHERE username=?",
                        (username,)).fetchone()
    if not row:
        return None
    calc, _ = _hash_pw(password, row["pw_salt"])
    if not hmac.compare_digest(calc, row["pw_hash"]):
        return None
    return {"id": row["id"], "username": row["username"], "name": row["name"]}


def new_session(user_id):
    token = secrets.token_hex(24)
    with _lock, _conn() as c:
        c.execute("INSERT INTO sessions VALUES (?,?,?)",
                  (token, user_id, _now()))
    return token


def user_for_token(token):
    if not token:
        return None
    with _lock, _conn() as c:
        row = c.execute(
            "SELECT u.id, u.username, u.name FROM sessions s "
            "JOIN users u ON u.id = s.user_id WHERE s.token=?",
            (token,)).fetchone()
        return dict(row) if row else None


def end_session(token):
    with _lock, _conn() as c:
        c.execute("DELETE FROM sessions WHERE token=?", (token,))


# ── البحث والمكتبة (B6) ────────────────────────────────────────────────────
_TASHKEEL = re.compile(r"[ً-ْٰـ]")


def _norm(s):
    """تطبيع عربيّ خفيف: حذف التشكيل، وتوحيد الألف والياء والتاء المربوطة."""
    s = _TASHKEEL.sub("", s or "")
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي"),
                 ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي")):
        s = s.replace(a, b)
    return s.lower().strip()


def search_clauses(q, limit=80):
    """بحث نصّيّ مُطبَّع في بنود كل العقود المحلَّلة — بلا تضمين (MVP)."""
    nq = _norm(q)
    if not nq:
        return []
    with _lock, _conn() as c:
        rows = c.execute("""
            SELECT a.id, a.report_json, ct.filename
            FROM analyses a JOIN contracts ct ON ct.id = a.contract_id
            WHERE a.status = 'done'
            ORDER BY a.created_at DESC""").fetchall()
    out = []
    for r in rows:
        rep = json.loads(r["report_json"])
        for cl in rep.get("clauses", []):
            hay = _norm(" ".join([cl.get("text", ""), cl.get("heading", ""),
                                  cl.get("reasoning", "")]))
            if nq in hay:
                cit = (cl.get("citations") or [{}])[0]
                out.append({
                    "analysis_id": r["id"],
                    "filename": r["filename"],
                    "clause_id": cl.get("clause_id"),
                    "heading": cl.get("heading", ""),
                    "verdict": cl.get("verdict"),
                    "text": cl.get("text", ""),
                    "law_name": cit.get("law_name"),
                    "article_no": cit.get("article_no"),
                })
                if len(out) >= limit:
                    return out
    return out


def save_clause(data):
    sid = uuid.uuid4().hex[:12]
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO saved_clauses "
            "(id, heading, text, verdict, law_name, article_no, "
            " source_analysis_id, source_filename, note, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (sid, data.get("heading"), data.get("text", ""),
             data.get("verdict"), data.get("law_name"),
             data.get("article_no"), data.get("source_analysis_id"),
             data.get("source_filename"), data.get("note"), _now()))
    return sid


def list_saved_clauses():
    with _lock, _conn() as c:
        rows = c.execute(
            "SELECT * FROM saved_clauses ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]


def delete_saved_clause(sid):
    with _lock, _conn() as c:
        c.execute("DELETE FROM saved_clauses WHERE id=?", (sid,))


def revenue_summary():
    """إجماليّات الإيراد + توزيعها على الحالات والعملاء."""
    with _lock, _conn() as c:
        inv = c.execute("SELECT amount, status FROM invoices").fetchall()
        # الأتعاب المُسجّلة على التحاليل (قد لا تُفوتَر بعد)
        fees = c.execute(
            "SELECT COALESCE(SUM(fee),0) AS s, COUNT(fee) AS n "
            "FROM analyses WHERE fee IS NOT NULL").fetchone()
        by_client = c.execute("""
            SELECT COALESCE(cl.name,'—') AS client_name,
                   SUM(i.amount) AS total, COUNT(*) AS count
            FROM invoices i LEFT JOIN clients cl ON cl.id = i.client_id
            GROUP BY i.client_id ORDER BY total DESC""").fetchall()
    total = sum(r["amount"] for r in inv)
    paid = sum(r["amount"] for r in inv if r["status"] == "paid")
    return {
        "invoiced_total": round(total, 3),
        "paid_total": round(paid, 3),
        "outstanding_total": round(total - paid, 3),
        "invoice_count": len(inv),
        "fees_total": round(fees["s"], 3),
        "fees_count": fees["n"],
        "by_client": [dict(r) for r in by_client],
    }


def approve(aid, who):
    stamp = _now()
    with _lock, _conn() as c:
        c.execute("UPDATE analyses SET approved_by=?, approved_at=? WHERE id=?",
                  (who, stamp, aid))
    return stamp


def set_suggestion(aid, clause_id, text):
    with _lock, _conn() as c:
        row = c.execute("SELECT report_json FROM analyses WHERE id=?",
                        (aid,)).fetchone()
        if not row:
            return
        rep = json.loads(row["report_json"])
        for cl in rep["clauses"]:
            if cl["clause_id"] == clause_id:
                cl["suggested_text"] = text
        c.execute("UPDATE analyses SET report_json=? WHERE id=?",
                  (json.dumps(rep, ensure_ascii=False), aid))


def set_revision(aid, clause_id, status):
    """
    حالة التعديل لبند: accepted | rejected | pending.
    تُخزَّن داخل report_json نفسه — لا عمود مستقلّ، فالبنية كلها في مكان واحد.
    """
    with _lock, _conn() as c:
        row = c.execute("SELECT report_json FROM analyses WHERE id=?",
                        (aid,)).fetchone()
        if not row:
            return None
        rep = json.loads(row["report_json"])
        found = False
        for cl in rep["clauses"]:
            if cl["clause_id"] == clause_id:
                cl["revision_status"] = status
                found = True
        if not found:
            return None
        c.execute("UPDATE analyses SET report_json=? WHERE id=?",
                  (json.dumps(rep, ensure_ascii=False), aid))
        return status


# عتبة الثقة التي دونها يُقترح البند للمراجعة حتى لو لم يُعلَّم آلياً.
REVIEW_CONF_THRESHOLD = 0.6


def review_queue(limit=200):
    """
    يجمع البنود التي تحتاج انتباه المحامي عبر كل التحاليل.

    المعيار: علامة needs_review الآلية، أو ثقة منخفضة في حكم مخالف/ناقص.
    الترتيب: الأحدث أولاً، والأقلّ ثقة داخل التحليل الواحد.
    """
    with _lock, _conn() as c:
        rows = c.execute("""
            SELECT a.id, a.created_at, a.approved_by, c.filename
            FROM analyses a JOIN contracts c ON c.id = a.contract_id
            WHERE a.status = 'done'
            ORDER BY a.created_at DESC LIMIT ?""", (limit,)).fetchall()
        # نقرأ report_json لكلٍّ — العدد صغير في هذه المرحلة، بلا فهرسة مبكّرة
        detail = {r["id"]: c.execute(
            "SELECT report_json FROM analyses WHERE id=?", (r["id"],)
        ).fetchone()["report_json"] for r in rows}

    items = []
    for r in rows:
        rep = json.loads(detail[r["id"]])
        for cl in rep.get("clauses", []):
            conf = cl.get("confidence", 1)
            # المعيار العمليّ: كل بند بحكم يتطلّب قراراً (مخالف/ناقص)، أو
            # مُعلَّم آلياً، أو منخفض الثقة. الثقة وحدها لا تكفي — القياس على
            # البيانات الحقيقية أظهرها شبه ثابتة (0.95)، فالحكم هو الإشارة
            # الفعلية لما يحتاج انتباه المحامي.
            flagged = (cl.get("verdict") in ("مخالف", "ناقص")
                       or cl.get("needs_review")
                       or conf < REVIEW_CONF_THRESHOLD)
            if not flagged:
                continue
            items.append({
                "analysis_id": r["id"],
                "filename": r["filename"],
                "created_at": r["created_at"],
                "approved": bool(r["approved_by"]),
                "clause_id": cl["clause_id"],
                "heading": cl.get("heading", ""),
                "verdict": cl.get("verdict"),
                "confidence": conf,
                "needs_review": bool(cl.get("needs_review")),
                "reasoning": cl.get("reasoning", ""),
            })
    return items
