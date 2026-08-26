"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRevenue, listInvoices } from "@/lib/api";
import type { Invoice, RevenueSummary } from "@/lib/types";

function omr(n: number) {
  return n.toLocaleString("ar", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function RevenuePage() {
  const [sum, setSum] = useState<RevenueSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRevenue().then(setSum).catch((e) => setError(e instanceof Error ? e.message : "تعذّر التحميل"));
    listInvoices().then(setInvoices).catch(() => setInvoices([]));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* الترويسة */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">الأتعاب والفوترة</h1>
          <p className="text-xs text-slate-400 mt-1">أتعاب العقود وفواتيرها — بالريال العُمانيّ.</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/40 rounded-2xl px-4 py-3">
          <p className="text-sm text-rose-300 font-medium">{error}</p>
        </div>
      )}

      {/* بطاقات الإجماليّات */}
      {sum && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs font-semibold text-slate-400">إجمالي المحصَّل</span>
            <div className="tnum mt-2 text-2xl font-bold text-emerald-400">{omr(sum.paid_total)} <span className="text-sm font-normal">ر.ع</span></div>
            <p className="text-[11px] text-slate-500 mt-1">فواتير مدفوعة</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs font-semibold text-slate-400">المستحقّ (غير مدفوع)</span>
            <div className="tnum mt-2 text-2xl font-bold text-amber-400">{omr(sum.outstanding_total)} <span className="text-sm font-normal">ر.ع</span></div>
            <p className="text-[11px] text-slate-500 mt-1">بانتظار السداد</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs font-semibold text-slate-400">إجمالي المُفوتَر</span>
            <div className="tnum mt-2 text-2xl font-bold text-blue-400">{omr(sum.invoiced_total)} <span className="text-sm font-normal">ر.ع</span></div>
            <p className="text-[11px] text-slate-500 mt-1"><span className="tnum">{sum.invoice_count}</span> فاتورة</p>
          </div>
        </div>
      )}

      {/* الفواتير */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">سجلّ فواتير الأتعاب الصادرة</h2>
          {invoices && <span className="tnum text-xs text-slate-400">{invoices.length} فاتورة</span>}
        </div>

        {invoices === null ? (
          <p className="text-xs text-slate-500 py-4">جارٍ التحميل…</p>
        ) : invoices.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">
            لا فواتير بعد. أصدِر فاتورة من صفحة أيّ تحليل بعد تحديد أتعابه.
          </p>
        ) : (
          <div className="space-y-2.5">
            {invoices.map((v) => (
              <Link
                key={v.id}
                href={`/invoices/${v.id}`}
                className="flex items-center justify-between gap-3 bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-4 transition-all group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="tnum text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">{v.invoice_no}</span>
                    {v.status === "paid" ? (
                      <span className="text-[10px] bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded font-semibold">مدفوعة</span>
                    ) : (
                      <span className="text-[10px] bg-amber-950/70 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded font-semibold">مستحقّة</span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1 group-hover:text-amber-300 transition-colors truncate">
                    {v.client_name ?? "عميل غير محدَّد"}
                  </h3>
                  <p className="tnum text-[11px] text-slate-500 mt-0.5">
                    {new Date(v.created_at).toLocaleDateString("ar", { dateStyle: "medium" })}
                    {v.filename ? ` · ${v.filename}` : ""}
                  </p>
                </div>
                <div className="text-left shrink-0">
                  <span className="tnum text-lg font-bold text-amber-400">{omr(v.amount)}</span>
                  <span className="text-xs text-slate-400"> ر.ع</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
