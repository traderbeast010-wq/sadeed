"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteFromLibrary,
  listLibrary,
  saveClauseToLibrary,
  searchClauses,
} from "@/lib/api";
import type { SavedClause, SearchHit, Verdict } from "@/lib/types";
import { VERDICT_STYLE } from "@/lib/types";

function VerdictTag({ v }: { v: Verdict | string | null }) {
  if (!v) return null;
  const style = VERDICT_STYLE[v as Verdict];
  if (!style) return null;
  return (
    <span
      className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: style.bg, color: style.fg }}
    >
      {v}
    </span>
  );
}

export default function LibraryPage() {
  const [tab, setTab] = useState<"search" | "saved">("search");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [saved, setSaved] = useState<SavedClause[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  useEffect(() => {
    listLibrary().then(setSaved).catch(() => setSaved([]));
  }, []);

  async function runSearch(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setHits(await searchClauses(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر البحث");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveHit(h: SearchHit) {
    try {
      await saveClauseToLibrary({
        heading: h.heading,
        text: h.text,
        verdict: h.verdict,
        law_name: h.law_name,
        article_no: h.article_no,
        source_analysis_id: h.analysis_id,
        source_filename: h.filename,
      });
      setJustSaved(h.clause_id);
      setTimeout(() => setJustSaved(null), 1800);
      listLibrary().then(setSaved).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    }
  }

  async function onDelete(id: string) {
    await deleteFromLibrary(id);
    setSaved((s) => s?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-8 py-10">
      <div className="pb-5 mb-5 border-b border-[var(--color-line)]">
        <h1 className="display text-[24px] text-[var(--color-ink)]">
          المكتبة والبحث
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed max-w-2xl">
          ابحث في بنود كل العقود التي دقّقتها، واحفظ ما تريد الرجوع إليه في
          مكتبة بنودك.
        </p>
      </div>

      {/* التبويبات */}
      <div className="flex items-center gap-1 mb-6">
        {(["search", "saved"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-semibold transition-colors ${
              tab === t
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {t === "search" ? "البحث في العقود" : "بنودي المحفوظة"}
            {t === "saved" && saved && saved.length > 0 && (
              <span className="tnum"> ({saved.length})</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 text-[12.5px] text-[var(--color-violation)]">{error}</p>
      )}

      {tab === "search" ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(q);
            }}
            className="flex gap-2 mb-5"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بكلمة في نصوص البنود… مثل: ساعات العمل، الإجازة، فسخ"
              className="flex-1 px-3.5 py-2.5 rounded-[8px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[13px] outline-none focus:border-[var(--color-brand)] transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !q.trim()}
              className="px-5 rounded-[8px] bg-[var(--color-brand)] text-white text-[13px] font-semibold hover:bg-[var(--color-brand-2)] disabled:opacity-40 transition-colors"
            >
              {loading ? "…" : "ابحث"}
            </button>
          </form>

          {hits !== null && (
            <p className="mb-3 text-[11px] text-[var(--color-ink-3)]">
              {hits.length} بند مطابق
            </p>
          )}

          <div className="space-y-2.5">
            {hits?.map((h) => (
              <div
                key={`${h.analysis_id}-${h.clause_id}`}
                className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <VerdictTag v={h.verdict} />
                  <Link
                    href={`/analysis/${h.analysis_id}#${h.clause_id}`}
                    className="text-[12px] font-semibold text-[var(--color-ink)] hover:text-[var(--color-brand)] transition-colors"
                  >
                    {h.heading || h.clause_id}
                  </Link>
                  <span className="text-[10.5px] text-[var(--color-ink-3)]">
                    · {h.filename}
                  </span>
                  {h.law_name && h.article_no && (
                    <span className="text-[10.5px] text-[var(--color-brand)]">
                      {h.law_name} ({h.article_no})
                    </span>
                  )}
                  <button
                    onClick={() => onSaveHit(h)}
                    className="ms-auto text-[11.5px] font-semibold text-[var(--color-brand)] hover:underline shrink-0"
                  >
                    {justSaved === h.clause_id ? "✓ حُفظ" : "حفظ"}
                  </button>
                </div>
                <p className="text-[12.5px] leading-[1.8] text-[var(--color-ink-2)] line-clamp-3">
                  {h.text}
                </p>
              </div>
            ))}
            {hits !== null && hits.length === 0 && (
              <p className="text-[12.5px] text-[var(--color-ink-3)] py-4">
                لا بنود مطابقة.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2.5">
          {saved === null ? (
            <p className="text-[12.5px] text-[var(--color-ink-3)] py-6">
              جارٍ التحميل…
            </p>
          ) : saved.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-ink-3)] py-4">
              لم تحفظ بنوداً بعد. احفظ بنداً من نتائج البحث أو من صفحة تحليل.
            </p>
          ) : (
            saved.map((s) => (
              <div
                key={s.id}
                className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <VerdictTag v={s.verdict} />
                  <span className="text-[12px] font-semibold text-[var(--color-ink)]">
                    {s.heading || "بند محفوظ"}
                  </span>
                  {s.law_name && s.article_no && (
                    <span className="text-[10.5px] text-[var(--color-brand)]">
                      {s.law_name} ({s.article_no})
                    </span>
                  )}
                  {s.source_filename && (
                    <span className="text-[10.5px] text-[var(--color-ink-3)]">
                      · {s.source_filename}
                    </span>
                  )}
                  <button
                    onClick={() => onDelete(s.id)}
                    className="ms-auto text-[11.5px] text-[var(--color-ink-3)] hover:text-[var(--color-violation)] transition-colors shrink-0"
                  >
                    حذف
                  </button>
                </div>
                <p className="text-[12.5px] leading-[1.8] text-[var(--color-ink)]">
                  {s.text}
                </p>
                {s.note && (
                  <p className="mt-2 text-[11px] text-[var(--color-ink-3)]">
                    {s.note}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
