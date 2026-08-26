#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تفكيك العقد إلى بنود — بقواعد وregex، بلا نموذج.

لماذا بلا نموذج؟ لأن العقود العربية مبنيّة على أنماط ترقيم ثابتة، وregex
ينجزها في صفر ثانية بدقّة أعلى من نموذج 4B. وبما أن كل استدعاء للنموذج
يكلّف ~25 ثانية على هذا الجهاز، فإلغاء استدعاء المفكّك يوفّر ربع زمن العقد.

الأنماط المدعومة:
    البند الأول / البند (1) / البند 1
    المادة الأولى / المادة (1)
    أولاً / ثانياً ...
    1- / 1. / (1)
"""

import re

# ── أنماط بداية البند ──────────────────────────────────────────────────────
ORDINALS = ("الأول|الأولى|الثاني|الثانية|الثالث|الثالثة|الرابع|الرابعة|"
            "الخامس|الخامسة|السادس|السادسة|السابع|السابعة|الثامن|الثامنة|"
            "التاسع|التاسعة|العاشر|العاشرة|الحادي عشر|الحادية عشرة|"
            "الثاني عشر|الثانية عشرة|الثالث عشر|الثالثة عشرة|"
            "الرابع عشر|الرابعة عشرة|الخامس عشر|الخامسة عشرة")

ENUM_WORDS = ("أولا|أولاً|ثانيا|ثانياً|ثالثا|ثالثاً|رابعا|رابعاً|خامسا|خامساً|"
              "سادسا|سادساً|سابعا|سابعاً|ثامنا|ثامناً|تاسعا|تاسعاً|"
              "عاشرا|عاشراً|حادي عشر|ثاني عشر|ثالث عشر")

HEADINGS = [
    re.compile(rf"^\s*(?:البند|المادة|الفصل)\s+(?:{ORDINALS})\s*:?\s*$", re.M),
    re.compile(r"^\s*(?:البند|المادة)\s*[\(\)]*\s*(\d+)\s*[\(\)]*\s*:?\s*$", re.M),
    re.compile(rf"^\s*(?:{ENUM_WORDS})\s*[:\-–]\s*", re.M),
    re.compile(r"^\s*\(?(\d{1,2})\)?\s*[-–.)]\s+", re.M),
]

# عناوين لا تُعدّ بنوداً تعاقدية
SKIP_HEADS = re.compile(
    r"^\s*(?:عقد\s+عمل|بسم\s+الله|تمهيد|مقدمة|الطرف\s+الأول|الطرف\s+الثاني|"
    r"بين\s+كل\s+من|توقيع|التوقيعات|حرر\s+هذا)", re.M)

MIN_CLAUSE_CHARS = 40
MAX_CLAUSE_CHARS = 1500

# عنوان البند نفسه لا يحمل معنى قانونياً، ووجوده في نصّ الاستعلام يميّع
# الاسترجاع. نفصله ونحتفظ به كعنوان.
HEAD_PREFIX = re.compile(
    rf"^\s*(?:(?:البند|المادة|الفصل)\s+(?:{ORDINALS})|"
    rf"(?:البند|المادة)\s*[\(\)]*\s*\d+\s*[\(\)]*|"
    rf"(?:{ENUM_WORDS}))\s*[:\-–]?\s*")

# كتلة التواقيع في نهاية العقد ليست بنداً تعاقدياً
SIGNATURE_BLOCK = re.compile(
    r"(حرر\s+هذا\s+العقد|حُرّر\s+هذا\s+العقد|وعلى\s+ذلك\s+جرى\s+التوقيع|"
    r"التوقيعات?\s*$|الطرف\s+الأول\s+الطرف\s+الثاني)")


def _boundaries(text: str):
    """مواضع بداية كل بند مرشّح، مرتّبة وبلا تكرار."""
    marks = set()
    for pat in HEADINGS:
        for m in pat.finditer(text):
            marks.add(m.start())
    return sorted(marks)


def _split_long(chunk: str):
    """يقسّم كتلة طويلة على حدود الفقرات إن تجاوزت الحد."""
    if len(chunk) <= MAX_CLAUSE_CHARS:
        return [chunk]
    parts, cur = [], ""
    for para in re.split(r"\n\s*\n", chunk):
        if len(cur) + len(para) > MAX_CLAUSE_CHARS and cur:
            parts.append(cur.strip())
            cur = para
        else:
            cur = f"{cur}\n\n{para}" if cur else para
    if cur.strip():
        parts.append(cur.strip())
    return parts


def parse_clauses(text: str):
    """
    نصّ العقد ← [{clause_id, text}]

    إن لم يجد ترقيماً، يرجع إلى التقسيم على الفقرات — أفضل من الفشل الصامت.
    """
    text = re.sub(r"[ \t]+", " ", text).strip()
    marks = _boundaries(text)

    chunks = []
    if len(marks) >= 2:
        marks.append(len(text))
        for i in range(len(marks) - 1):
            chunks.append(text[marks[i]:marks[i + 1]])
        # ما قبل أول عنوان = ديباجة، تُهمل
    else:
        chunks = re.split(r"\n\s*\n", text)

    clauses = []
    for c in chunks:
        c = c.strip()
        if len(c) < MIN_CLAUSE_CHARS or SKIP_HEADS.match(c):
            continue
        for piece in _split_long(c):
            piece = re.sub(r"\s*\n\s*", " ", piece).strip()

            # افصل العنوان عن النصّ — العنوان للعرض والنصّ للاسترجاع
            head = ""
            m = HEAD_PREFIX.match(piece)
            if m:
                head = m.group(0).strip(" :-–")
                piece = piece[m.end():].strip()

            # اقطع عند كتلة التواقيع
            sig = SIGNATURE_BLOCK.search(piece)
            if sig:
                piece = piece[:sig.start()].strip()

            if len(piece) >= MIN_CLAUSE_CHARS:
                clauses.append({
                    "clause_id": f"c{len(clauses) + 1}",
                    "heading": head or f"البند {len(clauses) + 1}",
                    "text": piece,
                })
    return clauses
