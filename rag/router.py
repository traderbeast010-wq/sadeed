#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
موجّه النطاق — يرجّح القوانين بحسب نوع العقد.

المشكلة التي يحلّها: بكوربوس من ألف مادة عبر تسعة قوانين، قد يسترجع
النظام مادة من **قانون التجارة** ليحكم على بند **عمل**. المادة حقيقية،
فيمرّرها الحارس، ويخرج حكم خاطئ باستشهاد صحيح — وهو أخطر من الهلوسة
لأن لا شيء يمسكه. (رأيناه فعلاً في تجربة نموذج 2B.)

**ترجيح لا فلترة.** الفلترة الصارمة خاطئة لأن قوانين كثيرة عابرة للنطاق:
قانون المعاملات المدنية ينطبق على كل العقود، والحماية الاجتماعية تمسّ
عقود العمل. فنرجّح بدل أن نستبعد، ويبقى باب الإحالة الحقيقية مفتوحاً.

**بلا نموذج لغوي.** التصنيف بتضمين واحد للعقد يُقارن بمركز ثقل كل قانون
(centroid لمتجهات مواده) — نصف ثانية، صفر استدعاءات، وحتميّ.
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lexical import normalize, tokenize  # noqa: E402

# أوزان الترجيح — القانون الأوثق صلة يرتفع، والبقية تنخفض ولا تُلغى.
W_PRIMARY = 1.00
W_RELATED = 0.50
W_OTHER = 0.15      # ليس صفراً: تبقى الإحالات العابرة ممكنة

TOP_PRIMARY = 1     # كم قانوناً يُعدّ أساسياً
TOP_RELATED = 2     # وكم يُعدّ ذا صلة

# قوانين «المظلّة»: تنطبق على كل العقود مهما كان نوعها، فلا يجوز تخفيضها
# تحت حدّ أدنى حتى لو رجّح الموجّه قانوناً متخصّصاً.
#
# ظهر هذا في اختبار الضغط: بند «يخضع العقد لقانون أجنبي مخالف للنظام
# العام» نجح في عقد العمل (استشهد بالمعاملات المدنية م28)، وفشل في العقد
# التجاري — لأن الموجّه رجّح التجارة فخفّض المعاملات المدنية، والمادة 28
# فيها. لكن المادة 28 (بطلان القانون الأجنبي المخالف للنظام العام) عابرة
# لكل العقود، وكذلك مواد القوة القاهرة والالتزام العامّة.
UMBRELLA_LAWS = {"OM-CIVIL-29-2013", "OM-BASIC-LAW"}
UMBRELLA_FLOOR = 0.5    # لا ينزل وزن قانون المظلّة تحت هذا أبداً

# مفاتيح لفظية صريحة تحسم نوع العقد حين تظهر. الترجيح الدلالي وحده قد
# يتردّد بين قانونين متقاربين، وهذه المفاتيح تقطع التردّد.
DOMAIN_HINTS = {
    "employment": ["عقد عمل", "صاحب العمل", "العامل", "الأجر الأساسي",
                   "فترة الاختبار", "مكافأة نهاية الخدمة", "التعمين",
                   "ساعات العمل", "الإجازة السنوية"],
    "lease": ["عقد إيجار", "المؤجر", "المستأجر", "الأجرة", "العين المؤجرة",
              "مدة الإيجار"],
    "commercial": ["عقد بيع", "البائع", "المشتري", "البضاعة", "الوكالة "
                   "التجارية", "السجل التجاري", "الشركة"],
    "civil": ["المعاملات المدنية", "الالتزام", "التعويض", "الفسخ",
              "القوة القاهرة"],
    "tenders": ["المناقصة", "العطاء", "كراسة الشروط", "الضمان الابتدائي"],
}


