#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
أنبوب الوكيل الكامل — من ملف العقد إلى تقرير مُنمّط.

    ملف ──▶ استخراج ──▶ تفكيك ──▶ [لكل بند] استرجاع ──▶ تدقيق ──▶ حراسة
                                                                    │
                            تقرير ◀── تقييم القوة ◀── تجميع ◀───────┘

من سبع مراحل، **واحدة فقط** تستدعي نموذجاً لغوياً (التدقيق). الباقي كودٌ
حتميّ. هذا مقصود: كل استدعاء يكلّف ~25 ثانية على هذا الجهاز، وكل خطوة
حتمية هي خطوة لا تهلوس.

الخادمان يعملان بالتناوب لا معاً — الذاكرة لا تتسع لهما:
    ① خادم التضمين: يضمّن كل البنود دفعة واحدة ثم يُوقَف
    ② خادم الاستدلال: يدقّق البنود واحداً واحداً

    python agent/pipeline.py <contract.pdf|docx|txt> [--json out.json]
"""

import argparse
import json
import os
import sys
import time

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "rag"))
sys.path.insert(0, os.path.join(ROOT, "agent"))

from llama import embedding_server, llm_server   # noqa: E402
from retriever import Retriever                  # noqa: E402
from router import LawRouter                     # noqa: E402
from extract import extract, ExtractionError     # noqa: E402
from parser import parse_clauses                 # noqa: E402
from validator import validate_clause            # noqa: E402
from guard import apply_guard                    # noqa: E402
from scorer import score_contract                # noqa: E402

TOP_K = int(os.environ.get("LAWMIND_TOP_K", "3"))


def analyze(path, top_k=TOP_K, progress=None):
    """
    يحلّل عقداً ويعيد التقرير كاملاً.
    progress: دالة اختيارية (stage, payload) للبثّ الحيّ إلى الواجهة.
    """
    def emit(stage, **kw):
        if progress:
            progress(stage, kw)

    t_start = time.perf_counter()

    # ① الاستخراج ─────────────────────────────────────────────────────
    emit("extract_start", filename=os.path.basename(path))
    text = extract(path)
    emit("extract_done", chars=len(text))

    # ② التفكيك ───────────────────────────────────────────────────────
    clauses = parse_clauses(text)
    if not clauses:
        raise ExtractionError("لم أتمكّن من تمييز أي بند في هذا الملف.")
    emit("parse_done", clauses=len(clauses))

    retriever = Retriever()

    # ③ التضمين والاسترجاع (خادم التضمين وحده) ────────────────────────
    emit("retrieve_start", clauses=len(clauses))
    esrv = embedding_server(ctx=4096)
    esrv.start()
    try:
        vecs = esrv.embed([c["text"] for c in clauses])
        # متجه العقد كاملاً — منه يُشتقّ ترجيح القوانين مرّة واحدة
        contract_vec = esrv.embed(text[:4000])[0]
    finally:
        esrv.stop()

    # موجّه النطاق: يرجّح القوانين بحسب نوع العقد قبل أي استرجاع.
    # قياسه على المجموعة الذهبية: بلا ترجيح 90% وبه 100% — أي أنه يستردّ
    # كامل ما يكلّفه التوسّع من قانون واحد إلى سبعة.
    router = LawRouter(retriever.articles, retriever.vectors)
    law_weights = router.weights(text, contract_vec)
    routing = router.explain(text, contract_vec)
    emit("routed", routing=routing)

    # الترجيح ممزوج: ثقل العقد يمنع الانحراف، وثقل البند يلتقط ما يخصّه.
    hits_per_clause = [
        retriever.search(
            c["text"], v, k=top_k,
            law_weights=router.blended_weights(text, contract_vec,
                                               c["text"], v))
        for c, v in zip(clauses, vecs)]
    art_vecs = {a["article_no"]: retriever.vectors[i]
                for i, a in enumerate(retriever.articles)}
    emit("retrieve_done")

    # ④⑤ التدقيق والحراسة (خادم الاستدلال وحده) ──────────────────────
    # مَسلك واحد يكفي هنا (التدقيق تسلسليّ)، ونافذة 4096 تسع المواد
    # المسترجَعة كاملةً — الكوربوس متعدّد القوانين ومواده أطول.
    lsrv = llm_server(ctx=4096, parallel=1)
    lsrv.start()
    results, guard_log = [], []
    try:
        for i, (clause, hits, qv) in enumerate(
                zip(clauses, hits_per_clause, vecs)):
            t0 = time.perf_counter()
            parsed, timings = validate_clause(lsrv, clause["text"], hits)
            g = apply_guard(parsed, hits, clause_vec=qv, article_vecs=art_vecs)

            cited = [h for h in hits if h["article_no"] in g.article_numbers]
            row = {
                "clause_id": clause["clause_id"],
                "heading": clause.get("heading", ""),
                "text": clause["text"],
                "verdict": g.verdict,
                "reasoning": g.reasoning,
                "confidence": round(g.confidence, 2),
                "needs_review": g.needs_review,
                # النصّ يأتي من الكوربوس لا من النموذج — لا مجال لاختلاقه
                "citations": [{
                    "law_id": h["law_id"],
                    "law_name": h["law_name"],
                    "decree_no": h.get("decree_no"),
                    "article_no": h["article_no"],
                    "article_text": h["text"],
                    "book": h.get("book"),
                    "chapter": h.get("chapter"),
                } for h in cited],
                "considered": [{"law_name": h["law_name"],
                                "article_no": h["article_no"]} for h in hits],
                "suggested_text": None,      # يُولَّد عند الطلب فقط
                "seconds": round(time.perf_counter() - t0, 1),
            }
            results.append(row)
            if g.log:
                guard_log.append({"clause_id": clause["clause_id"],
                                  "entries": g.log})
            emit("clause_done", index=i + 1, total=len(clauses), clause=row)
    finally:
        lsrv.stop()

    # ⑥ تقييم القوة ───────────────────────────────────────────────────
    score = score_contract(results, full_text=text)

    summary = {"مخالف": 0, "ناقص": 0, "سليم": 0, "لا مادة ذات صلة": 0}
    for r in results:
        summary[r["verdict"]] += 1

    report = {
        "filename": os.path.basename(path),
        "laws": retriever.corpus.get("laws", []),
        "article_count": retriever.corpus.get("article_count",
                                              len(retriever.articles)),
        "clause_count": len(results),
        "summary": summary,
        "score": score,
        "clauses": results,
        "guard_log": guard_log,
        "top_k": top_k,
        "routing": routing,
        "elapsed_seconds": round(time.perf_counter() - t_start, 1),
        "approved_by": None,
        "approved_at": None,
    }
    emit("done", report=report)
    return report


COLOR = {"مخالف": "\033[91m", "ناقص": "\033[93m",
         "سليم": "\033[92m", "لا مادة ذات صلة": "\033[90m"}
RESET = "\033[0m"


def print_report(rep):
    s = rep["summary"]
    sc = rep["score"]
    print("\n" + "=" * 76)
    print(f"تقرير تدقيق: {rep['filename']}")
    laws = rep.get("laws", [])
    print(f"المرجع: {len(laws)} قانون · {rep.get('article_count', 0)} مادة")
    for row in rep.get("routing", [])[:3]:
        print(f"        {row['weight']:>5.2f}  {row['law_name']}")
    print("=" * 76)
    print(f"الدرجة: {sc['overall']}/100  «{sc['grade']}»   {sc['note']}")
    print(f"  الامتثال {sc['compliance']['score']}/100 (وزن 60%) · "
          f"الاكتمال {sc['completeness']['score']}/100 (وزن 40%)")
    print(f"\nمخالف {s['مخالف']} · ناقص {s['ناقص']} · سليم {s['سليم']} · "
          f"لا مادة {s['لا مادة ذات صلة']}   "
          f"({rep['clause_count']} بند في {rep['elapsed_seconds']}ث)")

    for c in rep["clauses"]:
        col = COLOR.get(c["verdict"], "")
        print("\n" + "-" * 76)
        print(f"{col}[{c['verdict']}]{RESET} {c['clause_id']}"
              f"{'  ⚑ يتطلّب مراجعة' if c['needs_review'] else ''}")
        print(f"  البند : {c['text'][:200]}")
        print(f"  السبب : {c['reasoning']}")
        for cit in c["citations"]:
            print(f"  السند : {cit['law_name']}"
                  f"{' ' + cit['decree_no'] if cit.get('decree_no') else ''}"
                  f" — المادة ({cit['article_no']})")
            print(f"          {cit['article_text'][:200]}")
        if not c["citations"]:
            seen = "، ".join(f"{x['law_name'][:16]}({x['article_no']})"
                             for x in c["considered"])
            print(f"  السند : لا مادة ذات صلة  (فُحصت: {seen})")

    miss = [m for m in sc["completeness"]["missing"] if m["required"]]
    if miss:
        print("\n" + "-" * 76)
        print("بيانات إلزامية ناقصة (المادة 36):")
        for m in miss:
            print(f"  ✗ {m['label']}")

    if rep["guard_log"]:
        print("\n" + "-" * 76)
        print("سجلّ الحارس:")
        for g in rep["guard_log"]:
            for e in g["entries"]:
                print(f"  🛡 {g['clause_id']}: {e}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("contract")
    ap.add_argument("--json", dest="out")
    ap.add_argument("--top-k", type=int, default=TOP_K)
    args = ap.parse_args()

    def progress(stage, payload):
        if stage == "extract_done":
            print(f"  استُخرج {payload['chars']} محرف")
        elif stage == "parse_done":
            print(f"  فُكّك إلى {payload['clauses']} بند")
        elif stage == "retrieve_start":
            print(f"  تضمين واسترجاع {payload['clauses']} بند...")
        elif stage == "clause_done":
            c = payload["clause"]
            print(f"  [{payload['index']}/{payload['total']}] "
                  f"{c['verdict']:<16} {c['seconds']}ث")

    try:
        rep = analyze(args.contract, top_k=args.top_k, progress=progress)
    except ExtractionError as e:
        sys.exit(f"خطأ: {e}")

    print_report(rep)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(rep, f, ensure_ascii=False, indent=2)
        print(f"\nحُفظ التقرير في {args.out}")


if __name__ == "__main__":
    main()
