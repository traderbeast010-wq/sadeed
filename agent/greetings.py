#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ردود التحيّات — حتمية، بلا نموذج.

لماذا بلا نموذج؟ لسببين، كلاهما ظهر عملياً:

١. الصحّة. ردّ التحية معروف سلفاً في العربية: «أهلاً» تُردّ بـ«أهلاً وسهلاً»
   لا بـ«وعليكم السلام». حين تركنا النموذج يخمّن، عمّم أقرب مثال رآه في
   البرومبت على كل التحيّات، فردّ «وعليكم السلام» على «أهلاً» و«من أنت».

٢. السرعة. التوليد على هذا الجهاز 7–9 توكن/ث، فردّ من 60 توكن يكلّف
   ~8 ثوانٍ. الجدول يردّ في **صفر** ثانية.

الردّ يُبنى من شقّين: تحية مقابلة ثابتة، ثم سطر متابعة **مبنيّ على حالة
العقد المعروض** — فيبقى الردّ حيّاً وسياقياً رغم أنه حتميّ.
"""

import re

# (النمط، الردّ المقابل) — الترتيب مهمّ: الأخصّ أولاً.
PAIRS = [
    (r"^(?:ال)?سلام\s*عليكم(?:\s*ورحم[ةه]\s*الله)?(?:\s*وبركاته)?",
     "وعليكم السلام ورحمة الله وبركاته"),
    (r"^وعليكم\s*(?:ال)?سلام", "وعليكم السلام"),
    (r"^صباح\s*(?:الخير|النور|الفل|الورد)", "صباح النور"),
    (r"^مساء\s*(?:الخير|النور|الفل|الورد)", "مساء النور"),
    (r"^(?:أهلا|اهلا|أهلاً|اهلاً|هلا|هلاً|يا\s*هلا|مرحبا|مرحباً|مرحبتين)",
     "أهلاً وسهلاً"),
    (r"^(?:حياك|حياكم)\s*الله", "الله يحييك"),
    (r"^(?:تحية|تحياتي)", "وتحية لك"),
    (r"^كيف\s*(?:حالك|الحال|حالكم)|^شلونك|^شخبارك|^كيفك",
     "بخير والحمد لله"),
    (r"^(?:شكرا|شكراً|مشكور|مشكوراً|ممنون|يعطيك\s*العافية|تسلم|جزاك\s*الله)",
     "العفو"),
    (r"^(?:مع\s*السلامة|في\s*أمان\s*الله|باي|إلى\s*اللقاء|الى\s*اللقاء|"
     r"وداعا|وداعاً)", "في أمان الله"),
    (r"^(?:good\s*morning)", "صباح النور"),
    (r"^(?:good\s*evening)", "مساء النور"),
    (r"^(?:hi|hello|hey|greetings)\b", "أهلاً وسهلاً"),
    (r"^(?:thanks|thank\s*you|thx)\b", "العفو"),
    (r"^(?:bye|goodbye|see\s*you)\b", "في أمان الله"),
]

COMPILED = [(re.compile(p, re.IGNORECASE), r) for p, r in PAIRS]

# تحيّات الوداع لا يُعرض بعدها مساعدة
FAREWELL = re.compile(r"^(?:مع\s*السلامة|في\s*أمان\s*الله|باي|إلى\s*اللقاء|"
                      r"الى\s*اللقاء|وداعا|وداعاً|bye|goodbye|see\s*you)",
                      re.IGNORECASE)


def match_greeting(message: str):
    """يعيد التحية المقابلة، أو None إن لم تكن تحية."""
    m = message.strip()
    # نتسامح مع علامات الترقيم والألقاب البسيطة بعد التحية
    m = re.sub(r"[،,.!؟?]+\s*$", "", m)
    m = re.sub(r"\s+(?:يا\s*)?(?:أستاذ|استاذ|دكتور|أخي|اخي|صديقي)\s*$", "", m)
    if len(m) > 40:                 # تحية طويلة = غالباً جملة فيها سؤال
        return None
    for pat, reply in COMPILED:
        if pat.match(m):
            return reply
    return None


def follow_up(report) -> str:
    """
    سطر المتابعة — مبنيّ على حالة العقد المعروض لا عبارة جاهزة.
    هذا ما يجعل الردّ الحتميّ يبدو حيّاً وسياقياً.
    """
    if not report:
        return "كيف أساعدك؟"
    s = report.get("summary") or {}
    v = s.get("مخالف", 0)
    d = s.get("ناقص", 0)
    name = report.get("filename", "")

    grade = (report.get("score") or {}).get("grade")
    tag = f" (التقييم: {grade})" if grade else ""

    if v and d:
        return (f"العقد المعروض فيه {v} بنداً مخالفاً و{d} ناقصاً{tag}. "
                f"تحب أشرح أياً منها؟")
    if v:
        return (f"العقد المعروض فيه {v} "
                f"{'بند مخالف' if v == 1 else 'بنود مخالفة'}{tag}. "
                f"تحب أشرح أياً منها؟")
    if d:
        return f"العقد المعروض فيه {d} بنداً ناقصاً{tag}. تحب أستعرضها؟"
    if name:
        return (f"العقد «{name}» مدقَّق ولم يظهر فيه ما يخالف المواد "
                f"المتاحة{tag}. اسأل عن أي بند فيه.")
    return "كيف أساعدك في العقد المعروض؟"


# ── أسئلة عن حالة الجلسة ───────────────────────────────────────────────────
# «احنا وين؟» «وين وصلنا؟» «ايش صار؟» «لخّص لي».
#
# صنف كامل كان ناقصاً. جوابه — مثل التحيّة — **معروف سلفاً من بيانات
# عندنا**: أي عقد معروض، وكم بنداً، وما الأحكام، وعمّ سُئل قبل قليل.
# تشغيل نموذج ليخمّنه بطيء وعرضة للخطأ، بينما البناء المباشر فوريّ ودقيق.
#
# ملاحظة: المستخدم يكتب بالعامية الخليجية، والأنماط تغطّيها صراحةً.
# لا نشترط نهاية الجملة بعد الفعل — «لخّص لي التحليل» و«وش صار في التحليل»
# يتبعهما كلام. نسمح بذيل قصير (حتى 3 كلمات) بعد المفتاح.
_TAIL = r"(?:\s+\S+){0,3}"
SESSION = re.compile(
    r"^\s*(?:"
    r"(?:إ|ا)?حنا\s*وين|وين\s*(?:إ|ا)?حنا|"
    r"وين\s*(?:وصلنا|صرنا|وقفنا|كنا)|"
    r"(?:ما|وش|إيش|ايش|شو|شنو)\s*(?:صار|سوينا|عملنا|الوضع|الأخبار|الاخبار)"
    + _TAIL + r"|"
    r"(?:ما|إيش|ايش|وش)\s*(?:هو\s*)?(?:الملخّص|الملخص)" + _TAIL + r"|"
    r"(?:لخّص|لخص)" + _TAIL + r"|"
    r"(?:أين|اين)\s*(?:وصلنا|نحن)|"
    r"(?:ما|ماذا)\s*(?:الذي\s*)?(?:حدث|جرى|أنجزنا|انجزنا)" + _TAIL + r"|"
    r"where\s*(?:are\s*we|were\s*we)|what.s\s*(?:the\s*)?status"
    r")\s*[؟?!.،]*\s*$",
    re.IGNORECASE,
)

VERDICT_ORDER = ("مخالف", "ناقص", "سليم", "لا مادة ذات صلة")


def session_reply(report, history=None):
    """يبني ملخّص حالة الجلسة من التقرير وسجلّ المحادثة — بلا نموذج."""
    if not report:
        return ("لم يُرفع عقد بعد. ارفع عقداً من الصفحة الرئيسية ثم اسألني "
                "عن أي بند فيه.")

    s = report.get("summary") or {}
    sc = report.get("score") or {}
    grade = sc.get("grade")
    overall = sc.get("overall")
    # عقد «خارج النطاق» درجته None — لا نطبع «None من 100» بل التقييم نصّاً.
    if overall is None:
        score_txt = f"والتقييم «{grade}»" if grade else "بلا درجة تنطبق"
    else:
        score_txt = (f"والدرجة {overall} من 100"
                     + (f" ({grade})" if grade else ""))
    parts = [f"نحن في تقرير تدقيق العقد «{report.get('filename', '')}»: "
             f"{report.get('clause_count', 0)} بنداً، {score_txt}."]

    breakdown = "، ".join(f"{s[v]} {v}" for v in VERDICT_ORDER if s.get(v))
    if breakdown:
        parts.append(f"التوزيع: {breakdown}.")

    # نستبعد التحيّات وأسئلة الجلسة نفسها — «أهلاً» ليست سؤالاً سُئل عنه
    asked = [t.get("content", "").strip()
             for t in (history or []) if t.get("role") == "user"]
    asked = [q for q in asked
             if q and not SESSION.match(q) and match_greeting(q) is None]
    if asked:
        last = asked[-2:] if len(asked) > 1 else asked[-1:]
        parts.append("وسألتَ قبل قليل عن: " + " · ".join(last) + ".")

    worst = next((c for c in report.get("clauses", [])
                  if c.get("verdict") == "مخالف"), None)
    if worst:
        arts = "، ".join(str(x["article_no"])
                         for x in worst.get("citations", []))
        head = worst.get("heading") or worst.get("clause_id")
        parts.append(f"أقرب مخالفة للشرح: {head}"
                     + (f" — المادة ({arts})" if arts else "") + ".")
    parts.append("تحب أشرح بنداً معيناً؟")
    return " ".join(parts)


def is_session(message: str) -> bool:
    return bool(SESSION.match(message.strip()))


def canned_reply(message: str, report=None):
    """
    يعيد الردّ الكامل إن كانت تحية، وإلا None.
    صفر استدعاءات للنموذج — الردّ فوريّ.
    """
    greeting = match_greeting(message)
    if greeting is None:
        return None
    if FAREWELL.match(message.strip()):
        return f"{greeting}. سعدت بمساعدتك."
    return f"{greeting}. {follow_up(report)}"


if __name__ == "__main__":
    demo = {"summary": {"مخالف": 4, "ناقص": 0, "سليم": 3,
                        "لا مادة ذات صلة": 1},
            "filename": "demo_contract.txt"}
    for t in ["السلام عليكم", "أهلا", "هلا", "مرحبا", "صباح الخير",
              "مساء الخير", "كيف حالك", "شكراً", "مع السلامة", "hi",
              "من أنت", "كم ساعة عمل يجيزها القانون؟"]:
        r = canned_reply(t, demo)
        print(f"  {t:<32} → {r if r else '(ليست تحية — يمرّ للنموذج)'}")
