#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
قياس أثر توسيع الكوربوس من قانون واحد إلى سبعة.

السؤال: الكوربوس صار 17 ضعفاً (150 → 2596 مادة). كم خسرنا من دقّة
الاسترجاع؟ وكم يستردّ موجّه النطاق؟

ثلاث حالات على **نفس** المجموعة الذهبية، لعزل كل أثر على حدة:

    ① قانون العمل فقط   ← خطّ الأساس المعروف (recall@3 = 100%)
    ② سبعة قوانين بلا ترجيح   ← كلفة التوسّع وحده
    ③ سبعة قوانين بترجيح      ← ما يستردّه الموجّه

الفرق بين ① و② هو ثمن التوسّع. والفرق بين ② و③ هو قيمة الموجّه.
رقمان قابلان للدفاع أمام لجنة تحكيم.

    python rag/eval_multilaw.py
"""

import os
import statistics
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "rag"))

from llama import embedding_server        # noqa: E402
from retriever import Retriever           # noqa: E402
from router import LawRouter              # noqa: E402
from eval_retrieval import GOLDEN         # noqa: E402

LABOUR = "OM-LABOUR-53-2023"

# نصّ العقد الذي يُشتقّ منه ترجيح القوانين — الموجّه يقرأ العقد كاملاً
# مرّة واحدة، لا كل بند على حدة.
CONTRACT = os.path.join("fixtures", "demo_contract.txt")


def recall_at(ranked, gold, k):
    return any(n in gold for n in ranked[:k])


def evaluate(r, qvs, law_filter=None, law_weights=None, k=5):
    """يعيد {k: عدد الإصابات} ورتبة كل بند."""
    hits = {1: 0, 3: 0, 5: 0}
    ranks = []
    for g, qv in zip(GOLDEN, qvs):
        found = r.search(g["clause"], qv, k=40, law_weights=law_weights)
        if law_filter:
            found = [h for h in found if h["law_id"] == law_filter]
        nums = [h["article_no"] for h in found[:k]]
        for kk in (1, 3, 5):
            if recall_at(nums, g["gold"], kk):
                hits[kk] += 1
        pos = next((i + 1 for i, n in enumerate(nums) if n in g["gold"]), None)
        ranks.append((g["id"], pos, nums[:3],
                      [h["law_name"] for h in found[:3]]))
    return hits, ranks


def show(title, hits, n):
    print(f"  {title:<28}"
          + "".join(f"{hits[k]}/{n} ({hits[k]/n*100:>3.0f}%)".rjust(13)
                   for k in (1, 3, 5)))


def main():
    r = Retriever()
    laws = r.corpus.get("laws", [])
    print(f"الكوربوس: {len(laws)} قانون · {len(r.articles)} مادة")
    print(f"المجموعة الذهبية: {len(GOLDEN)} بند (كلها من قانون العمل)\n")

    srv = embedding_server(ctx=4096)
    print(f"خادم التضمين جاهز في {srv.start():.1f}ث\n")
    try:
        qvs = [srv.embed(g["clause"])[0] for g in GOLDEN]
        with open(CONTRACT, encoding="utf-8") as f:
            contract_text = f.read()
        cvec = srv.embed(contract_text[:4000])[0]
    finally:
        srv.stop()

    router = LawRouter(r.articles, r.vectors)
    ranking = router.explain(contract_text, cvec)

    print("موجّه النطاق — ترتيب القوانين لهذا العقد:")
    for row in ranking:
        print(f"  {row['weight']:>5.2f}  {row['law_name']:<28} "
              f"تشابه {row['similarity']:>7.4f}  ({row['article_count']} مادة)")
    top = ranking[0]
    print(f"\n  القانون الأساسي المستنتَج: {top['law_name']}"
          + ("  ✓" if top["law_id"] == LABOUR else "  ✗ متوقّع: قانون العمل"))

    weights = router.weights(contract_text, cvec)
    n = len(GOLDEN)

    print("\n" + "=" * 74)
    print(f"{'الحالة':<30}{'recall@1':>13}{'recall@3':>13}{'recall@5':>13}")
    print("-" * 74)
    h1, _ = evaluate(r, qvs, law_filter=LABOUR)
    show("① قانون العمل فقط", h1, n)
    h2, rk2 = evaluate(r, qvs)
    show("② سبعة قوانين بلا ترجيح", h2, n)
    h3, rk3 = evaluate(r, qvs, law_weights=weights)
    show("③ سبعة قوانين بترجيح", h3, n)
    print("=" * 74)

    cost = (h1[3] - h2[3]) / n * 100
    gain = (h3[3] - h2[3]) / n * 100
    print(f"\n  ثمن التوسّع (①→②)   : {cost:+.0f} نقطة مئوية")
    print(f"  قيمة الموجّه (②→③)  : {gain:+.0f} نقطة مئوية")
    print(f"  الصافي مقابل الأساس : {(h3[3]-h1[3])/n*100:+.0f} نقطة مئوية")

    print("\n--- تفصيل الحالة ③ ---")
    for (cid, pos, nums, lawnames) in rk3:
        mark = "OK" if pos and pos <= 3 else "XX"
        src = "، ".join(dict.fromkeys(lawnames))
        print(f"  {mark} {cid:<22} رتبة={pos or '—'}  مواد={nums}")
        print(f"       من: {src}")

    bad = [x for x in rk3 if not (x[1] and x[1] <= 3)]
    if bad:
        print("\n--- إخفاقات الحالة ③ ---")
        for cid, pos, nums, lawnames in bad:
            g = next(x for x in GOLDEN if x["id"] == cid)
            print(f"  {cid}: المتوقّع {g['gold']} · جاء {nums}")
            print(f"    «{g['clause'][:70]}...»")


if __name__ == "__main__":
    main()
