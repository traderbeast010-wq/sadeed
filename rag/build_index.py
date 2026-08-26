#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
بناء فهرس الاسترجاع: يضمّن كل مواد الكوربوس مرّة واحدة ويحفظ المتجهات.

يُشغَّل مرّة بعد كل تحديث للكوربوس. المخرَج:
    corpus/embeddings.npy      متجهات المواد (مطبَّعة الطول)
    corpus/index_meta.json     البيانات الوصفية للتحقّق من التطابق

    python rag/build_index.py
"""

import hashlib
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from llama import embedding_server  # noqa: E402

CORPUS = os.path.join("corpus", "articles.json")
VECTORS = os.path.join("corpus", "embeddings.npy")
META = os.path.join("corpus", "index_meta.json")


def article_to_passage(a: dict) -> str:
    """
    ما الذي نضمّنه بالضبط؟ نصّ المادة مسبوقاً بسياقها: القانون ثم الباب
    والفصل.

    **اسم القانون جزء من النصّ المضمَّن عمداً.** بكوربوس من سبعة قوانين،
    مادة عن «الالتزام» في المعاملات المدنية تشبه لفظياً مادة في التجارة؛
    وجود اسم القانون في المتجه يفرّق بينهما ويحسّن فصل النطاقات — وهو ما
    يعتمد عليه موجّه النطاق في rag/router.py حين يبني مركز ثقل كل قانون.

    والباب والفصل يحملان إشارة موضوعية قوية («الباب الرابع — ساعات العمل
    والإجازات والأجور») تميّز المواد المتشابهة لفظاً داخل القانون الواحد.
    """
    parts = [a.get("law_name", "")]
    if a.get("book"):
        parts.append(a["book"])
    if a.get("chapter"):
        parts.append(a["chapter"])
    head = " · ".join(p for p in parts if p)
    return f"{head}\nالمادة ({a['article_no']}): {a['text']}" if head else \
           f"المادة ({a['article_no']}): {a['text']}"


def corpus_fingerprint(articles) -> str:
    h = hashlib.sha256()
    for a in articles:
        h.update(f"{a['law_id']}|{a['article_no']}|{a['text']}".encode("utf-8"))
    return h.hexdigest()[:16]


def main():
    with open(CORPUS, encoding="utf-8") as f:
        corpus = json.load(f)
    articles = corpus["articles"]
    passages = [article_to_passage(a) for a in articles]

    laws = corpus.get("laws") or [{"law_name": corpus.get("law_name", "?"),
                                   "decree_no": corpus.get("decree_no", ""),
                                   "article_count": len(articles)}]
    print(f"الكوربوس : {len(laws)} قانون · {len(articles)} مادة")
    for lw in laws:
        print(f"   {lw['article_count']:>5}  {lw['law_name']} "
              f"({lw.get('decree_no', '')})")
    print(f"أطول مقطع: {max(len(p) for p in passages)} محرف")
    print("\nتشغيل خادم التضمين (bge-m3)...")

    srv = embedding_server(ctx=4096)
    load_s = srv.start()
    print(f"جاهز في {load_s:.1f}ث\n")
    try:
        t0 = time.perf_counter()
        vecs = []
        for i in range(0, len(passages), 4):
            vecs.extend(srv.embed(passages[i:i + 4], batch=4))
            done = min(i + 4, len(passages))
            pct = done * 100 // len(passages)
            eta = ((time.perf_counter() - t0) / max(done, 1)
                   * (len(passages) - done))
            print(f"\r  تضمين {done}/{len(passages)} ({pct}%) — "
                  f"متبقٍّ ~{eta / 60:.1f} دقيقة    ", end="", flush=True)
        dt = time.perf_counter() - t0
        print(f"\n  اكتمل في {dt:.1f}ث  ({dt/len(passages)*1000:.0f} م.ث للمادة)")
    finally:
        srv.stop()

    M = np.asarray(vecs, dtype=np.float32)
    norms = np.linalg.norm(M, axis=1, keepdims=True)
    zero = int((norms.squeeze() == 0).sum())
    if zero:
        print(f"⚠ {zero} متجه صفري — تحقّق من الخادم")
    M = M / np.maximum(norms, 1e-9)          # التطبيع يجعل الضرب النقطي = جيب التمام

    np.save(VECTORS, M)
    meta = {
        "law_ids": [lw.get("law_id") for lw in laws if lw.get("law_id")],
        "law_count": len(laws),
        "article_count": len(articles),
        "dim": int(M.shape[1]),
        "fingerprint": corpus_fingerprint(articles),
        "embed_model": os.path.basename(
            os.environ.get("LAWMIND_EMBED_MODEL", "bge-m3-q8_0.gguf")),
        "pooling": "cls",
    }
    with open(META, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"\nالأبعاد  : {M.shape}")
    print(f"البصمة   : {meta['fingerprint']}")

    # فحص سلامة: أقرب جار لكل مادة يجب ألا يكون نفسها بمسافة غريبة
    sims = M @ M.T
    np.fill_diagonal(sims, -1)
    best = sims.max(axis=1)
    print(f"تشابه الجيران: متوسّط {best.mean():.3f} · أقصى {best.max():.3f}")
    if best.max() > 0.995:
        i, j = np.unravel_index(sims.argmax(), sims.shape)
        print(f"⚠ مادتان شبه متطابقتين: "
              f"{articles[i]['law_name']} ({articles[i]['article_no']}) و "
              f"{articles[j]['law_name']} ({articles[j]['article_no']})")

    print(f"\nحُفظ في {VECTORS} و {META}")


if __name__ == "__main__":
    main()
