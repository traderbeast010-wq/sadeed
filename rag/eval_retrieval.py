#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
بوابة القرار ② — تقييم الاسترجاع.

السؤال: إذا أعطينا المسترجِع بنداً من عقد عمل حقيقي، هل يجيب المادة الصحيحة
ضمن أفضل ٣؟ إن لم يفعل، فكل ما يُبنى فوقه بلا قيمة مهما كان النموذج قوياً.

يقارن ثلاث طرق على نفس المجموعة:
    معجمي فقط (BM25)  ·  دلالي فقط (bge-m3)  ·  هجين (RRF)

    python rag/eval_retrieval.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from llama import embedding_server   # noqa: E402
from retriever import Retriever      # noqa: E402

# ── المجموعة الذهبية ───────────────────────────────────────────────────────
# بنود مصاغة كما تُكتب في عقود العمل فعلاً — لا كأسئلة بحث.
# `gold` = المواد المقبولة؛ الإصابة تُحتسب إذا ظهرت أيّ منها.
GOLDEN = [
    {
        "id": "ساعات العمل",
        "clause": "يلتزم الطرف الثاني بالعمل لمدة اثنتي عشرة ساعة يومياً، "
                  "بواقع ستة أيام في الأسبوع.",
        "gold": [70, 71],   # م(71) تنصّ حرفياً على سقف الاثنتي عشرة ساعة
    },
    {
        "id": "العمل الإضافي",
        "clause": "يحق لصاحب العمل تكليف الطرف الثاني بساعات عمل إضافية دون "
                  "حد أقصى ودون مقابل مالي.",
        "gold": [71],
    },
    {
        "id": "الإجازة السنوية",
        "clause": "يستحق الطرف الثاني إجازة سنوية مدفوعة الأجر مقدارها خمسة "
                  "عشر يوماً عن كل سنة خدمة كاملة.",
        "gold": [78, 81],
    },
    {
        "id": "فترة الاختبار",
        "clause": "يخضع الطرف الثاني لفترة اختبار مدتها ستة أشهر، قابلة "
                  "للتجديد مرة أخرى بقرار من صاحب العمل.",
        "gold": [37],
    },
    {
        "id": "الإجازة المرضية",
        "clause": "لا يستحق الطرف الثاني أي أجر عن أيام انقطاعه عن العمل "
                  "بسبب المرض مهما كانت مدتها.",
        "gold": [82],
    },
    {
        "id": "مكافأة نهاية الخدمة",
        "clause": "لا يستحق الطرف الثاني أي مكافأة عن مدة خدمته عند انتهاء "
                  "هذا العقد لأي سبب من الأسباب.",
        "gold": [61],
    },
    {
        "id": "لغة العقد",
        "clause": "يحرر هذا العقد باللغة الإنجليزية فقط، ويعتد بالنسخة "
                  "الإنجليزية وحدها عند الاختلاف.",
        "gold": [33],
    },
    {
        "id": "مدة العقد",
        "clause": "مدة هذا العقد سبع سنوات محددة، وينتهي بانتهائها دون حاجة "
                  "إلى إخطار.",
        "gold": [35],
    },
    {
        "id": "الإجازات الخاصة",
        "clause": "لا يستحق الطرف الثاني أي إجازة بمناسبة زواجه أو ولادة "
                  "طفله أو وفاة أحد أقاربه.",
        "gold": [84],
    },
    {
        "id": "ساعة الرضاعة",
        "clause": "لا تمنح العاملة المرضعة أي وقت لرعاية طفلها خلال ساعات "
                  "الدوام الرسمي.",
        "gold": [76],
    },
]


def recall_at(ranked, gold, k):
    return any(n in gold for n in ranked[:k])


