"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteConsultation, listConsultations } from "@/lib/api";
import type { Consultation } from "@/lib/types";

export default function ConsultationsPage() {
  const [items, setItems] = useState<Consultation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listConsultations()
      .then(setItems)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "تعذّر التحميل");
        setItems([]);
      });
  }, []);

  async function remove(id: string) {
    await deleteConsultation(id);
    setItems((s) => s?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <div className="mx-auto max-w-[860px] px-8 py-10">
      <div className="pb-5 mb-6 border-b border-[var(--color-line)]">
        <div className="flex items-baseline gap-3">
          <h1 className="display text-[24px] text-[var(--color-ink)]">
            سجلّ الاستشارات
          </h1>
          {items && (
            <span className="tnum text-[12px] text-[var(--color-ink-3)]">
              {items.length}
            </span>
          )}
        </div>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
          أسئلتك للمساعد القانونيّ وأجوبتها المحفوظة — للعودة إليها لاحقاً.{" "}
          <Link href="/assistant" className="text-[var(--color-brand)] hover:underline">
            اسأل المساعد ←
          </Link>
        </p>
      </div>

      {error && (
        <p className="mb-5 text-[12.5px] text-[var(--color-violation)]">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)] py-6">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-12 text-center">
          <p className="text-[13px] text-[var(--color-ink-2)]">
            لا استشارات محفوظة بعد.
          </p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-ink-3)]">
            من صفحة المساعد، احفظ أي جواب بزرّ «حفظ الاستشارة».
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div
              key={c.id}
              className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
            >
              <div className="flex items-start gap-3">
                <p className="flex-1 text-[13px] font-semibold text-[var(--color-ink)] leading-relaxed">
                  {c.question}
                </p>
                <button
                  onClick={() => remove(c.id)}
                  className="shrink-0 text-[11px] text-[var(--color-ink-4)] hover:text-[var(--color-violation)] transition-colors"
                >
                  حذف
                </button>
              </div>
              <p className="mt-2.5 text-[13px] leading-[1.9] text-[var(--color-ink-2)] whitespace-pre-line">
                {c.answer}
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {c.articles?.length > 0 && (
                  <span className="tnum text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand-2)] font-semibold">
                    المادة {c.articles.map((a) => a.article_no).join("، ")}
                  </span>
                )}
                <span className="tnum text-[10.5px] text-[var(--color-ink-4)]">
                  {new Date(c.created_at).toLocaleString("ar", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
