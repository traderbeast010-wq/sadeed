"use client";

import { useEffect, useRef, useState } from "react";
import { getOffice, getPricing, saveOffice, savePricing } from "@/lib/api";
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
    reader.onload = () => setOffice((o) => (o ? { ...o, logo: String(reader.result) } : o));
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
    "w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
  const set = (k: keyof Office, v: string) => setOffice((o) => (o ? { ...o, [k]: v } : o));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">الإعدادات</h1>
        <p className="text-xs text-slate-400 mt-1">
          هوية المكتب تظهر على التقارير والفواتير. قائمة الأسعار تُملأ بها أتعاب كل عقد تلقائياً حسب نوعه.
        </p>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/40 rounded-2xl px-4 py-3">
          <p className="text-sm text-rose-300 font-medium">{error}</p>
        </div>
      )}

      {/* هوية المكتب */}
      <form onSubmit={onSaveOffice} className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <h2 className="text-sm font-bold text-white mb-4">هوية المكتب</h2>
        {office && (
          <>
            <div className="flex items-start gap-5 mb-4">
              <div className="shrink-0">
                <div className="w-20 h-20 rounded-2xl border border-slate-700 bg-slate-950 grid place-items-center overflow-hidden">
                  {office.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={office.logo} alt="الشعار" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-500">الشعار</span>
                  )}
                </div>
                <button type="button" onClick={() => logoRef.current?.click()} className="mt-2 w-full text-[11px] text-amber-400 hover:text-amber-300">
                  {office.logo ? "تغيير" : "رفع شعار"}
                </button>
                {office.logo && (
                  <button type="button" onClick={() => set("logo", "")} className="w-full text-[10.5px] text-slate-500 hover:text-rose-400">
                    إزالة
                  </button>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); }} />
              </div>
              <div className="flex-1 grid sm:grid-cols-2 gap-3">
                <input className={field} placeholder="اسم المكتب" value={office.office_name ?? ""} onChange={(e) => set("office_name", e.target.value)} />
                <input className={field} placeholder="اسم المحامي" value={office.lawyer_name ?? ""} onChange={(e) => set("lawyer_name", e.target.value)} />
                <input className={field} placeholder="رقم الترخيص" value={office.license_no ?? ""} onChange={(e) => set("license_no", e.target.value)} />
                <input className={field} placeholder="الهاتف" value={office.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                <input className={field} placeholder="البريد الإلكترونيّ" value={office.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                <input className={field} placeholder="العنوان" value={office.address ?? ""} onChange={(e) => set("address", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold border border-amber-500/40 transition-all">
                حفظ الهوية
              </button>
              {savedOffice && <span className="text-xs text-emerald-400 font-medium">● حُفظت</span>}
            </div>
          </>
        )}
      </form>

      {/* قائمة الأسعار */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-sm font-bold text-white">قائمة الأسعار</h2>
          <span className="text-[10.5px] text-slate-400">ر.ع لكل نوع عقد</span>
        </div>
        <p className="text-[11.5px] text-slate-400 mb-4 leading-relaxed">
          يُملأ سعر العقد تلقائياً من نوعه المُكتشَف، ويبقى قابلاً للتعديل. أضِف أنواعاً خاصة بمكتبك.
        </p>
        <div className="space-y-2">
          {pricing.map((p, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <input
                className={field + " flex-1"}
                placeholder="نوع العقد"
                value={p.contract_type}
                onChange={(e) => { const n = [...pricing]; n[i] = { ...p, contract_type: e.target.value }; setPricing(n); }}
              />
              <div className="relative w-36 shrink-0">
                <input
                  type="number" step="0.001" min="0"
                  className={field + " tnum pe-10 text-end"}
                  placeholder="0.000"
                  value={p.price || ""}
                  onChange={(e) => { const n = [...pricing]; n[i] = { ...p, price: parseFloat(e.target.value) || 0 }; setPricing(n); }}
                />
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[10px] text-slate-400">ر.ع</span>
              </div>
              <button type="button" onClick={() => setPricing(pricing.filter((_, j) => j !== i))} className="shrink-0 w-7 h-7 grid place-items-center text-slate-500 hover:text-rose-400 transition-colors">✕</button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setPricing([...pricing, { contract_type: "", price: 0 }])} className="text-xs font-semibold text-amber-400 hover:text-amber-300">
            + نوع جديد
          </button>
          <span className="flex-1" />
          <button onClick={onSavePricing} className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold border border-amber-500/40 transition-all">
            حفظ الأسعار
          </button>
          {savedPricing && <span className="text-xs text-emerald-400 font-medium">● حُفظت</span>}
        </div>
      </div>
    </div>
  );
}
