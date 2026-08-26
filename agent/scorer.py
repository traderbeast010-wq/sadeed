#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
محلّل قوة العقد — حتميّ بالكامل، بلا نموذج.

قرار تصميميّ: الدرجة **لا تأتي من النموذج**. تُحسب بقواعد ثابتة من مخرجات
المدقّق ومن فحص وجود البيانات الإلزامية. النتيجة قابلة للتفسير والتكرار:
نستطيع أن نشرح للمحامي لماذا خرجت 62 من 100 بالضبط، وسنخرج بالرقم نفسه
في كل مرّة. رقمٌ من نموذج لغوي لا يملك أياً من الصفتين.

محوران:
  ① الامتثال (60%)   — من أحكام البنود
  ② الاكتمال (40%)   — من البيانات التي توجبها **المادة (36)** من القانون

الأساس القانوني للمحور ② نصّي لا اجتهادي: المادة (36) تعدّد ما «يجب أن
يتضمنه عقد العمل بصفة خاصة».
"""

import re

COMPLIANCE_WEIGHT = 0.60
COMPLETENESS_WEIGHT = 0.40

# خصم كل حكم من درجة الامتثال
PENALTY = {"مخالف": 22, "ناقص": 10, "سليم": 0, "لا مادة ذات صلة": 0}

# ── البيانات الإلزامية — المادة (36) ───────────────────────────────────────
# لكل بند: (المعرّف، العنوان، الوزن، أنماط الكشف)
REQUIRED = [
    ("employer", "اسم صاحب العمل والمنشأة وعنوان مكان العمل", 1.0,
     r"صاحب\s+العمل|الطرف\s+الأول|المنشأة|جهة\s+العمل"),
    ("worker", "اسم العامل وبياناته الشخصية", 1.0,
     r"العامل|الطرف\s+الثاني|الموظف|جنسي|محل\s+الإقامة|تاريخ\s+الميلاد"),
    ("job", "نوع العمل وشروطه ومدة العقد", 1.5,
     r"نوع\s+العمل|المسمى\s+الوظيفي|الوظيفة|مهنة|مدة\s+(?:هذا\s+)?العقد|"
     r"طبيعة\s+العمل"),
    ("wage", "الأجر الأساسي والعلاوات وموعد أدائه", 2.0,
     r"الأجر|الراتب|المرتب|علاوة|بدل|مكافأ|ريال"),
    ("notice", "مدة الإخطار (لا تقل عن شهر من صاحب العمل)", 1.5,
     r"إخطار|اشعار|إشعار|إنذار|عدم\s+التجديد"),
    ("respect", "احترام الأديان وقوانين السلطنة وعاداتها", 0.5,
     r"الأديان|المعتقدات|قوانين\s+سلطنة|العادات|التقاليد"),
]

# بنود يوصى بها وإن لم توجبها المادة (36) — تُحتسب كمكافأة لا كنقص
RECOMMENDED = [
    ("hours", "ساعات العمل", 1.0, r"ساعات\s+العمل|ساعة\s+عمل|الدوام"),
    ("leave", "الإجازات", 1.0, r"إجاز[ةه]|الإجازات"),
    ("probation", "فترة الاختبار", 0.5, r"اختبار|تجرب"),
    ("termination", "إنهاء العقد", 1.0, r"إنهاء|فسخ|انتهاء\s+(?:هذا\s+)?العقد"),
    ("confidential", "السرية", 0.5, r"سري|السرية|إفشاء|كتمان"),
    ("disputes", "تسوية المنازعات", 0.5, r"المنازعات|التحكيم|المحكمة|الاختصاص"),
]


def _present(pattern: str, blob: str) -> bool:
    return re.search(pattern, blob) is not None


def score_contract(clause_results, full_text: str = ""):
    """
    clause_results  قائمة نتائج المدقّق بعد الحارس (فيها verdict لكل بند)
    full_text       نصّ العقد كاملاً — لفحص البيانات الإلزامية

    يعيد dict فيه الدرجة وتفصيلها الكامل.
    """
    blob = full_text or " ".join(c.get("text", "") for c in clause_results)

    # ── محور الامتثال ─────────────────────────────────────────────────
    counts = {"مخالف": 0, "ناقص": 0, "سليم": 0, "لا مادة ذات صلة": 0}
    for c in clause_results:
        v = c.get("verdict")
        if v in counts:
            counts[v] += 1

    penalty = sum(PENALTY[v] * n for v, n in counts.items())
    compliance = max(0, 100 - penalty)

    # ── محور الاكتمال ─────────────────────────────────────────────────
    missing, present = [], []
    got = total = 0.0
    for key, label, w, pat in REQUIRED:
        total += w
        if _present(pat, blob):
            got += w
            present.append({"key": key, "label": label, "required": True})
        else:
            missing.append({"key": key, "label": label, "required": True,
                            "basis": "المادة (36)"})

    bonus_got = bonus_total = 0.0
    for key, label, w, pat in RECOMMENDED:
        bonus_total += w
        if _present(pat, blob):
            bonus_got += w
            present.append({"key": key, "label": label, "required": False})
        else:
            missing.append({"key": key, "label": label, "required": False,
                            "basis": "ممارسة موصى بها"})

    # الإلزامي يحمل 75% من محور الاكتمال والموصى به 25%
    completeness = round(
        (got / total) * 75 + (bonus_got / max(bonus_total, 1)) * 25
    )

    overall = round(compliance * COMPLIANCE_WEIGHT +
                    completeness * COMPLETENESS_WEIGHT)

    # حالة خاصّة: عقد لم نجد له سنداً في أي قانون متاح — كل بنوده «لا مادة
    # ذات صلة». هنا لم نُدقّق شيئاً فعلياً، فإعطاء درجة عالية مضلّل: الامتثال
    # 100 لأنه لا مخالفات، لكن غياب المخالفات نتيجة غياب التدقيق لا سلامة
    # العقد. نعلن ذلك صراحةً بدل رقم يوحي بالجودة.
    total_clauses = sum(counts.values())
    evaluated = total_clauses - counts.get("لا مادة ذات صلة", 0)
    if total_clauses and evaluated == 0:
        return {
            "overall": None,
            "grade": "خارج النطاق",
            "note": "لم يجد النظام في القوانين المتاحة ما ينظّم بنود هذا "
                    "العقد. غالباً نوعٌ من العقود يحكمه قانون غير مُستوعَب "
                    "بعد. الدرجة لا تنطبق.",
            "compliance": {"score": compliance, "weight": COMPLIANCE_WEIGHT,
                           "counts": counts, "penalty": penalty},
            "completeness": {
                "score": completeness, "weight": COMPLETENESS_WEIGHT,
                "required_present": f"{got:.1f}/{total:.1f}",
                "recommended_present": f"{bonus_got:.1f}/{bonus_total:.1f}",
                "missing": missing, "present": present},
            "basis": "كل البنود خارج نطاق القوانين المتاحة — لا تدقيق فعليّ.",
            "coverage": {"evaluated": evaluated, "total": total_clauses},
        }

    if overall >= 85:
        grade, note = "قوي", "العقد متوافق إلى حدّ كبير ومكتمل البيانات."
    elif overall >= 65:
        grade, note = "مقبول", "العقد صالح مع ملاحظات تستوجب التعديل."
    elif overall >= 45:
        grade, note = "ضعيف", "مخالفات جوهرية أو بيانات إلزامية ناقصة."
    else:
        grade, note = "مرفوض", "العقد يحتاج إعادة صياغة قبل التوقيع."

    # تغطية جزئية: نصف البنود أو أكثر بلا سند — ننبّه دون أن نُلغي الدرجة
    coverage_note = ""
    if total_clauses and evaluated < total_clauses / 2:
        coverage_note = (f" (تنبيه: {evaluated} من {total_clauses} بنود فقط "
                         f"وجدت لها سنداً — الباقي خارج نطاق القوانين المتاحة)")
    note += coverage_note

    return {
        "overall": overall,
        "grade": grade,
        "note": note,
        "compliance": {
            "score": compliance,
            "weight": COMPLIANCE_WEIGHT,
            "counts": counts,
            "penalty": penalty,
        },
        "completeness": {
            "score": completeness,
            "weight": COMPLETENESS_WEIGHT,
            "required_present": f"{got:.1f}/{total:.1f}",
            "recommended_present": f"{bonus_got:.1f}/{bonus_total:.1f}",
            "missing": missing,
            "present": present,
        },
        "basis": "الامتثال من أحكام البنود · الاكتمال من المادة (36) "
                 "من قانون العمل 53/2023",
        "coverage": {"evaluated": evaluated, "total": total_clauses},
    }
