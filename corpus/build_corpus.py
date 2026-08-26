#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
بناء كوربوس القوانين العُمانية.

يقرأ PDF القانون → يصلح تلف الخط → يقطّعه إلى مواد → يخرج JSON.

المخطّط متعدّد القوانين من البداية: إضافة قانون جديد = تشغيل السكربت بمعطيات
جديدة، لا إعادة بناء.

    python corpus/build_corpus.py --pdf <path> --law-id OM-LABOUR-53-2023 \
        --law-name "قانون العمل" --decree "53/2023"
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from repair import repair, to_western_digits, normalize_for_search  # noqa: E402

# عنوان المادة: «المادة ) ) 74». الأقواس معكوسة بفعل الترميز ثنائي الاتجاه.
#
# لا نشترط نهاية السطر: في بعض القوانين (المعاملات المدنية مثلاً) يُقحم
# العنوان **داخل** سطر نصّ المادة السابقة بفعل تخطيط الصفحة:
#
#     ...والمفقودين قانون الشخص
#     المادة ) ) 17 الذي تجب حمايته .      ← «الذي تجب حمايته» ذيل المادة 16
#      - 1يسري على الميراث...              ← وهنا تبدأ 17 فعلاً
#
# اشتراط نهاية السطر كان يُسقط 120 مادة من 1086 في ذلك القانون وحده.
# التمييز عن الإحالات يتكفّل به فلترا «من هذا القانون» والتصاعد.
# التمييز الحاسم عن الإحالة في ما **يلي** الرقم لا فيما يسبقه:
#     عنوان : «) ) 201⏎»   أو  «) ) 17 الذي»   ← يتبعه فراغ أو سطر
#     إحالة : «) )208وإلا»  أو  «) )61من هذا»   ← يتبعه حرف عربي ملتصق
# بدون هذا الشرط ظنّ النظام الإحالة «) )208وإلا» عنواناً، فقفز العدّاد
# التصاعدي إلى 208 ورفض المواد 202–207 التي تليها في النصّ.
ARTICLE_HDR = re.compile(r"المادة\s*\)[\s‌]*\)\s*(\d+)(?=\s)")

# بنية القانون: الباب والفصل
BOOK_HDR = re.compile(r"^\s*(الباب\s+\S+)\s*$", re.M)
CHAPTER_HDR = re.compile(r"^\s*(الفصل\s+\S+)\s*$", re.M)

# «من هذا القانون» بعد الرقم ⇒ إحالة لا عنوان
REFERENCE_TAIL = re.compile(r"^\s*من\s+(هذا|القانون)")


def extract_pdf_text(pdf_path: str) -> str:
    """يستخرج النصّ عبر pdftotext -layout (أدقّ من غيره مع هذه الملفات)."""
    with tempfile.TemporaryDirectory() as td:
        # اسم لاتيني: أسماء الملفات العربية تكسر ترميز بعض الأدوات
        tmp_pdf = os.path.join(td, "in.pdf")
        tmp_txt = os.path.join(td, "out.txt")
        with open(pdf_path, "rb") as src, open(tmp_pdf, "wb") as dst:
            dst.write(src.read())
        subprocess.run(
            ["pdftotext", "-enc", "UTF-8", "-layout", tmp_pdf, tmp_txt],
            check=True, capture_output=True,
        )
        with open(tmp_txt, encoding="utf-8") as f:
            return f.read()


def clean_body(text: str) -> str:
    """ينظّف نصّ المادة من آثار التخطيط في الـPDF."""
    text = text.replace("\x0c", "\n")                 # فواصل الصفحات
    # النسب المئوية تُعكس فيصير الرمز قبل الرقم:  ) )%25  ←  (25%)
    text = re.sub(r"\)\s*\)\s*%\s*(\d+)", r"(\1%) ", text)
    text = re.sub(r"\)\s*\)\s*(\d+)", r"(\1) ", text)  # ) )8  ←  (8)
    text = re.sub(r"\)\s*\)", "", text)                # بقايا أقواس معكوسة
    # بنود قائمة معكوسة:  - )7(1 سبعة أيام  ←  1- (7) سبعة أيام
    # ملاحظة: الرقم الثاني قد يلتصق بالكلمة التالية بلا مسافة — )7(1سبعة
    text = re.sub(r"-\s*\)(\d+)\((\d+)(?!\d)", r"\2- (\1) ", text)
    # قوس فاصلة معكوس:  ( ،)31  ←  (31)
    text = re.sub(r"\(\s*،\s*\)(\d+)", r"(\1)", text)
    text = re.sub(r"^\s*-\s*(\d+)", r"\1-", text, flags=re.M)  # - 1  ←  1-
    text = re.sub(r"(?<=\d)-(?=\S)", "- ", text)      # 1-أن  ←  1- أن
    # رقم ملتصق بحرف عربي:  25خمسة  ←  25 خمسة
    text = re.sub(r"(\d)([ء-ي])", r"\1 \2", text)
    text = _fix_reversed_number_runs(text)
    return text


