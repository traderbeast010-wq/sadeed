"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { reviewQueue } from "@/lib/api";
import type { ReviewItem } from "@/lib/types";
import { VERDICT_STYLE } from "@/lib/types";

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reviewQueue()
      .then(setItems)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "تعذّر تحميل القائمة"),
      );
  }, []);

  // تجميع البنود حسب العقد — المحامي يراجع عقداً عقداً لا بنداً معزولاً
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
    <div className="mx-auto max-w-[1000px] px-8 py-10">
      <div className="pb-5 mb-6 border-b border-[var(--color-line)]">
        <div className="flex items-baseline gap-3">
          <h1 className="display text-[24px] text-[var(--color-ink)]">
            بنود تحتاج مراجعة
          </h1>
          {items && (
            <span className="tnum text-[12px] text-[var(--color-ink-3)]">
              {items.length} بند · {groups.length} عقد
            </span>
          )}
        </div>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed max-w-2xl">
          كل بند صدر فيه حكم «مخالف» أو «ناقص» — أو علّمه النظام للمراجعة —
          مجموعٌ عبر كل العقود في طابور عمل واحد، ليعالجه المحامي بند بند.
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 border-s-2 border-[var(--color-deficient)] bg-[var(--color-deficient-bg)]">
          <p className="text-[12.5px] text-[var(--color-deficient)] font-medium">
            {error}
          </p>
        </div>
      )}

      {items === null ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)] py-6">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-12 text-center">
          <p className="text-[13px] text-[var(--color-ink-2)]">
            لا بنود معلّقة للمراجعة.
          </p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-ink-3)]">
            كل الأحكام إمّا واضحة الثقة أو معتمَدة.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ aid, list }) => (
            <section key={aid}>
              <div className="flex items-baseline gap-2 mb-2.5">
                <Link
                  href={`/analysis/${aid}`}
                  className="text-[13px] font-bold text-[var(--color-ink)] hover:text-[var(--color-brand)] transition-colors"
                >
                  {list[0].filename}
                </Link>
                <span className="tnum text-[11px] text-[var(--color-ink-3)]">
                  {list.length} بند
                </span>
                {list[0].approved && (
                  <span className="text-[10.5px] text-[var(--color-compliant)] font-medium">
                    ● معتمَد
                  </span>
                )}
                <span className="h-px flex-1 bg-[var(--color-line)]" />
              </div>

              <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden">
                {list.map((it, i) => {
                  const style = VERDICT_STYLE[it.verdict];
                  return (
                    <Link
                      key={it.clause_id}
                      href={`/analysis/${aid}#${it.clause_id}`}
                      className={`group flex items-start gap-3.5 px-4 py-3.5 hover:bg-[var(--color-surface-2)] transition-colors ${
                        i > 0 ? "border-t border-[var(--color-line-soft)]" : ""
                      }`}
                    >
                      <span
                        className="mt-0.5 shrink-0 text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: style.bg, color: style.fg }}
                      >
                        {it.verdict}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[12.5px] font-medium text-[var(--color-ink)] truncate">
                            {it.heading || it.clause_id}
                          </span>
                          {it.needs_review && (
                            <span className="shrink-0 text-[10px] text-[var(--color-deficient)] font-medium">
                              مُعلَّم
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11.5px] text-[var(--color-ink-2)] leading-relaxed line-clamp-2">
                          {it.reasoning}
                        </p>
                      </div>
                      <div className="shrink-0 text-end">
                        <span className="tnum text-[11px] font-bold text-[var(--color-ink-2)]">
                          {Math.round(it.confidence * 100)}٪
                        </span>
                        <p className="text-[9.5px] text-[var(--color-ink-4)]">ثقة</p>
                      </div>
                      <span className="mt-0.5 shrink-0 text-[var(--color-ink-ghost)] group-hover:text-[var(--color-brand)] group-hover:-translate-x-0.5 transition-all">
                        ←
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
