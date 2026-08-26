"use client";

import { useEffect, useRef, useState } from "react";
import {
  getOffice,
  getPricing,
  saveOffice,
  savePricing,
} from "@/lib/api";
import type { Office, PricingRow } from "@/lib/types";

export default function SettingsPage() {
  const [office, setOffice] = useState<Office | null>(null);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [savedOffice, setSavedOffice] = useState(false);
  const [savedPricing, setSavedPricing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getOffice().then(setOffice).catch(() => setOffice({ id: "office" }));
    getPricing().then(setPricing).catch(() => setPricing([]));
  }, []);

  async function onSaveOffice(e: React.FormEvent) {
    e.preventDefault();
    if (!office) return;
    try {
      await saveOffice(office);
      setSavedOffice(true);
      setTimeout(() => setSavedOffice(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    }
  }

  function onLogo(file: File) {
    if (file.size > 400 * 1024) {
      setError("الشعار كبير — استخدم صورة أصغر من 400 كيلوبايت.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setOffice((o) => (o ? { ...o, logo: String(reader.result) } : o));
    reader.readAsDataURL(file);
  }

  async function onSavePricing() {
    try {
      const clean = pricing.filter((p) => p.contract_type.trim());
      setPricing(await savePricing(clean));
      setSavedPricing(true);
      setTimeout(() => setSavedPricing(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ الأسعار");
    }
  }

  const field =
    "w-full px-3 py-2 rounded-[6px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[13px] outline-none focus:border-[var(--color-brand)] transition-colors";
  const set = (k: keyof Office, v: string) =>
    setOffice((o) => (o ? { ...o, [k]: v } : o));

  return (
    <div className="mx-auto max-w-[900px] px-8 py-10">
      <div className="pb-5 mb-6 border-b border-[var(--color-line)]">
        <h1 className="display text-[24px] text-[var(--color-ink)]">الإعدادات</h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
          هوية المكتب تظهر على التقارير والفواتير. قائمة الأسعار تُملأ بها أتعاب
          كل عقد تلقائياً حسب نوعه.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 border-s-2 border-[var(--color-violation)] bg-[var(--color-violation-bg)]">
          <p className="text-[12.5px] text-[var(--color-violation)] font-medium">
            {error}
          </p>
        </div>
      )}

      {/* هوية المكتب */}
      <form
        onSubmit={onSaveOffice}
        className="mb-10 rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6"
      >
        <h2 className="text-[13px] font-bold text-[var(--color-ink)] mb-4">
          هوية المكتب
        </h2>
        {office && (
          <>
            <div className="flex items-start gap-5 mb-4">
              <div className="shrink-0">
                <div className="w-20 h-20 rounded-[10px] border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] grid place-items-center overflow-hidden">
                  {office.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={office.logo}
                      alt="الشعار"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-[var(--color-ink-4)]">
                      الشعار
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  className="mt-2 w-full text-[11px] text-[var(--color-brand)] hover:underline"
                >
                  {office.logo ? "تغيير" : "رفع شعار"}
                </button>
                {office.logo && (
                  <button
                    type="button"
                    onClick={() => set("logo", "")}
                    className="w-full text-[10.5px] text-[var(--color-ink-3)] hover:text-[var(--color-violation)]"
                  >
                    إزالة
                  </button>
                )}
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onLogo(f);
                  }}
                />
              </div>
              <div className="flex-1 grid sm:grid-cols-2 gap-3">
                <input
                  className={field}
                  placeholder="اسم المكتب"
                  value={office.office_name ?? ""}
                  onChange={(e) => set("office_name", e.target.value)}
                />
                <input
                  className={field}
                  placeholder="اسم المحامي"
                  value={office.lawyer_name ?? ""}
                  onChange={(e) => set("lawyer_name", e.target.value)}
                />
                <input
                  className={field}
                  placeholder="رقم الترخيص"
                  value={office.license_no ?? ""}
                  onChange={(e) => set("license_no", e.target.value)}
                />
                <input
                  className={field}
                  placeholder="الهاتف"
                  value={office.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                />
                <input
                  className={field}
                  placeholder="البريد الإلكتروني"
                  value={office.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
                <input
                  className={field}
                  placeholder="العنوان"
                  value={office.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-[8px] bg-[var(--color-brand)] text-white text-[13px] font-semibold hover:bg-[var(--color-brand-2)] transition-colors"
              >
                حفظ الهوية
              </button>
              {savedOffice && (
                <span className="text-[12px] text-[var(--color-compliant)] font-medium">
                  ● حُفظت
                </span>
              )}
            </div>
          </>
        )}
      </form>

      {/* قائمة الأسعار */}
      <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-[13px] font-bold text-[var(--color-ink)]">
            قائمة الأسعار
          </h2>
          <span className="text-[10.5px] text-[var(--color-ink-3)]">
            ر.ع لكل نوع عقد
          </span>
        </div>
        <p className="text-[11.5px] text-[var(--color-ink-3)] mb-4 leading-relaxed">
          يُملأ سعر العقد تلقائياً من نوعه المُكتشَف، ويبقى قابلاً للتعديل لكل
          عقد. أضِف أنواعاً خاصة بمكتبك.
        </p>
        <div className="space-y-2">
          {pricing.map((p, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <input
                className={field + " flex-1"}
                placeholder="نوع العقد"
                value={p.contract_type}
                onChange={(e) => {
                  const next = [...pricing];
                  next[i] = { ...p, contract_type: e.target.value };
                  setPricing(next);
                }}
              />
              <div className="relative w-36 shrink-0">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className={field + " tnum pe-10 text-end"}
                  placeholder="0.000"
                  value={p.price || ""}
                  onChange={(e) => {
                    const next = [...pricing];
                    next[i] = { ...p, price: parseFloat(e.target.value) || 0 };
                    setPricing(next);
                  }}
                />
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[10px] text-[var(--color-ink-3)]">
                  ر.ع
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPricing(pricing.filter((_, j) => j !== i))}
                className="shrink-0 w-7 h-7 grid place-items-center text-[var(--color-ink-3)] hover:text-[var(--color-violation)] transition-colors"
                aria-label="حذف"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() =>
              setPricing([...pricing, { contract_type: "", price: 0 }])
            }
            className="text-[12px] font-semibold text-[var(--color-brand)] hover:underline"
          >
            + نوع جديد
          </button>
          <span className="flex-1" />
          <button
            onClick={onSavePricing}
            className="px-4 py-2 rounded-[8px] bg-[var(--color-brand)] text-white text-[13px] font-semibold hover:bg-[var(--color-brand-2)] transition-colors"
          >
            حفظ الأسعار
          </button>
          {savedPricing && (
            <span className="text-[12px] text-[var(--color-compliant)] font-medium">
              ● حُفظت
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