def _fix_reversed_number_runs(text: str) -> str:
    """
    قوائم أرقام المواد تُستخرج بترتيب تنازلي معكوس بفعل اتجاه النصّ:
        )،54 ،53 ،52 ،50 ،49 ،39  ←  (39، 49، 50، 52، 53، 54)
    نكتشف الجريان الطويل ونعيد ترتيبه تصاعدياً.
    """
    # الجريان قد يبدأ برقم بلا فاصلة إذا انكسر السطر:  )117 ،111 ،104
    RUN = re.compile(r"\)?\s*\d*\s*(?:،\s*\d+\s*){4,}")

    def flip(m):
        nums = re.findall(r"\d+", m.group(0))
        if nums != sorted(nums, key=int, reverse=True):
            return m.group(0)                     # ليس معكوساً — اتركه
        return " (" + "، ".join(sorted(nums, key=int)) + ") "

    text = RUN.sub(flip, text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def find_structure(text: str):
    """يبني خرائط موضع ← (الباب، الفصل) لإسناد كل مادة إلى موقعها."""
    books = [(m.start(), m.group(1).strip()) for m in BOOK_HDR.finditer(text)]
    chapters = [(m.start(), m.group(1).strip()) for m in CHAPTER_HDR.finditer(text)]

    def lookup(pos, table):
        found = None
        for at, name in table:
            if at <= pos:
                found = name
            else:
                break
        return found

    return lambda pos: (lookup(pos, books), lookup(pos, chapters))


def find_articles(western: str):
    """
    يعيد [(رقم، بداية العنوان، نهاية العنوان)] للعناوين الحقيقية فقط.

    مرشّحان يفصلان العنوان عن الإحالة:
      1. أرقام المواد تتصاعد — أي رقم أصغر من آخر مقبول فهو إحالة.
      2. ما يتبعه «من هذا القانون» إحالة قطعاً.
    """
    accepted, last_no, skipped = [], 0, []
    for m in ARTICLE_HDR.finditer(western):
        no = int(m.group(1))
        tail = western[m.end():m.end() + 40]
        if REFERENCE_TAIL.match(tail):
            skipped.append((no, "إحالة: يتبعها «من هذا القانون»"))
            continue
        if no <= last_no:
            skipped.append((no, f"إحالة: رقم غير تصاعدي بعد {last_no}"))
            continue
        accepted.append((no, m.start(), m.end()))
        last_no = no
    return accepted, skipped


def build(pdf, law_id, law_name, decree, issued):
    raw = extract_pdf_text(pdf)
    fixed = repair(raw)
    # نسخة بأرقام غربية للتحليل — التحويل ١:١ فتبقى المواضع متطابقة
    western = to_western_digits(fixed)
    assert len(western) == len(fixed), "انزاحت المواضع بعد تحويل الأرقام"

    at_pos = find_structure(fixed)
    arts, skipped = find_articles(western)

    articles = []
    for i, (no, start, end) in enumerate(arts):
        # ما تبقّى على سطر العنوان يعود للمادة **السابقة** لا لهذه —
        # فالعنوان أُقحم في وسط سطرها بفعل التخطيط.
        line_end = fixed.find("\n", end)
        if line_end == -1:
            line_end = len(fixed)
        tail_of_previous = fixed[end:line_end]
        if tail_of_previous.strip() and articles:
            prev = articles[-1]
            prev["text"] = clean_body(prev["text"] + " " + tail_of_previous)
            prev["text_normalized"] = normalize_for_search(prev["text"])
            prev["char_count"] = len(prev["text"])

        body_start = min(line_end + 1, len(fixed))
        stop = arts[i + 1][1] if i + 1 < len(arts) else len(fixed)
        body = clean_body(fixed[body_start:max(body_start, stop)])
        book, chapter = at_pos(start)
        articles.append({
            "law_id": law_id,
            "law_name": law_name,
            "decree_no": decree,
            "article_no": no,
            "book": book,
            "chapter": chapter,
            "text": body,
            "text_normalized": normalize_for_search(body),
            "char_count": len(body),
        })

    return {
        "law_id": law_id,
        "law_name": law_name,
        "decree_no": decree,
        "issued": issued,
        "source_file": os.path.basename(pdf),
        "article_count": len(articles),
        "articles": articles,
    }, skipped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--law-id", required=True)
    ap.add_argument("--law-name", required=True)
    ap.add_argument("--decree", required=True)
    ap.add_argument("--issued", default="")
    ap.add_argument("--out", default="corpus/articles.json")
    args = ap.parse_args()

    corpus, skipped = build(args.pdf, args.law_id, args.law_name,
                            args.decree, args.issued)
    arts = corpus["articles"]

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(corpus, f, ensure_ascii=False, indent=2)

    # ── تقرير الجودة ────────────────────────────────────────────────
    nums = [a["article_no"] for a in arts]
    print(f"القانون        : {corpus['law_name']} ({corpus['decree_no']})")
    print(f"المواد المستخرجة: {len(arts)}")
    print(f"المدى          : {min(nums)} → {max(nums)}")

    missing = sorted(set(range(min(nums), max(nums) + 1)) - set(nums))
    print(f"مفقود          : {missing if missing else 'لا شيء'}")
    dups = sorted({n for n in nums if nums.count(n) > 1})
    print(f"مكرّر          : {dups if dups else 'لا شيء'}")
    print(f"إحالات مستبعَدة : {len(skipped)}  {[s[0] for s in skipped]}")

    lens = [a["char_count"] for a in arts]
    print(f"طول المادة     : أقصر {min(lens)} · أطول {max(lens)} · "
          f"متوسّط {sum(lens)//len(lens)} محرف")

    empty = [a["article_no"] for a in arts if a["char_count"] < 40]
    if empty:
        print(f"⚠ مواد قصيرة مريبة: {empty}")

    books = sorted({a["book"] for a in arts if a["book"]})
    print(f"الأبواب        : {len(books)}")
    print(f"\nحُفظ في {args.out}")


if __name__ == "__main__":
    main()
