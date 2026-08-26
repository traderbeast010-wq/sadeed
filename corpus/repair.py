#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
إصلاح النصّ المستخرَج من PDFs القوانين العُمانية الرسمية.

هذه الملفات تستخدم خطوطاً عربية قديمة بخريطة ترميز ناقصة، فينتج عن الاستخراج:
  • محارف بدل زائدة (U+FFFD) تُدسّ بين الحروف
  • تطويل (kashida) داخل الكلمات:  المــادة
  • همزات مضاعفة:  الأأول ← الأول
  • علامات اتجاه ثنائي (U+202A..U+202E) تحيط كل سطر
  • أرقام عربية-هندية ممزوجة بترتيب بصري معكوس
"""

import re
import unicodedata

TATWEEL = "ـ"
BIDI_MARKS = "".join(chr(c) for c in
                     [0x200E, 0x200F, 0x202A, 0x202B, 0x202C, 0x202D,
                      0x202E, 0x2066, 0x2067, 0x2068, 0x2069, 0x061C])
ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩"
EXT_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹"


def repair(text: str) -> str:
    """يعيد النصّ الخام المستخرَج إلى عربية سليمة."""
    # 1) احذف محارف البدل الزائدة التي يدسّها الخط
    text = text.replace("�", "")

    # 2) احذف علامات الاتجاه الثنائي
    text = text.translate({ord(c): None for c in BIDI_MARKS})

    # 3) احذف التطويل (kashida) — زخرفة بصرية لا معنى لها
    text = text.replace(TATWEEL, "")

    # 4) اطوِ الهمزات المضاعفة الناتجة عن ترميز الخط
    for ch in ("أ", "آ", "إ", "ؤ", "ئ"):  # أ آ إ ؤ ئ
        text = re.sub(f"{ch}{{2,}}", ch, text)

    # 5) وحّد المسافات
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def to_western_digits(text: str) -> str:
    """يحوّل الأرقام العربية-الهندية إلى غربية للمعالجة البرمجية."""
    table = {}
    for i, ch in enumerate(ARABIC_INDIC):
        table[ord(ch)] = str(i)
    for i, ch in enumerate(EXT_ARABIC_INDIC):
        table[ord(ch)] = str(i)
    return text.translate(table)


def normalize_for_search(text: str) -> str:
    """تطبيع للبحث والاسترجاع فقط — لا يُستخدم للنصّ المعروض."""
    text = repair(text)
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[ً-ْٰ]", "", text)       # تشكيل
    text = re.sub(r"[آأإٱ]", "ا", text)  # آأإٱ ← ا
    text = text.replace("ة", "ه")                  # ة ← ه
    text = text.replace("ى", "ي")                  # ى ← ي
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


if __name__ == "__main__":
    import sys
    src = sys.argv[1] if len(sys.argv) > 1 else "law53.txt"
    raw = open(src, encoding="utf-8").read()
    fixed = repair(raw)

    print(f"قبل الإصلاح : {len(raw):,} محرف")
    print(f"بعد الإصلاح : {len(fixed):,} محرف")
    print(f"محارف محذوفة: {len(raw) - len(fixed):,}")
    print()

    # عدّ المواد بعد الإصلاح
    arts = re.findall(r"المادة\s*\(\s*[\)\(]?\s*([٠-٩0-9]+)", fixed)
    print(f"عدد المواد المكتشفة: {len(arts)}")
    if arts:
        nums = [int(to_western_digits(a)) for a in arts]
        print(f"أرقام المواد: من {min(nums)} إلى {max(nums)}")
        missing = sorted(set(range(1, max(nums) + 1)) - set(nums))
        print(f"مواد مفقودة ({len(missing)}): {missing[:25]}")
    print()
    print("=" * 70)
    print("عيّنة بعد الإصلاح:")
    print("=" * 70)
    print(fixed[:1400])
