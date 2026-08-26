#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
الاختبار المعاكس: هل يصيب النظام حين يكون الجواب **خارج** قانون العمل؟

eval_multilaw.py يقيس بقاء قانون العمل مُسترجَعاً رغم الزحام. وهذا يقيس
العكس — وبدونه قد نضبط الترجيح ليرفع قانون العمل دائماً فيبدو التقييم
ممتازاً بينما النظام صار أعمى عن ستّة قوانين.

يُقاس على حالتين: بلا ترجيح، وبترجيح مشتقّ من نصّ البند نفسه (لا من عقد
عمل) — فالبند هنا تجاريّ أو مدنيّ لا عماليّ.

    python rag/eval_crosslaw.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "rag"))

from llama import embedding_server          # noqa: E402
from retriever import Retriever             # noqa: E402
from router import LawRouter                # noqa: E402
from golden_crosslaw import CROSSLAW_GOLDEN  # noqa: E402


def main():
    r = Retriever()
    print(f"الكوربوس: {len(r.corpus.get('laws', []))} قانون · "
          f"{len(r.articles)} مادة")
    print(f"حالات عابرة للقوانين: {len(CROSSLAW_GOLDEN)}\n")

    srv = embedding_server(ctx=4096)
    print(f"خادم التضمين جاهز في {srv.start():.1f}ث\n")
    try:
        qvs = [srv.embed(g["clause"])[0] for g in CROSSLAW_GOLDEN]
    finally:
        srv.stop()

    router = LawRouter(r.articles, r.vectors)
    n = len(CROSSLAW_GOLDEN)
    plain = weighted = 0

    print("=" * 76)
    for g, qv in zip(CROSSLAW_GOLDEN, qvs):
        want_law = g["gold_law"]
        want_no = g["gold"]

        def check(hits):
            return any(h["article_no"] in want_no and h["law_id"] == want_law
                       for h in hits[:3])

        h_plain = r.search(g["clause"], qv, k=3)
        # الترجيح هنا مشتقّ من نصّ البند نفسه — فهو ليس بنداً عمالياً
        w = router.weights(g["clause"], qv)
        h_w = r.search(g["clause"], qv, k=3, law_weights=w)

        ok_p, ok_w = check(h_plain), check(h_w)
        plain += ok_p
        weighted += ok_w

        top_law = max(w, key=w.get)
        top_name = router.laws[top_law]["law_name"]
        want_name = router.laws.get(want_law, {}).get("law_name", want_law)

        print(f"{'OK' if ok_w else 'XX'}  {g['id']}")
        print(f"    المطلوب : {want_name} — المادة {want_no}")
        print(f"    الموجّه : رجّح «{top_name}»"
              + ("  ✓" if top_law == want_law else "  ✗"))
        for tag, hits in (("بلا ترجيح", h_plain), ("بترجيح  ", h_w)):
            got = "، ".join(f"{h['law_name'][:18]}({h['article_no']})"
                            for h in hits)
            print(f"    {tag}: {got}")
        print()

    print("=" * 76)
    print(f"  بلا ترجيح : {plain}/{n}  ({plain/n*100:.0f}%)")
    print(f"  بترجيح    : {weighted}/{n}  ({weighted/n*100:.0f}%)")
    print("=" * 76)
    if weighted < plain:
        print("\n⚠ الترجيح أضرّ بالحالات العابرة — راجع أوزان router.py")
    elif weighted == n:
        print("\nالنظام يصيب في القوانين الأخرى كما يصيب في قانون العمل.")


if __name__ == "__main__":
    main()
