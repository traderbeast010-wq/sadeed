#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
الحارس — طبقتان تصحّحان مخرَج النموذج قبل أن يصل المستخدم.

قرار تصميميّ أساسي: النموذج يعيد **أرقام مواد فقط**، لا نصوصها. النصّ
المعروض في التقرير نأخذه من الكوربوس بأنفسنا. هذا يلغي اختلاق نصّ المادة
بنيوياً — لا يبقى إلا اختلاق الرقم، وهو ما تمسكه الطبقة الأولى.

الطبقة ①  برمجية — تمسك الاستشهاد المُختلَق:
    رقم غير مسترجَع · حكم بلا استشهاد · «لا مادة» مع استشهاد

الطبقة ②  دلالية — تمسك الاستشهاد الحقيقي غير ذي الصلة:
    ظهرت هذه الحالة في القياس: أعاد النموذج «مخالف» مستشهداً بمادة ساعات
    العمل لبند عن مكافأة نهاية الخدمة — بثقة 0.95 و٣ مرّات من ٣. المادة
    حقيقية، فالطبقة ① تمرّرها. المقارنة الدلالية بين البند والمادة تمسكها.
"""

# ── الطبقة الدلالية: معطَّلة بقرار مبنيّ على قياسين ────────────────────────
#
# القياس الأول (كوربوس قانون واحد): التوزيعان متداخلان ولا عتبة تفصلهما.
#     استشهاد صحيح: متوسّط 0.657  أدنى 0.566
#     استشهاد خاطئ: متوسّط 0.596  أقصى 0.735
# وتدخّلات الحارس عبر 15 حالة = صفر. أُبقي حينها «كشبكة أمان عند 0.45».
#
# القياس الثاني (كوربوس سبعة قوانين): كارثة. بعد إضافة اسم القانون إلى
# النصّ المضمَّن تغيّر فضاء التضمين كلّه، فهبط التشابه إلى ~0.40 للجميع.
# فخفّضت العتبةُ **خمسة أحكام صحيحة** إلى «لا مادة ذات صلة» — ومنها بند
# إجازة 15 يوماً الذي علّل النموذج مخالفته للمادة (78) تعليلاً سليماً.
#
# الدرس: آلية ثبت أنها لا تميّز **لا تصلح شبكة أمان** — تصلح مصدر أعطال،
# وتنفجر أول ما يتغيّر ما بُنيت عليه. الحماية الحقيقية في الطبقة ① وحدها:
# رقم المادة إمّا مسترجَع أو لا، وهذا فحص حتميّ لا يحتاج معايرة.
#
# لإعادة تفعيلها لاحقاً: عايِر العتبات على فضاء التضمين الحالي أولاً
# (rag/eval_e2e.py يطبع توزيع التشابه للصحيح والخاطئ)، ولا تفعّلها قبل
# أن تُظهر البيانات فصلاً حقيقياً بين التوزيعين.
SEMANTIC_GUARD = False
HARD_FLOOR = 0.45
SOFT_FLOOR = 0.55
LOW_CONFIDENCE = 0.60


class GuardResult:
    __slots__ = ("verdict", "article_numbers", "reasoning", "confidence",
                 "needs_review", "log")

    def __init__(self, verdict, article_numbers, reasoning, confidence,
                 needs_review, log):
        self.verdict = verdict
        self.article_numbers = article_numbers
        self.reasoning = reasoning
        self.confidence = confidence
        self.needs_review = needs_review
        self.log = log

    def as_dict(self):
        return {
            "verdict": self.verdict,
            "article_numbers": self.article_numbers,
            "reasoning": self.reasoning,
            "confidence": self.confidence,
            "needs_review": self.needs_review,
            "guard_log": self.log,
        }


def apply_guard(parsed, hits, clause_vec=None, article_vecs=None):
    """
    parsed       مخرَج النموذج (dict) أو None إن فشل التحليل
    hits         المواد المسترجَعة لهذا البند
    clause_vec   متجه البند (مطبَّع) — اختياري، يفعّل الطبقة ②
    article_vecs {رقم المادة: متجه مطبَّع} — اختياري
    """
    log = []
    retrieved = {h["article_no"] for h in hits}

    # فشل التحليل كلياً — لا نخمّن
    if not parsed:
        return GuardResult("لا مادة ذات صلة", [],
                           "تعذّر تحليل مخرَج النموذج.", 0.0, True,
                           ["مخرَج غير صالح — خُفّض إلى «لا مادة ذات صلة»"])

    verdict = parsed.get("verdict")
    arts = [a for a in (parsed.get("article_numbers") or []) if isinstance(a, int)]
    reasoning = (parsed.get("reasoning") or "").strip()
    try:
        confidence = float(parsed.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0

    # ── الطبقة ① — برمجية ──────────────────────────────────────────────
    fake = [a for a in arts if a not in retrieved]
    if fake:
        log.append(f"استشهاد بمواد غير مسترجَعة {fake} — رُفض")
        arts = [a for a in arts if a in retrieved]

    if verdict not in ("مخالف", "ناقص", "سليم", "لا مادة ذات صلة"):
        log.append(f"حكم خارج القائمة «{verdict}» — خُفّض")
        verdict = "لا مادة ذات صلة"
        arts = []

    if verdict in ("مخالف", "ناقص", "سليم") and not arts:
        log.append(f"حكم «{verdict}» بلا استشهاد — خُفّض إلى «لا مادة ذات صلة»")
        verdict = "لا مادة ذات صلة"

    if verdict == "لا مادة ذات صلة" and arts:
        log.append(f"«لا مادة ذات صلة» مع استشهاد {arts} — أُهمل الاستشهاد")
        arts = []

    # ── الطبقة ② — دلالية ──────────────────────────────────────────────
    needs_review = False
    if SEMANTIC_GUARD and arts and clause_vec is not None and article_vecs:
        sims = {}
        for a in arts:
            v = article_vecs.get(a)
            if v is None:
                continue
            sims[a] = float(sum(x * y for x, y in zip(clause_vec, v)))
        if sims:
            best = max(sims.values())
            if best < HARD_FLOOR:
                log.append(
                    f"تطابق دلالي ضعيف جداً ({best:.2f} < {HARD_FLOOR}) بين "
                    f"البند والمادة {max(sims, key=sims.get)} — خُفّض الحكم"
                )
                verdict, arts = "لا مادة ذات صلة", []
            elif best < SOFT_FLOOR:
                log.append(f"تطابق دلالي منخفض ({best:.2f}) — يتطلّب مراجعة")
                needs_review = True

    if confidence < LOW_CONFIDENCE and verdict != "لا مادة ذات صلة":
        log.append(f"ثقة منخفضة ({confidence:.2f}) — يتطلّب مراجعة")
        needs_review = True

    return GuardResult(verdict, sorted(arts), reasoning, confidence,
                       needs_review, log)