def sweep(r, srv):
    """يمسح أوزان الدمج ويطبع recall@1/3 لكل تركيبة."""
    qvs = [srv.embed(g["clause"])[0] for g in GOLDEN]
    n = len(GOLDEN)
    print()
    print("=" * 62)
    print("مسح أوزان الدمج")
    print("=" * 62)
    print(f"{'w_lex':>7}{'w_dense':>9}{'recall@1':>12}{'recall@3':>12}{'recall@5':>12}")
    print("-" * 62)
    best = None
    for w_lex in (0.0, 0.25, 0.4, 0.5, 0.75, 1.0):
        got = {1: 0, 3: 0, 5: 0}
        for g, qv in zip(GOLDEN, qvs):
            ranked = [h["article_no"] for h in
                      r.search(g["clause"], qv, k=5, w_lex=w_lex, w_dense=1.0)]
            for k in (1, 3, 5):
                if recall_at(ranked, g["gold"], k):
                    got[k] += 1
        star = ""
        score = (got[3], got[1], got[5])
        if best is None or score > best[0]:
            best, star = (score, w_lex), " <<<"
        print(f"{w_lex:>7.2f}{1.0:>9.2f}"
              + "".join(f"{got[k]}/{n} ({got[k]/n*100:>3.0f}%)".rjust(12)
                        for k in (1, 3, 5)) + star)
    print("-" * 62)
    print(f"الأفضل: w_lex={best[1]}  w_dense=1.0")


def main():
    r = Retriever()
    print(f"الكوربوس: {r.corpus['law_name']} — {len(r.articles)} مادة")
    print(f"المجموعة الذهبية: {len(GOLDEN)} بند\n")
    print("تشغيل خادم التضمين...")
    srv = embedding_server(ctx=4096)
    print(f"جاهز في {srv.start():.1f}ث\n")

    methods = ("معجمي", "دلالي", "هجين")
    hits = {m: {1: 0, 3: 0, 5: 0} for m in methods}
    failures = []

    try:
        for g in GOLDEN:
            qv = srv.embed(g["clause"])[0]
            ranked = {
                "معجمي": r.search_lexical_only(g["clause"], k=5),
                "دلالي": r.search_dense_only(qv, k=5),
                "هجين": [h["article_no"] for h in
                         r.search(g["clause"], qv, k=5, debug=True)],
            }
            for m in methods:
                for k in (1, 3, 5):
                    if recall_at(ranked[m], g["gold"], k):
                        hits[m][k] += 1

            mark = "OK" if recall_at(ranked["هجين"], g["gold"], 3) else "XX"
            pos = next((i + 1 for i, n in enumerate(ranked["هجين"])
                        if n in g["gold"]), None)
            print(f"  {mark} {g['id']:<22} الصحيح={g['gold']}  "
                  f"هجين={ranked['هجين'][:5]}  "
                  f"الرتبة={pos if pos else '—'}")
            if not recall_at(ranked["هجين"], g["gold"], 3):
                failures.append((g, ranked))
        if "--sweep" in sys.argv:
            sweep(r, srv)
    finally:
        srv.stop()

    n = len(GOLDEN)
    print("\n" + "=" * 62)
    print(f"{'الطريقة':<12}{'recall@1':>12}{'recall@3':>12}{'recall@5':>12}")
    print("-" * 62)
    for m in methods:
        print(f"{m:<12}"
              + "".join(f"{hits[m][k]}/{n} ({hits[m][k]/n*100:>3.0f}%)".rjust(12)
                        for k in (1, 3, 5)))
    print("=" * 62)

    r3 = hits["هجين"][3] / n
    print(f"\nبوابة ② — recall@3 للهجين: {r3*100:.0f}%")
    if r3 >= 0.9:
        print("النتيجة: عبرنا. المسترجِع صالح للبناء فوقه.")
    elif r3 >= 0.7:
        print("النتيجة: مقبول بتحفّظ — راجع الإخفاقات قبل المضيّ.")
    else:
        print("النتيجة: لم نعبر. أصلح الاسترجاع قبل بناء أي شيء فوقه.")

    if failures:
        print("\n--- الإخفاقات ---")
        for g, ranked in failures:
            print(f"\n{g['id']}: «{g['clause'][:60]}...»")
            print(f"  المتوقّع: {g['gold']}")
            for m in ("معجمي", "دلالي", "هجين"):
                print(f"  {m:<8}: {ranked[m]}")
            for n_ in g["gold"]:
                a = r.by_no.get(n_)
                if a:
                    print(f"  نصّ ({n_}): {a['text'][:110]}...")


if __name__ == "__main__":
    main()
