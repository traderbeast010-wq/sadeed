#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
الاسترجاع الهجين: BM25 (معجمي) + bge-m3 (دلالي) مدموجان بـ RRF.

لماذا الهجين؟ لأن كلّاً منهما يفشل حيث ينجح الآخر:
  • البند «الموظف يشتغل ١٢ ساعة» والمادة «تشغيل العامل ثماني ساعات»
    لا يشتركان في كلمة واحدة بعد التجذير — BM25 يعميه هذا، والتضمين يمسكه.
  • أرقام ومصطلحات حرفية («التعمين»، «(30) ثلاثين يوما») يمسكها BM25
    بدقّة بينما قد يميّعها التضمين.

لماذا RRF وليس جمع الدرجات؟ درجات BM25 غير محدودة المدى ودرجات جيب التمام
بين 0 و1 — جمعها يتطلّب معايرة هشّة. RRF يعمل على الرتب لا الدرجات،
فلا يحتاج معايرة أصلاً.
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lexical import BM25, tokenize  # noqa: E402

CORPUS = os.path.join("corpus", "articles.json")
VECTORS = os.path.join("corpus", "embeddings.npy")

RRF_K = 60          # ثابت RRF القياسي — يخفّف أثر الرتب الأولى المتطرّفة
POOL = 25           # كم مرشّحاً يقدّمه كل مسترجِع قبل الدمج

# أوزان الدمج. الوزن المتساوي أضرّ بالنتيجة في التقييم: المسترجِع الدلالي
# أدقّ على العربية القانونية، والمعجمي يميّع إشارته حين يخطئ. تُضبط في
# rag/eval_retrieval.py --sweep
W_LEX = 0.25
W_DENSE = 1.0


class Retriever:
    def __init__(self, corpus_path=CORPUS, vectors_path=VECTORS):
        with open(corpus_path, encoding="utf-8") as f:
            self.corpus = json.load(f)
        self.articles = self.corpus["articles"]
        # مفتاح مركّب: رقم المادة وحده لم يعد فريداً عبر قوانين متعدّدة
        self.by_key = {(a["law_id"], a["article_no"]): a
                       for a in self.articles}
        # يبقى by_no للتوافق — يشير إلى أول قانون فيه ذلك الرقم
        self.by_no = {}
        for a in self.articles:
            self.by_no.setdefault(a["article_no"], a)
        self.law_ids = [a["law_id"] for a in self.articles]

        # BM25 على نصّ المادة + سياقها البنيوي
        docs = [tokenize(f"{a.get('book','')} {a.get('chapter','')} {a['text']}")
                for a in self.articles]
        self.bm25 = BM25(docs)

        self.vectors = np.load(vectors_path)
        if len(self.vectors) != len(self.articles):
            raise ValueError(
                f"الفهرس لا يطابق الكوربوس: "
                f"{len(self.vectors)} متجه مقابل {len(self.articles)} مادة. "
                f"أعد تشغيل rag/build_index.py"
            )

    # ── المسترجِعان ────────────────────────────────────────────────────
    def _lexical_ranks(self, query, pool=POOL):
        scores = self.bm25.scores(tokenize(query))
        order = np.argsort(scores)[::-1][:pool]
        return [int(i) for i in order if scores[i] > 0]

    def _dense_ranks(self, query_vec, pool=POOL):
        v = np.asarray(query_vec, dtype=np.float32)
        v = v / max(float(np.linalg.norm(v)), 1e-9)
        sims = self.vectors @ v
        return [int(i) for i in np.argsort(sims)[::-1][:pool]], sims

    # ── الدمج ──────────────────────────────────────────────────────────
    def search(self, query, query_vec, k=3, debug=False,
               w_lex=W_LEX, w_dense=W_DENSE, law_weights=None):
        """
        law_weights: {law_id: وزن} من rag/router.py — يرجّح القوانين بحسب
        نوع العقد. تركه None يعني وزناً متساوياً (سلوك القانون الواحد).

        الترجيح يقع **بعد** الدمج لا قبله: كل مسترجِع يرشّح بحرّية، ثم
        نرجّح النتيجة. الفلترة قبل البحث تقطع الإحالات العابرة للقوانين.
        """
        lex = self._lexical_ranks(query)
        dense, sims = self._dense_ranks(query_vec)

        fused = {}
        for rank, idx in enumerate(lex):
            fused[idx] = fused.get(idx, 0.0) + w_lex / (RRF_K + rank + 1)
        for rank, idx in enumerate(dense):
            fused[idx] = fused.get(idx, 0.0) + w_dense / (RRF_K + rank + 1)

        if law_weights:
            for idx in list(fused):
                fused[idx] *= law_weights.get(self.law_ids[idx], 0.15)

        ordered = sorted(fused, key=lambda i: fused[i], reverse=True)[:k]

        out = []
        for i in ordered:
            a = self.articles[i]
            hit = {
                "article_no": a["article_no"],
                "law_id": a["law_id"],
                "law_name": a["law_name"],
                "decree_no": a.get("decree_no"),
                "book": a.get("book"),
                "chapter": a.get("chapter"),
                "text": a["text"],
                "rrf": round(fused[i], 5),
                "cosine": round(float(sims[i]), 4),
            }
            if debug:
                hit["lex_rank"] = lex.index(i) + 1 if i in lex else None
                hit["dense_rank"] = dense.index(i) + 1 if i in dense else None
            out.append(hit)
        return out

    def search_lexical_only(self, query, k=3):
        idxs = self._lexical_ranks(query, pool=k)
        return [self.articles[i]["article_no"] for i in idxs]

    def search_dense_only(self, query_vec, k=3):
        idxs, _ = self._dense_ranks(query_vec, pool=k)
        return [self.articles[i]["article_no"] for i in idxs]


def format_articles_for_prompt(hits) -> str:
    """يصوغ المواد المسترجَعة للبرومبت — مختصراً قدر الإمكان.

    كل توكن هنا يكلّف ثلاثة أضعاف توكن المخرَج (المعالجة المسبقة 29 توكن/ث
    مقابل التوليد 9.3)، فالإيجاز هنا هو أثمن تحسين متاح.
    """
    return "\n".join(f"[المادة {h['article_no']}] {h['text']}" for h in hits)