class LawRouter:
    """
    يبني مركز ثقل لكل قانون من متجهات مواده، ثم يرجّح القوانين لعقد معيّن.
    """

    def __init__(self, articles, vectors):
        self.laws = {}
        index = {}
        for i, a in enumerate(articles):
            index.setdefault(a["law_id"], []).append(i)
        for law_id, idxs in index.items():
            m = vectors[idxs]
            c = m.mean(axis=0)
            n = float(np.linalg.norm(c))
            a0 = articles[idxs[0]]
            self.laws[law_id] = {
                "centroid": c / max(n, 1e-9),
                "law_name": a0.get("law_name", law_id),
                "domains": a0.get("domains") or [],
                "count": len(idxs),
            }

    # ── الترجيح ────────────────────────────────────────────────────────
    def rank_laws(self, contract_text, contract_vec):
        """يعيد [(law_id, درجة)] مرتّبة تنازلياً."""
        v = np.asarray(contract_vec, dtype=np.float32)
        v = v / max(float(np.linalg.norm(v)), 1e-9)

        norm_text = normalize(contract_text)
        hint_domains = {
            dom for dom, keys in DOMAIN_HINTS.items()
            if sum(1 for k in keys if normalize(k) in norm_text) >= 2
        }

        scored = []
        for law_id, info in self.laws.items():
            score = float(info["centroid"] @ v)
            # المفتاح اللفظي يرفع القانون الذي يخدم نطاقاً ظهرت شواهده
            if hint_domains & set(info["domains"]):
                score += 0.25
            scored.append((law_id, score))
        return sorted(scored, key=lambda x: x[1], reverse=True)

    def weights(self, contract_text, contract_vec):
        """يعيد {law_id: وزن} جاهزاً لتمريره إلى المسترجِع."""
        ranked = self.rank_laws(contract_text, contract_vec)
        out = {}
        for pos, (law_id, _) in enumerate(ranked):
            if pos < TOP_PRIMARY:
                out[law_id] = W_PRIMARY
            elif pos < TOP_PRIMARY + TOP_RELATED:
                out[law_id] = W_RELATED
            else:
                out[law_id] = W_OTHER
        # قوانين المظلّة لا تنزل تحت حدّها مهما كان نوع العقد
        for law_id in UMBRELLA_LAWS:
            if law_id in out:
                out[law_id] = max(out[law_id], UMBRELLA_FLOOR)
        return out

    def explain(self, contract_text, contract_vec):
        """شرح قابل للعرض في الواجهة — الشفافية جزء من المنتج."""
        ranked = self.rank_laws(contract_text, contract_vec)
        w = self.weights(contract_text, contract_vec)
        return [{
            "law_id": law_id,
            "law_name": self.laws[law_id]["law_name"],
            "similarity": round(score, 4),
            "weight": w[law_id],
            "article_count": self.laws[law_id]["count"],
        } for law_id, score in ranked]


    # ── المزج بين ترجيح العقد وترجيح البند ─────────────────────────────
    # معامل المزج: كم من الوزن للعقد وكم للبند.
    # مُقاس لا مُخمَّن — مسح على عقد العرض بستّة بنود ومواد متوقّعة معلومة:
    #     α ≤ 0.50  →  3/5   ترجيح البند يطغى فيسحب بنود العمل إلى المدنية
    #     α = 0.60–0.70  →  5/5   ← النافذة الصحيحة
    #     α ≥ 0.80  →  4/5   ترجيح العقد يطغى فيخسر البند المدنيّ
    # 0.65 منتصف النافذة، أبعد ما يكون عن حافّتيها.
    BLEND_ALPHA = 0.65

    def blended_weights(self, contract_text, contract_vec,
                        clause_text, clause_vec, alpha=None):
        """
        يمزج ترجيح **العقد** بترجيح **البند**.

        لماذا لا يكفي ترجيح العقد وحده؟ لأن العقد قد يكون عمالياً بينما
        بندٌ فيه مسألةٌ مدنية بحتة. ظهر هذا عملياً في بند «يخضع هذا العقد
        للقانون الأجنبي الذي يختاره الطرفان»:

            بلا ترجيح   → المعاملات المدنية (28) في المرتبة 2  ✓
            ترجيح العقد → قانون العمل (14، 18)  ✗ لأن العقد عماليّ
            ترجيح البند → المعاملات المدنية (28)  ✓

        ولماذا لا يكفي ترجيح البند وحده؟ لأن بنداً قصيراً أو غامضاً يجرّ
        قانوناً غير مقصود — وترجيح العقد هو المرساة التي تمنع ذلك.

        المزج لا يغيّر شيئاً حين يتّفق الترجيحان (الحالة الغالبة)، ويرجّح
        القانون الصحيح حين يفترقان — وهو بالضبط ما نريده.
        """
        a = self.BLEND_ALPHA if alpha is None else alpha
        wc = self.weights(contract_text, contract_vec)
        wq = self.weights(clause_text, clause_vec)
        return {law_id: a * wc.get(law_id, W_OTHER)
                + (1 - a) * wq.get(law_id, W_OTHER)
                for law_id in self.laws}


def single_law_weights(articles):
    """كوربوس بقانون واحد: لا ترجيح، كل شيء بوزن كامل."""
    return {a["law_id"]: W_PRIMARY for a in articles}
