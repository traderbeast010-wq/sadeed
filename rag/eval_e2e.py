#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
المرحلة ٢.٥ — التقييم من طرف إلى طرف بمسترجِع حقيقي.

في البوابة ① أعطينا النموذج المواد يدوياً وحصلنا على دقّة 100%. هنا نستبدل
المسترجِع اليدوي بالحقيقي ونقيس مرّة أخرى. الفرق بين الرقمين = خطأ الاسترجاع
معزولاً — وهو الرقم الوحيد القابل للدفاع أمام لجنة تحكيم.

المجموعة متوازنة عمداً: مجموعة كلها مخالفات يمكن أن يجتازها نموذج يقول
"مخالف" دائماً.

    python rag/eval_e2e.py
"""

import json
import os
import statistics
import sys
import time

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "rag"))
sys.path.insert(0, os.path.join(ROOT, "agent"))

from llama import embedding_server, llm_server   # noqa: E402
from retriever import Retriever                  # noqa: E402
from validator import validate_clause            # noqa: E402
from guard import apply_guard                    # noqa: E402

TOP_K = int(os.environ.get("LAWMIND_TOP_K", "3"))

CASES = [
    # ── مخالفات ────────────────────────────────────────────────────────
    ("مخالف_ساعات", "يلتزم الطرف الثاني بالعمل لمدة اثنتي عشرة ساعة يومياً، "
     "بواقع ستة أيام في الأسبوع.", "مخالف", [70, 71]),
    ("مخالف_إضافي", "يحق لصاحب العمل تكليف الطرف الثاني بساعات عمل إضافية "
     "دون حد أقصى ودون مقابل مالي.", "مخالف", [71]),
    ("مخالف_إجازة", "يستحق الطرف الثاني إجازة سنوية مدفوعة الأجر مقدارها "
     "خمسة عشر يوماً عن كل سنة خدمة كاملة.", "مخالف", [78, 81]),
    ("مخالف_اختبار", "يخضع الطرف الثاني لفترة اختبار مدتها ستة أشهر، قابلة "
     "للتجديد مرة أخرى بقرار من صاحب العمل.", "مخالف", [37]),
    ("مخالف_مرضية", "لا يستحق الطرف الثاني أي أجر عن أيام انقطاعه عن العمل "
     "بسبب المرض مهما كانت مدتها.", "مخالف", [82]),
    ("مخالف_مكافأة", "لا يستحق الطرف الثاني أي مكافأة عن مدة خدمته عند "
     "انتهاء هذا العقد لأي سبب من الأسباب.", "مخالف", [61]),
    ("مخالف_لغة", "يحرر هذا العقد باللغة الإنجليزية فقط، ويعتد بالنسخة "
     "الإنجليزية وحدها عند الاختلاف.", "مخالف", [33]),
    ("مخالف_مدة", "مدة هذا العقد سبع سنوات محددة، وينتهي بانتهائها دون حاجة "
     "إلى إخطار.", "مخالف", [35]),
    ("مخالف_خاصة", "لا يستحق الطرف الثاني أي إجازة بمناسبة زواجه أو ولادة "
     "طفله أو وفاة أحد أقاربه.", "مخالف", [84]),
    ("مخالف_رضاعة", "لا تمنح العاملة المرضعة أي وقت لرعاية طفلها خلال ساعات "
     "الدوام الرسمي.", "مخالف", [76]),
    # ── بنود سليمة ─────────────────────────────────────────────────────
    ("سليم_إجازة", "يستحق الطرف الثاني إجازة سنوية مدفوعة الأجر مقدارها "
     "ثلاثون يوماً عن كل سنة خدمة كاملة.", "سليم", [78]),
    ("سليم_ساعات", "لا تزيد ساعات عمل الطرف الثاني على ثماني ساعات في اليوم "
     "الواحد، وأربعين ساعة في الأسبوع.", "سليم", [70]),
    ("سليم_اختبار", "تحدد فترة اختبار الطرف الثاني بثلاثة أشهر، ولمرة واحدة "
     "فقط لدى صاحب العمل نفسه.", "سليم", [37]),
    # ── خارج نطاق القانون ──────────────────────────────────────────────
    ("لا_مادة_سيارة", "يكون لون السيارة المخصّصة للطرف الثاني أبيض، ويلتزم "
     "بغسلها مرّة كل أسبوعين على نفقته الخاصة.", "لا مادة ذات صلة", []),
    ("لا_مادة_زيّ", "يلتزم الطرف الثاني بارتداء ربطة عنق زرقاء اللون في "
     "اجتماعات مجلس الإدارة.", "لا مادة ذات صلة", []),
]


def main():
    r = Retriever()
    print(f"الكوربوس: {r.corpus['law_name']} — {len(r.articles)} مادة")
    print(f"الحالات : {len(CASES)}  "
          f"(مخالف {sum(1 for c in CASES if c[2]=='مخالف')} · "
          f"سليم {sum(1 for c in CASES if c[2]=='سليم')} · "
          f"لا مادة {sum(1 for c in CASES if c[2]=='لا مادة ذات صلة')})")
    print(f"top_k   : {TOP_K}\n")

    # ── الطور ١: التضمين والاسترجاع (خادم التضمين وحده) ────────────────
    print("الطور ١ — التضمين والاسترجاع")
    srv = embedding_server(ctx=4096)
    print(f"  خادم التضمين جاهز في {srv.start():.1f}ث")
    try:
        t0 = time.perf_counter()
        vecs = srv.embed([c[1] for c in CASES])
        print(f"  ضُمّنت {len(vecs)} بنود في {time.perf_counter()-t0:.1f}ث")
    finally:
        srv.stop()
        print("  أُوقف خادم التضمين (تحرير الذاكرة)\n")

    retrieved = [r.search(c[1], v, k=TOP_K) for c, v in zip(CASES, vecs)]
    art_vecs = {a["article_no"]: r.vectors[i]
                for i, a in enumerate(r.articles)}

    # فحص الاسترجاع وحده
    ret_ok = sum(1 for (cid, cl, ev, gold), hits in zip(CASES, retrieved)
                 if not gold or any(h["article_no"] in gold for h in hits))
    print(f"استرجاع: {ret_ok}/{len(CASES)} أصاب المادة الصحيحة ضمن top-{TOP_K}\n")

    # ── الطور ٢: التدقيق (خادم الاستدلال وحده) ─────────────────────────
    print("الطور ٢ — التدقيق")
    lsrv = llm_server(ctx=2048)
    print(f"  خادم الاستدلال جاهز في {lsrv.start():.1f}ث\n")

    rows, cosines = [], {"correct": [], "wrong": []}
    try:
        for (cid, clause, expect, gold), hits, qv in zip(CASES, retrieved, vecs):
            t0 = time.perf_counter()
            parsed, timings = validate_clause(lsrv, clause, hits)
            g = apply_guard(parsed, hits, clause_vec=qv, article_vecs=art_vecs)
            dt = time.perf_counter() - t0

            ok = g.verdict == expect
            cited_ok = (not gold) or any(a in gold for a in g.article_numbers) \
                or not g.article_numbers
            qv_n = np.asarray(qv, dtype=np.float32)
            qv_n = qv_n / max(float(np.linalg.norm(qv_n)), 1e-9)
            for a in g.article_numbers:
                cos = float(art_vecs[a] @ qv_n)
                cosines["correct" if a in gold else "wrong"].append(cos)

            rows.append({
                "id": cid, "expect": expect, "got": g.verdict, "ok": ok,
                "gold": gold, "cited": g.article_numbers,
                "cited_ok": cited_ok, "guard": g.log,
                "needs_review": g.needs_review, "sec": dt,
                "prefill": timings.get("prompt_per_second", 0),
                "p_tok": timings.get("prompt_n", 0),
            })
            mark = "OK" if ok else "XX"
            flag = " ⚑" if g.needs_review else ""
            print(f"  {mark} {cid:<16} {dt:>5.1f}ث  ({rows[-1]['p_tok']:>4}tk)  "
                  f"متوقّع={expect:<16} فعلي={g.verdict:<16} "
                  f"استشهاد={g.article_numbers}{flag}")
            for line in g.log:
                print(f"       🛡 {line}")
    finally:
        lsrv.stop()

    # ── التقرير ────────────────────────────────────────────────────────
    n = len(rows)
    acc = sum(r_["ok"] for r_ in rows) / n
    print("\n" + "=" * 74)
    print("الخلاصة")
    print("=" * 74)
    by = {}
    for r_ in rows:
        by.setdefault(r_["expect"], []).append(r_["ok"])
    for k, v in by.items():
        print(f"  {k:<18} {sum(v)}/{len(v)}  ({sum(v)/len(v)*100:>3.0f}%)")
    print(f"\n  الدقّة الكلّية      {sum(r_['ok'] for r_ in rows)}/{n}  "
          f"({acc*100:.0f}%)")
    print(f"  استرجاع صحيح       {ret_ok}/{n}")
    print(f"  زمن البند          {statistics.mean(r_['sec'] for r_ in rows):.1f}ث")
    print(f"  توكنات البرومبت    {statistics.mean(r_['p_tok'] for r_ in rows):.0f}")
    print(f"  تدخّلات الحارس     {sum(1 for r_ in rows if r_['guard'])}")
    print(f"  يتطلّب مراجعة      {sum(1 for r_ in rows if r_['needs_review'])}")

    print("\n  البوابة ① (مواد يدوية)  = 100%")
    print(f"  المرحلة ٢.٥ (استرجاع حقيقي) = {acc*100:.0f}%")
    print(f"  ← خطأ الاسترجاع المعزول  = {(1-acc)*100:.0f} نقطة مئوية")

    if cosines["correct"]:
        print(f"\n  معايرة الحارس ②:")
        print(f"    استشهاد صحيح: متوسّط {statistics.mean(cosines['correct']):.3f}  "
              f"أدنى {min(cosines['correct']):.3f}")
    if cosines["wrong"]:
        print(f"    استشهاد خاطئ: متوسّط {statistics.mean(cosines['wrong']):.3f}  "
              f"أقصى {max(cosines['wrong']):.3f}")

    bad = [r_ for r_ in rows if not r_["ok"]]
    if bad:
        print("\n--- الإخفاقات ---")
        for r_ in bad:
            print(f"  {r_['id']}: متوقّع {r_['expect']} · فعلي {r_['got']} · "
                  f"الصحيح {r_['gold']} · استشهد {r_['cited']}")

    with open(os.path.join("bench", "e2e_results.json"), "w",
              encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print("\nحُفظت النتائج في bench/e2e_results.json")


if __name__ == "__main__":
    main()
