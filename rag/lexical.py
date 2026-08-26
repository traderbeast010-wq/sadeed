#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
البحث المعجمي العربي — تطبيع، تجذير خفيف، و BM25.

لماذا التجذير مهمّ هنا: العربية لصقية، فالعقد يقول «الموظف يشتغل» والقانون
يقول «تشغيل العامل». بلا تجذير خفيف يفشل BM25 في ربطهما، ويسقط الاسترجاع.

بلا اعتماديّات خارجية — بايثون قياسي فقط.
"""

import math
import re
from collections import Counter

# ── التطبيع ────────────────────────────────────────────────────────────────
DIACRITICS = re.compile(r"[ً-ْٰـ]")
NON_WORD = re.compile(r"[^ء-ي٠-٩a-zA-Z0-9\s]")

# كلمات وظيفية عالية التكرار لا تحمل معنى تمييزياً في النصّ القانوني
STOPWORDS = {
    "في", "من", "على", "الى", "إلى", "عن", "مع", "او", "أو", "و", "ثم",
    "ان", "أن", "إن", "لا", "ما", "لم", "لن", "قد", "كل", "بعض", "غير",
    "هذا", "هذه", "ذلك", "تلك", "التي", "الذي", "الذين", "اللاتي",
    "به", "بها", "له", "لها", "منه", "منها", "عليه", "عليها", "فيه", "فيها",
    "كان", "كانت", "يكون", "تكون", "هو", "هي", "هم", "بين", "عند", "لدى",
    "اذا", "إذا", "حتى", "بعد", "قبل", "دون", "سوى", "اي", "أي", "ايضا",
    "وفقا", "طبقا", "بشان", "بشأن", "وذلك", "كما", "حيث", "بما", "لما",
}

PREFIXES = ("وبال", "فبال", "وكال", "بال", "كال", "فال", "وال", "لل", "ال",
            "وب", "ول", "وك", "وف", "ب", "ك", "ف", "و", "ل")
SUFFIXES = ("اتهما", "اتهم", "اتها", "اتهن", "يتها", "تهما", "هما", "كما",
            "تها", "تهم", "هن", "هم", "ها", "ية", "ات", "ون", "ين", "ان",
            "وا", "تي", "ه", "ة", "ي")

# عتبات محافظة تمنع الإفراط في التجذير.
# السوابق ذات الحرف الواحد (ف، ب، ك، و، ل) هي الأخطر: «فترة» ليست «ف+ترة».
MIN_AFTER_SHORT_PREFIX = 5   # سابقة من حرف واحد — «كتابة» ليست «ك+تابة»
MIN_AFTER_LONG_PREFIX = 3    # ال، وال، بال، لل ...
MIN_AFTER_SUFFIX = 3         # يبقي ربط «ساعة/ساعات» قائماً


def normalize(text: str) -> str:
    """تطبيع الحروف: إزالة التشكيل وتوحيد الألف والتاء المربوطة والياء."""
    text = DIACRITICS.sub("", text)
    text = re.sub("[آأإٱ]", "ا", text)
    text = text.replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و")
    text = text.replace("ئ", "ي").replace("ء", "")
    text = NON_WORD.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def light_stem(word: str) -> str:
    """
    تجذير خفيف ومحافظ: يقشّر سابقة واحدة ولاحقة واحدة على الأكثر،
    ولا ينزل بالكلمة تحت ٣ حروف. الهدف ربط «العامل/عامل/للعمال» لا استخراج
    الجذر الثلاثي — فالتجذير العنيف يخلط معاني متباعدة في النصّ القانوني.
    """
    for p in PREFIXES:
        floor = MIN_AFTER_SHORT_PREFIX if len(p) == 1 else MIN_AFTER_LONG_PREFIX
        if word.startswith(p) and len(word) - len(p) >= floor:
            word = word[len(p):]
            break
    for s in SUFFIXES:
        if word.endswith(s) and len(word) - len(s) >= MIN_AFTER_SUFFIX:
            word = word[: -len(s)]
            break
    return word


def tokenize(text: str, stem: bool = True) -> list:
    """نصّ ← قائمة رموز مطبَّعة، بلا كلمات وظيفية."""
    out = []
    for w in normalize(text).split():
        if w in STOPWORDS or len(w) < 2:
            continue
        out.append(light_stem(w) if stem else w)
    return out


# ── BM25 ───────────────────────────────────────────────────────────────────
class BM25:
    """BM25 Okapi. صغير بما يكفي لـ١٥٠ مادة في الذاكرة."""

    def __init__(self, docs, k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.docs = [Counter(d) for d in docs]
        self.lengths = [sum(c.values()) for c in self.docs]
        self.avg_len = (sum(self.lengths) / len(self.lengths)) if self.docs else 0.0
        self.n = len(self.docs)

        df = Counter()
        for c in self.docs:
            df.update(c.keys())
        # صيغة IDF المُصحَّحة — تمنع القيم السالبة للكلمات شديدة الشيوع
        self.idf = {
            t: math.log(1 + (self.n - v + 0.5) / (v + 0.5)) for t, v in df.items()
        }

    def scores(self, query_tokens) -> list:
        out = [0.0] * self.n
        for t in query_tokens:
            idf = self.idf.get(t)
            if idf is None:
                continue
            for i, c in enumerate(self.docs):
                f = c.get(t)
                if not f:
                    continue
                denom = f + self.k1 * (
                    1 - self.b + self.b * self.lengths[i] / self.avg_len
                )
                out[i] += idf * (f * (self.k1 + 1)) / denom
        return out

    def top(self, query: str, k: int = 10) -> list:
        s = self.scores(tokenize(query))
        ranked = sorted(range(self.n), key=lambda i: s[i], reverse=True)
        return [(i, s[i]) for i in ranked[:k] if s[i] > 0]


if __name__ == "__main__":
    for w in ["العامل", "للعمال", "بالعقد", "تشغيل", "الموظفين", "والأجور"]:
        print(f"{w:12} → {light_stem(normalize(w))}")
