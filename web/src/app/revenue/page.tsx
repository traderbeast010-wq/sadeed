"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRevenue, listInvoices } from "@/lib/api";
import type { Invoice, RevenueSummary } from "@/lib/types";

function omr(n: number) {
  return n.toLocaleString("ar", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export default function RevenuePage() {
  const [sum, setSum] = useState<RevenueSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRevenue().then(setSum).catch((e) =>
      setError(e instanceof Error ? e.message : "تعذّر التحميل"),
    );
    listInvoices().then(setInvoices).catch(() => setInvoices([]));
  }, []);

  return (
    <div className="mx-auto max-w-[1000px] px-8 py-10">
      <div className="pb-5 mb-6 border-b border-[var(--color-line)]">
        <h1 className="display text-[24px] text-[var(--color-ink)]">الإيرادات</h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
          أتعاب العقود وفواتيرها — بالريال العُمانيّ.
        </p>
      </div>

      {error && (
        <p className="mb-5 text-[12.5px] text-[var(--color-violation)]">
          {error}
        </p>
      )}

      {/* بطاقات الإجماليّات */}
      {sum && (
        <div className="grid sm:grid-cols-3 gap-3 mb-9">
          <Stat
            label="مُفوتَر"
            value={omr(sum.invoiced_total)}
            hint={`${sum.invoice_count} فاتورة`}
            accent="brand"
          />
          <Stat
            label="محصَّل"
            value={omr(sum.paid_total)}
            hint="مدفوعة"
            accent="compliant"
          />
          <Stat
            label="مستحقّ"
            value={omr(sum.outstanding_total)}
            hint="غير مدفوعة بعد"
            accent="deficient"
          />
        </div>
      )}

      {/* الفواتير */}
      <div className="flex items-baseline gap-2 mb-3.5">
        <h2 className="text-[13px] font-bold text-[var(--color-ink)]">الفواتير</h2>
        {invoices && (
          <span className="tnum text-[11px] text-[var(--color-ink-3)]">
            ({invoices.length})
          </span>
        )}
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>

      {invoices === null ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)] py-6">جارٍ التحميل…</p>
      ) : invoices.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)] py-4">
          لا فواتير بعد. أصدِر فاتورة من صفحة أيّ تحليل بعد تحديد أتعابه.
        </p>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[10px] tracking-wide text-[var(--color-ink-4)] border-b border-[var(--color-line)]">
                <th className="text-start font-medium pb-2.5 w-32">الرقم</th>
                <th className="text-start font-medium pb-2.5">العميل</th>
                <th className="text-start font-medium pb-2.5 w-28">المبلغ</th>
                <th className="text-start font-medium pb-2.5 w-24">الحالة</th>
                <th className="text-start font-medium pb-2.5 w-32">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-[var(--color-line-soft)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <td className="py-3">
                    <Link
                      href={`/invoices/${v.id}`}
                      className="tnum font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] transition-colors"
                    >
                      {v.invoice_no}
                    </Link>
                  </td>
                  <td className="py-3 text-[var(--color-ink-2)]">
                    {v.client_name ?? "—"}
                  </td>
                  <td className="py-3 tnum font-bold text-[var(--color-ink)]">
                    {omr(v.amount)}
                  </td>
                  <td className="py-3">
                    {v.status === "paid" ? (
                      <span className="text-[11px] text-[var(--color-compliant)] font-medium">
                        ● مدفوعة
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--color-deficient)] font-medium">
                        مستحقّة
                      </span>
                    )}
                  </td>
                  <td className="py-3 tnum text-[11px] text-[var(--color-ink-3)]">
                    {new Date(v.created_at).toLocaleDateString("ar", {
                      dateStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "brand" | "compliant" | "deficient";
}) {
  const color =
    accent === "brand"
      ? "var(--color-brand)"
      : accent === "compliant"
        ? "var(--color-compliant)"
        : "var(--color-deficient)";
  return (
    <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <p className="text-[10.5px] text-[var(--color-ink-3)] mb-2">{label}</p>
      <p className="tnum text-[26px] font-bold leading-none" style={{ color }}>
        {value}
        <span className="text-[13px] font-medium text-[var(--color-ink-3)]">
          {" "}
          ر.ع
        </span>
      </p>
      <p className="text-[10.5px] text-[var(--color-ink-4)] mt-2">{hint}</p>
    </div>
  );
}
