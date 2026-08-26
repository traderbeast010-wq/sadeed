"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createInvoice, getPricing, setFee } from "@/lib/api";
import type { PricingRow } from "@/lib/types";

/**
 * أتعاب العقد — للوحة التحكّم فقط، لا تظهر في العقد ولا تقريره.
 * النوع يُقترح من الموجّه، والسعر يُملأ من قائمة الأسعار ويبقى قابلاً للتعديل.
 */
export function FeePanel({
  analysisId,
  clientId,
  initialFee,
  initialType,
  suggestedType,
}: {
  analysisId: string;
  clientId: string | null;
  initialFee: number | null;
  initialType: string | null;
  suggestedType: string | null;
}) {
  const router = useRouter();
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [type, setType] = useState<string>(
    initialType ?? suggestedType ?? "أخرى",
  );
  const [fee, setFeeVal] = useState<number>(initialFee ?? 0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touched = initialFee !== null;

  useEffect(() => {
    getPricing()
      .then((p) => {
        setPricing(p);
        // ملء السعر تلقائياً من النوع إن لم يُحدَّد سعر بعد
        if (initialFee === null) {
          const match = p.find(
            (x) => x.contract_type === (initialType ?? suggestedType),
          );
          if (match) setFeeVal(match.price);
        }
      })
      .catch(() => setPricing([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onType(t: string) {
    setType(t);
    const match = pricing.find((x) => x.contract_type === t);
    if (match) setFeeVal(match.price);
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      await setFee(analysisId, type, fee);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function onInvoice() {
    setBusy(true);
    setError(null);
    try {
      await setFee(analysisId, type, fee); // ثبّت الأتعاب أولاً
      const inv = await createInvoice(analysisId);
      router.push(`/invoices/${inv.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر إصدار الفاتورة");
      setBusy(false);
    }
  }

  const types = pricing.length
    ? pricing.map((p) => p.contract_type)
    : [type];
  const hasTypeInList = types.includes(type);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--color-ink-3)]">نوع العقد</span>
        <select
          value={type}
          onChange={(e) => onType(e.target.value)}
          className="appearance-none px-3 py-1.5 rounded-[6px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[12px] outline-none focus:border-[var(--color-brand)] transition-colors"
        >
          {!hasTypeInList && <option value={type}>{type}</option>}
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {!touched && suggestedType && (
          <span className="text-[10px] text-[var(--color-accent)]">
            مقترَح آلياً
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--color-ink-3)]">الأتعاب</span>
        <div className="relative w-32">
          <input
            type="number"
            step="0.001"
            min="0"
            value={fee || ""}
            onChange={(e) => setFeeVal(parseFloat(e.target.value) || 0)}
            className="tnum w-full ps-3 pe-9 py-1.5 rounded-[6px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[12px] text-end outline-none focus:border-[var(--color-brand)] transition-colors"
            placeholder="0.000"
          />
          <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-[10px] text-[var(--color-ink-3)]">
            ر.ع
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="px-3 py-1.5 rounded-[6px] border border-[var(--color-line-strong)] text-[var(--color-ink-muted)] text-[12px] font-semibold hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
        >
          حفظ الأتعاب
        </button>
        <button
          onClick={onInvoice}
          disabled={busy || fee <= 0}
          title={fee <= 0 ? "حدّد أتعاباً أولاً" : "إصدار فاتورة"}
          className="px-3 py-1.5 rounded-[6px] bg-[var(--color-brand)] text-white text-[12px] font-semibold hover:bg-[var(--color-brand-2)] disabled:opacity-40 transition-colors"
        >
          إصدار فاتورة
        </button>
        {saved && (
          <span className="text-[11px] text-[var(--color-compliant)] font-medium">
            ● حُفظت
          </span>
        )}
      </div>

      {!clientId && (
        <span className="text-[10.5px] text-[var(--color-ink-3)] basis-full">
          اربط العقد بعميل ليظهر اسمه في الفاتورة.
        </span>
      )}
      {error && (
        <span className="text-[11px] text-[var(--color-violation)] basis-full">
          {error}
        </span>
      )}
    </div>
  );
}
