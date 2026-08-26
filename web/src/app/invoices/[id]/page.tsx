"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getInvoice, getOffice, setInvoiceStatus } from "@/lib/api";
import type { Invoice, Office } from "@/lib/types";
import { Letterhead } from "@/components/Letterhead";

function omr(n: number) {
  return n.toLocaleString("ar", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id)
      .then(setInv)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "تعذّر تحميل الفاتورة"),
      );
    getOffice().then(setOffice).catch(() => setOffice(null));
  }, [id]);

  async function togglePaid() {
    if (!inv) return;
    const next = inv.status === "paid" ? "issued" : "paid";
    try {
      await setInvoiceStatus(inv.id, next);
      setInv({ ...inv, status: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تحديث الحالة");
    }
  }

  return (
    <div className="mx-auto max-w-[720px] px-8 py-8">
      <div className="no-print flex items-center gap-2 text-[11.5px] text-[var(--color-ink-faint)] mb-6">
        <Link href="/revenue" className="hover:text-[var(--color-ink)]">
          ← الإيرادات
        </Link>
        {inv && (
          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={togglePaid}
              className={`px-3 py-1.5 rounded-[3px] text-[12px] font-semibold transition-colors ${
                inv.status === "paid"
                  ? "border border-[var(--color-line-strong)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]"
                  : "bg-[var(--color-compliant)] text-white hover:opacity-90"
              }`}
            >
              {inv.status === "paid" ? "إلغاء السداد" : "تعليم مدفوعة"}
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-[3px] border border-[var(--color-rule-strong)] text-[var(--color-ink-muted)] text-[12px] font-semibold hover:border-[var(--color-ink-faint)] transition-colors"
            >
              طباعة / حفظ PDF
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[12.5px] text-[var(--color-violation)]">{error}</p>
      )}

      {inv && (
        <article className="doc bg-white text-black rounded-[4px] border border-[var(--color-line)] px-12 py-12 print:border-0 print:px-0 print:py-0">
          <Letterhead office={office} />

          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-[20px] font-bold text-black">فاتورة أتعاب</h1>
              <p className="tnum text-[12px] text-[#555] mt-1">
                {inv.invoice_no}
              </p>
            </div>
            <div className="text-end">
              <p className="tnum text-[11px] text-[#555]">
                {new Date(inv.created_at).toLocaleDateString("ar", {
                  dateStyle: "long",
                })}
              </p>
              <span
                className={`inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  inv.status === "paid"
                    ? "bg-[#e7f2ec] text-[#2d6b4f]"
                    : "bg-[#faf4e6] text-[#9c7423]"
                }`}
              >
                {inv.status === "paid" ? "مدفوعة" : "مستحقّة"}
              </span>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-[10px] text-[#777] mb-1">فاتورة إلى</p>
            <p className="text-[14px] font-semibold text-black">
              {inv.client_name ?? "عميل غير محدَّد"}
            </p>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-[#555]">
              {inv.client_phone && (
                <span className="tnum">{inv.client_phone}</span>
              )}
              {inv.client_email && <span>{inv.client_email}</span>}
            </div>
          </div>

          <table className="w-full text-[12.5px] mb-8">
            <thead>
              <tr className="border-b-2 border-black/70 text-[10.5px] text-[#555]">
                <th className="text-start font-semibold pb-2">البيان</th>
                <th className="text-end font-semibold pb-2 w-40">المبلغ (ر.ع)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black/15">
                <td className="py-3 text-black">
                  أتعاب تدقيق ومراجعة العقد
                  {inv.filename && (
                    <span className="text-[#666]"> — {inv.filename}</span>
                  )}
                </td>
                <td className="py-3 text-end tnum text-black">
                  {omr(inv.amount)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-4 text-end font-bold text-black">الإجمالي</td>
                <td className="pt-4 text-end tnum font-bold text-[15px] text-black">
                  {omr(inv.amount)} ر.ع
                </td>
              </tr>
            </tfoot>
          </table>

          <footer className="pt-4 border-t border-black/15 text-[10px] text-[#666] leading-relaxed">
            صُدرت هذه الفاتورة عن منصّة «سديد». أتعاب مهنية عن خدمة تدقيق قانونيّ.
          </footer>
        </article>
      )}
    </div>
  );
}
