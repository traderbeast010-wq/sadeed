#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
استيعاب دفعة قوانين ودمجها في كوربوس واحد.

كل قانون يُستخرَج ويُصلَح ويُقطَّع على حدة (لأن لكل PDF نمط تلف مختلف)،
ثم تُدمج المواد في ملف واحد تحمل فيه كل مادة هويّة قانونها. المسترجِع
يعمل على المجموع، والموجّه (rag/router.py) يرجّح بحسب نوع العقد.

    python corpus/build_all.py --manifest corpus/laws.json
    python corpus/build_all.py --pdf "x.pdf" --law-id OM-CIVIL-29-2013 \
        --law-name "قانون المعاملات المدنية" --decree "29/2013" --append

ملف البيان (manifest) يصف القوانين المطلوب استيعابها:

    [
      {"pdf": "...", "law_id": "OM-LABOUR-53-2023",
       "law_name": "قانون العمل", "decree_no": "53/2023",
       "issued": "2023-07-25", "domains": ["employment"]},
      ...
    ]

`domains` وسوم حرّة يستعملها الموجّه لترجيح القوانين بحسب نوع العقد.
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_corpus import build  # noqa: E402

OUT = os.path.join("corpus", "articles.json")
LAWS_DIR = os.path.join("corpus", "laws")


def ingest_one(spec):
    """يستوعب قانوناً واحداً ويعيد (بيانات القانون، المواد، الإحالات المستبعَدة)."""
    corpus, skipped = build(spec["pdf"], spec["law_id"], spec["law_name"],
                            spec["decree_no"], spec.get("issued", ""))
    arts = corpus["articles"]
    for a in arts:
        a["domains"] = spec.get("domains", [])
    meta = {
        "law_id": spec["law_id"],
        "law_name": spec["law_name"],
        "decree_no": spec["decree_no"],
        "issued": spec.get("issued", ""),
        "domains": spec.get("domains", []),
        "article_count": len(arts),
        "source_file": os.path.basename(spec["pdf"]),
    }
    return meta, arts, skipped


def quality_report(meta, arts, skipped):
    """يطبع فحص جودة لكل قانون — لا نثق بكوربوس لم يُفحص."""
    nums = [a["article_no"] for a in arts]
    lens = [a["char_count"] for a in arts]
    missing = sorted(set(range(min(nums), max(nums) + 1)) - set(nums)) if nums else []
    dups = sorted({n for n in nums if nums.count(n) > 1})

    print(f"\n  {meta['law_name']} ({meta['decree_no']})")
    print(f"    المواد    : {len(arts)}  ({min(nums)} → {max(nums)})"
          if nums else "    المواد    : 0")
    print(f"    مفقود     : {missing if missing else 'لا شيء'}")
    print(f"    مكرّر     : {dups if dups else 'لا شيء'}")
    print(f"    إحالات    : استُبعدت {len(skipped)}")
    if lens:
        print(f"    الطول     : {min(lens)}–{max(lens)} محرف "
              f"(متوسّط {sum(lens)//len(lens)})")
    short = [a["article_no"] for a in arts if a["char_count"] < 40]
    if short:
        print(f"    ⚠ مواد قصيرة مريبة: {short}")

    flags = []
    if missing:
        flags.append(f"{len(missing)} مادة مفقودة")
    if dups:
        flags.append(f"{len(dups)} مكرّرة")
    if short:
        flags.append(f"{len(short)} قصيرة")
    return flags


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest")
    ap.add_argument("--pdf")
    ap.add_argument("--law-id")
    ap.add_argument("--law-name")
    ap.add_argument("--decree")
    ap.add_argument("--issued", default="")
    ap.add_argument("--domains", nargs="*", default=[])
    ap.add_argument("--append", action="store_true",
                    help="أضِف إلى الكوربوس الموجود بدل استبداله")
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    if args.manifest:
        with open(args.manifest, encoding="utf-8") as f:
            specs = json.load(f)
    elif args.pdf:
        specs = [{"pdf": args.pdf, "law_id": args.law_id,
                  "law_name": args.law_name, "decree_no": args.decree,
                  "issued": args.issued, "domains": args.domains}]
    else:
        sys.exit("مطلوب --manifest أو --pdf")

    laws, articles = [], []
    if args.append and os.path.exists(args.out):
        with open(args.out, encoding="utf-8") as f:
            prev = json.load(f)
        laws = prev.get("laws", [])
        articles = prev.get("articles", [])
        print(f"الكوربوس الحالي: {len(laws)} قانون · {len(articles)} مادة")

    print("=" * 70)
    print(f"استيعاب {len(specs)} قانون")
    print("=" * 70)

    problems = []
    for spec in specs:
        if not os.path.exists(spec["pdf"]):
            print(f"\n  ✗ ملف غير موجود: {spec['pdf']}")
            problems.append((spec.get("law_name", "?"), ["الملف غير موجود"]))
            continue
        try:
            meta, arts, skipped = ingest_one(spec)
        except Exception as e:                      # noqa: BLE001
            print(f"\n  ✗ {spec.get('law_name', '?')}: فشل الاستيعاب — {e}")
            problems.append((spec.get("law_name", "?"), [str(e)]))
            continue

        flags = quality_report(meta, arts, skipped)
        if flags:
            problems.append((meta["law_name"], flags))

        # استبدل القانون إن كان مستوعَباً سلفاً
        laws = [x for x in laws if x["law_id"] != meta["law_id"]]
        articles = [a for a in articles if a["law_id"] != meta["law_id"]]
        laws.append(meta)
        articles.extend(arts)

        os.makedirs(LAWS_DIR, exist_ok=True)
        with open(os.path.join(LAWS_DIR, f"{meta['law_id']}.json"),
                  "w", encoding="utf-8") as f:
            json.dump({**meta, "articles": arts}, f,
                      ensure_ascii=False, indent=2)

    corpus = {
        "laws": sorted(laws, key=lambda x: x["law_id"]),
        "law_count": len(laws),
        "article_count": len(articles),
        "articles": articles,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(corpus, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print(f"الكوربوس: {len(laws)} قانون · {len(articles)} مادة")
    for lw in corpus["laws"]:
        doms = "، ".join(lw.get("domains") or []) or "—"
        print(f"  {lw['article_count']:>4}  {lw['law_name']} "
              f"({lw['decree_no']})   [{doms}]")

    if problems:
        print("\n⚠ يحتاج مراجعتك قبل الاعتماد:")
        for name, flags in problems:
            print(f"  {name}: {'، '.join(flags)}")

    print(f"\nحُفظ في {args.out}")
    print("الخطوة التالية:  python rag/build_index.py")


if __name__ == "__main__":
    main()
