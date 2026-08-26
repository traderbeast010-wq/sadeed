"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { reviewQueue } from "@/lib/api";
import type { ReviewItem } from "@/lib/types";

const V: Record<string, string> = {
  مخالف: "bg-rose-950/70 text-rose-300 border-rose-800/50",
  ناقص: "bg-amber-950/70 text-amber-300 border-amber-800/50",
  سليم: "bg-emerald-950/70 text-emerald-300 border-emerald-800/50",
  "لا مادة ذات صلة": "bg-slate-800 text-slate-300 border-slate-700",
};

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reviewQueue()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "تعذّر تحميل القائمة"));
  }, []);

  const groups = useMemo(() => {
    if (!items) return [];
    const by = new Map<string, ReviewItem[]>();
    for (const it of items) {
      const arr = by.get(it.analysis_id) ?? [];
      arr.push(it);
      by.set(it.analysis_id, arr);
    }
    return [...by.entries()].map(([aid, list]) => ({ aid, list }));
  }, [items]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white">بنود تحتاج مراجعة</h1>
          {items && (
            <span className="tnum text-xs text-slate-400">
              {items.length} بند · {groups.length} عقد
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed max-w-2xl">
          كل بند بحكم «مخالف» أو «ناقص» — أو مُعلَّم للمراجعة — مجموعٌ عبر كل العقود في طابور عمل واحد.
        </p>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/40 rounded-2xl px-4 py-3">
          <p className="text-sm text-rose-300 font-medium">{error}</p>
        </div>
      )}

      {items === null ? (
        <p className="text-xs text-slate-500 py-6">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-12 text-center">
          <p className="text-sm text-slate-200">لا بنود معلّقة للمراجعة.</p>
          <p className="mt-1.5 text-xs text-slate-400">كل الأحكام واضحة أو معتمَدة.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ aid, list }) => (
            <section key={aid}>
              <div className="flex items-center gap-2 mb-2.5">
                <Link href={`/analysis/${aid}`} className="text-sm font-bold text-white hover:text-amber-300 transition-colors">
                  {list[0].filename}
                </Link>
                <span className="tnum text-[11px] text-slate-400">{list.length} بند</span>
                {list[0].approved && <span className="text-[10.5px] text-emerald-400 font-medium">● معتمَد</span>}
                <span className="h-px flex-1 bg-slate-800" />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {list.map((it, i) => (
                  <Link
                    key={it.clause_id}
                    href={`/analysis/${aid}#${it.clause_id}`}
                    className={`group flex items-start gap-3.5 px-4 py-3.5 hover:bg-slate-950/60 transition-colors ${i > 0 ? "border-t border-slate-800" : ""}`}
                  >
                    <span className={`mt-0.5 shrink-0 text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${V[it.verdict] ?? V["لا مادة ذات صلة"]}`}>
                      {it.verdict}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-100 truncate">{it.heading || it.clause_id}</span>
                        {it.needs_review && <span className="shrink-0 text-[10px] text-amber-400 font-medium">مُعلَّم</span>}
                      </div>
                      <p className="mt-1 text-[11.5px] text-slate-400 leading-relaxed line-clamp-2">{it.reasoning}</p>
                    </div>
                    <div className="shrink-0 text-center">
                      <span className="tnum text-xs font-bold text-slate-300">{Math.round(it.confidence * 100)}٪</span>
                      <p className="text-[9.5px] text-slate-500">ثقة</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-slate-600 group-hover:text-amber-400 transition-colors"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
