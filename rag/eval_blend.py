#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تحصين معامل المزج (alpha) عبر أنواع عقود مختلفة.

المعامل 0.65 عُوير على عقد عمل واحد. هذا يقيسه على بنود من ثلاثة أنواع:
عمل · إيجار · تجاري — فإن بقيت النافذة نفسها، صار المعامل محصَّناً لا
مبنياً على عقد واحد.

كل حالة: نصّ بند + القانون والمادة المتوقّعان (تحقّقنا من وجودهما).

    python rag/eval_blend.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "rag"))

from llama import embedding_server   # noqa: E402
from retriever import Retriever      # noqa: E402
from router import LawRouter         # noqa: E402

LABOUR = "OM-LABOUR-53-2023"
CIVIL = "OM-CIVIL-29-2013"
COMMERCE = "OM-COMMERCE-55-1990"

# كل حالة: (نوع العقد، نصّ العقد المرجعيّ للترجيح، نصّ البند، القانون، المادة)
# نصّ العقد يمثّل السياق الذي يُشتقّ منه ثقل العقد.
CASES = [
    # ── عقود عمل ──────────────────────────────────────────────────────
    ("employment", "عقد عمل بين صاحب عمل وعامل أجر أساسي ساعات عمل إجازة",
     "يعمل الطرف الثاني اثنتي عشرة ساعة يومياً دون أجر إضافي",
     LABOUR, [70, 71]),
    ("employment", "عقد عمل صاحب العمل العامل الأجر الإجازة السنوية",
     "لا يستحق العامل أي مكافأة عن مدة خدمته عند انتهاء العقد",
     LABOUR, [61]),
    ("employment", "عقد عمل الطرف الأول صاحب العمل الطرف الثاني العامل",
     "يخضع هذا العقد للقانون الأجنبي ولو خالف النظام العام في عمان",
     CIVIL, [28]),
    # ── عقود إيجار (مدنية) ───────────────────────────────────────────
    ("lease", "عقد إيجار بين المؤجر والمستأجر لمحل تجاري الأجرة السنوية",
     "يحق للمؤجر فسخ العقد وإخلاء العين فوراً دون إنذار أو قضاء",
     CIVIL, None),   # مادة الفسخ — نقبل أي مادة من المعاملات المدنية
    ("lease", "عقد إيجار المؤجر المستأجر العين المؤجرة مدة الإيجار الأجرة",
     "يتنازل المستأجر عن أي حق في التعويض عن الإخلاء أو المنفعة التجارية",
     CIVIL, None),
    # ── عقود تجارية ──────────────────────────────────────────────────
    ("commercial", "عقد بيع تجاري بين البائع والمشتري بضاعة ثمن تسليم",
     "يسقط حق المشتري في الرجوع بأي عيب في البضاعة بمجرد تسلمها",
     COMMERCE, [118]),
    ("commercial", "عقد وكالة تجارية بين الموكل والوكيل عمولة",
     "لا يستحق الوكيل أي عمولة إلا بعد إتمام الصفقة كاملة",
     COMMERCE, None),
]


def hit_ok(hits, law, arts, k=3):
    for h in hits[:k]:
        if h["law_id"] != law:
            continue
        if arts is None or h["article_no"] in arts:
            return True
    return False


def main():
    r = Retriever()
    print(f"الكوربوس: {len(r.corpus.get('laws', []))} قانون · "
          f"{len(r.articles)} مادة")
    print(f"حالات التحصين: {len(CASES)} "
          f"(عمل {sum(1 for c in CASES if c[0]=='employment')} · "
          f"إيجار {sum(1 for c in CASES if c[0]=='lease')} · "
          f"تجاري {sum(1 for c in CASES if c[0]=='commercial')})\n")

    srv = embedding_server(ctx=4096)
    print(f"خادم التضمين جاهز في {srv.start():.1f}ث\n")
    try:
        cvecs = [srv.embed(c[1])[0] for c in CASES]
        qvecs = [srv.embed(c[2])[0] for c in CASES]
    finally:
        srv.stop()

    router = LawRouter(r.articles, r.vectors)
    n = len(CASES)

    print(f"{'alpha':>7}  " + "  ".join(f"ح{i+1}" for i in range(n)) +
          "   الإصابات")
    print("-" * 70)
    best = None
    for alpha in (0.0, 0.4, 0.5, 0.6, 0.65, 0.7, 0.8, 1.0):
        marks, hits = [], 0
        for (dom, ctext, qtext, law, arts), cv, qv in zip(CASES, cvecs, qvecs):
            w = router.blended_weights(ctext, cv, qtext, qv, alpha=alpha)
            found = r.search(qtext, qv, k=3, law_weights=w)
            ok = hit_ok(found, law, arts)
            hits += ok
            marks.append(" ✓" if ok else " ✗")
        pct = hits / n * 100
        star = ""
        if best is None or hits > best[1]:
            best = (alpha, hits)
            star = " ←"
        print(f"{alpha:>7.2f}  " + " ".join(marks) + f"   {hits}/{n} ({pct:.0f}%){star}")

    print("-" * 70)
    print(f"الأفضل: alpha={best[0]} → {best[1]}/{n}")
    print("المثبّت حالياً: 0.65")


if __name__ == "__main__":
    main()
