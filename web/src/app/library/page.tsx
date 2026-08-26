"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteFromLibrary,
  listLibrary,
  saveClauseToLibrary,
  searchClauses,
} from "@/lib/api";
import type { SavedClause, SearchHit } from "@/lib/types";

const V: Record<string, string> = {
  مخالف: "bg-rose-950/70 text-rose-300 border-rose-800/50",
  ناقص: "bg-amber-950/70 text-amber-300 border-amber-800/50",
  سليم: "bg-emerald-950/70 text-emerald-300 border-emerald-800/50",
  "لا مادة ذات صلة": "bg-slate-800 text-slate-300 border-slate-700",
};

function VTag({ v }: { v: string | null }) {
  if (!v || !V[v]) return null;
  return <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${V[v]}`}>{v}</span>;
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
        heading: h.heading, text: h.text, verdict: h.verdict, law_name: h.law_name,
        article_no: h.article_no, source_analysis_id: h.analysis_id, source_filename: h.filename,
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">المكتبة والبحث</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          ابحث في بنود كل العقود التي دقّقتها، واحفظ ما تريد الرجوع إليه في مكتبة بنودك.
        </p>
        <div className="flex items-center gap-1.5 mt-4">
          {(["search", "saved"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${tab === t ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              {t === "search" ? "البحث في العقود" : "بنودي المحفوظة"}
              {t === "saved" && saved && saved.length > 0 && <span className="tnum"> ({saved.length})</span>}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/40 rounded-2xl px-4 py-3">
          <p className="text-sm text-rose-300 font-medium">{error}</p>
        </div>
      )}

      {tab === "search" ? (
        <>
          <form onSubmit={(e) => { e.preventDefault(); runSearch(q); }} className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بكلمة في نصوص البنود… مثل: ساعات العمل، الإجازة، فسخ"
              className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button type="submit" disabled={loading || !q.trim()} className="px-5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-sm font-semibold border border-amber-500/40 disabled:opacity-40 transition-all">
              {loading ? "…" : "ابحث"}
            </button>
          </form>

          {hits !== null && <p className="text-[11px] text-slate-400">{hits.length} بند مطابق</p>}

          <div className="space-y-2.5">
            {hits?.map((h) => (
              <div key={`${h.analysis_id}-${h.clause_id}`} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <VTag v={h.verdict} />
                  <Link href={`/analysis/${h.analysis_id}#${h.clause_id}`} className="text-xs font-semibold text-white hover:text-amber-300 transition-colors">
                    {h.heading || h.clause_id}
                  </Link>
                  <span className="text-[10.5px] text-slate-500">· {h.filename}</span>
                  {h.law_name && h.article_no && <span className="text-[10.5px] text-amber-400">{h.law_name} ({h.article_no})</span>}
                  <button onClick={() => onSaveHit(h)} className="ms-auto text-[11.5px] font-semibold text-amber-400 hover:text-amber-300 shrink-0">
                    {justSaved === h.clause_id ? "✓ حُفظ" : "حفظ"}
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{h.text}</p>
              </div>
            ))}
            {hits !== null && hits.length === 0 && <p className="text-xs text-slate-400 py-4">لا بنود مطابقة.</p>}
          </div>
        </>
      ) : (
        <div className="space-y-2.5">
          {saved === null ? (
            <p className="text-xs text-slate-500 py-6">جارٍ التحميل…</p>
          ) : saved.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-12 text-center">
              <p className="text-sm text-slate-200">لم تحفظ بنوداً بعد.</p>
              <p className="mt-1.5 text-xs text-slate-400">احفظ بنداً من نتائج البحث أو من صفحة تحليل.</p>
            </div>
          ) : (
            saved.map((s) => (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <VTag v={s.verdict} />
                  <span className="text-xs font-semibold text-white">{s.heading || "بند محفوظ"}</span>
                  {s.law_name && s.article_no && <span className="text-[10.5px] text-amber-400">{s.law_name} ({s.article_no})</span>}
                  {s.source_filename && <span className="text-[10.5px] text-slate-500">· {s.source_filename}</span>}
                  <button onClick={() => onDelete(s.id)} className="ms-auto text-[11.5px] text-slate-500 hover:text-rose-400 transition-colors shrink-0">حذف</button>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{s.text}</p>
                {s.note && <p className="mt-2 text-[11px] text-slate-400">{s.note}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
