"use client";

import { useState } from "react";
import { searchLaw } from "@/lib/api";
import type { LawArticle } from "@/lib/types";

const EXAMPLES = [
  "كم ساعة عمل يومياً يجيزها القانون؟",
  "مكافأة نهاية الخدمة",
  "بطلان الشرط المخالف للنظام العام",
  "تطبيق قانون أجنبي على العقد",
  "عيب المبيع في العقود التجارية",
  "فترة الاختبار وشروطها",
];

export default function LawSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LawArticle[] | null>(null);
  const [meta, setMeta] = useState<{ ms: number; count: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await searchLaw(query, 6);
      setResults(r.results);
      setMeta({ ms: r.ms, count: r.count });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر البحث");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px] px-8 py-10">
      <div className="pb-5 mb-2 border-b border-[var(--color-line)]">
        <h1 className="display text-[24px] text-[var(--color-ink)]">
          البحث في نصوص القوانين
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed max-w-2xl">
          اكتب سؤالاً أو الصق بنداً من عقد للاطّلاع على المواد ذات الصلة في
          القوانين العُمانية السبعة، مع بيان القانون الذي تنتمي إليه كل مادة.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="mt-6 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اكتب سؤالك أو الصق نصّ بند…"
          className="flex-1 px-3.5 py-2.5 rounded-[3px] border border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)] text-[13.5px] outline-none focus:border-[var(--color-seal)] transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className="px-5 rounded-[3px] bg-[var(--color-seal)] text-[var(--color-paper)] text-[13px] font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {loading ? "…" : "ابحث"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQ(ex);
              run(ex);
            }}
            className="px-2.5 py-1 rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-raised)] text-[11.5px] text-[var(--color-ink-muted)] hover:border-[var(--color-seal)] hover:text-[var(--color-seal)] transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-5 text-[12.5px] text-[var(--color-violation)]">
          {error}
        </p>
      )}

      {meta && (
        <p className="mt-6 tnum text-[11px] text-[var(--color-ink-faint)]">
          {meta.count} مادة · {meta.ms} م.ث
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        {results?.map((a, i) => (
          <article
            key={a.article_no}
            className="settle rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-raised)] overflow-hidden"
            style={{ animationDelay: `${i * 35}ms` }}
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
              <span className="tnum text-[13px] font-bold text-[var(--color-seal)]">
                المادة ({a.article_no})
              </span>
              {a.book && (
                <span className="text-[11px] text-[var(--color-ink-faint)]">
                  {a.book}
                  {a.chapter ? ` · ${a.chapter}` : ""}
                </span>
              )}
              <span className="ms-auto flex items-center gap-2.5 tnum text-[10.5px] text-[var(--color-ink-faint)]">
                <span title="التشابه الدلالي">تشابه {a.cosine.toFixed(3)}</span>
                {a.lex_rank && <span title="رتبة BM25">معجمي #{a.lex_rank}</span>}
                {a.dense_rank && (
                  <span title="رتبة التضمين">دلالي #{a.dense_rank}</span>
                )}
              </span>
            </div>
            <p className="px-4 py-3 text-[13px] leading-[1.9] whitespace-pre-line text-[var(--color-ink)]">
              {a.text}
            </p>
          </article>
        ))}
      </div>

      {results && results.length === 0 && (
        <p className="mt-6 text-[12.5px] text-[var(--color-ink-muted)]">
          لا مواد مطابقة.
        </p>
      )}
    </div>
  );
}
