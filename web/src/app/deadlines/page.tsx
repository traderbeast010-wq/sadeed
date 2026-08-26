"use client";

import { useEffect, useState } from "react";
import {
  createDeadline,
  deleteDeadline,
  listClients,
  listDeadlines,
  setDeadlineDone,
  type DeadlinePayload,
} from "@/lib/api";
import type { Client, Deadline } from "@/lib/types";

function daysUntil(due: string): number {
  const d = new Date(due + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

const EMPTY: DeadlinePayload = { title: "", due_date: "", client_id: "" };

export default function DeadlinesPage() {
  const [items, setItems] = useState<Deadline[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<DeadlinePayload>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setItems(await listDeadlines());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحميل");
      setItems([]);
    }
  }
  useEffect(() => {
    refresh();
    listClients().then(setClients).catch(() => setClients([]));
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.due_date) return;
    setBusy(true);
    setError(null);
    try {
      await createDeadline({ ...form, client_id: form.client_id || null });
      setForm(EMPTY);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(d: Deadline) {
    await setDeadlineDone(d.id, !d.done);
    refresh();
  }
  async function remove(id: string) {
    await deleteDeadline(id);
    setItems((s) => s?.filter((x) => x.id !== id) ?? null);
  }

  const field =
    "px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">متابعة المهل القانونية</h1>
        <p className="text-xs text-slate-400 mt-1">
          تواريخ انتهاء العقود وتجديدها ومواعيدها — مرتّبة بالأقرب، مع تمييز المتأخّر والقريب.
        </p>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/40 rounded-2xl px-4 py-3">
          <p className="text-sm text-rose-300 font-medium">{error}</p>
        </div>
      )}

      {/* إضافة */}
      <form onSubmit={onAdd} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2.5">
        <p className="text-xs font-semibold text-slate-400">موعد جديد</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2.5">
          <input className={field} placeholder="العنوان — مثل: تجديد عقد إيجار المكتب" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input type="date" className={field + " tnum"} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <select className={field} value={form.client_id ?? ""} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
            <option value="">— بلا عميل —</option>
            {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input className={field + " flex-1"} placeholder="ملاحظة (اختياري)" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button type="submit" disabled={busy || !form.title.trim() || !form.due_date} className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold border border-amber-500/40 disabled:opacity-40 transition-all shrink-0">
            إضافة
          </button>
        </div>
      </form>

      {/* القائمة */}
      {items === null ? (
        <p className="text-xs text-slate-500 py-6">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 py-4">لا مواعيد بعد.</p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => {
            const days = daysUntil(d.due_date);
            const done = Boolean(d.done);
            const overdue = !done && days < 0;
            const soon = !done && days >= 0 && days <= 14;
            return (
              <div
                key={d.id}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-colors ${
                  done ? "border-slate-800 bg-slate-900/60 opacity-70" :
                  overdue ? "border-rose-800/50 bg-rose-950/30" :
                  soon ? "border-amber-800/50 bg-amber-950/20" :
                  "border-slate-800 bg-slate-900"
                }`}
              >
                <button
                  onClick={() => toggle(d)}
                  className={`shrink-0 w-5 h-5 rounded-full border grid place-items-center transition-colors ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-600 hover:border-amber-500"}`}
                >
                  {done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${done ? "text-slate-500 line-through" : "text-white"}`}>{d.title}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                    {d.client_name && <span>{d.client_name}</span>}
                    {d.note && <span>{d.note}</span>}
                  </div>
                </div>
                <div className={`shrink-0 flex items-center justify-center gap-1 min-w-[64px] px-2.5 py-1.5 rounded-xl text-center border ${
                  overdue ? "bg-rose-500/20 text-rose-300 border-rose-500/30" :
                  soon ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                  done ? "bg-slate-800 text-slate-400 border-slate-700" :
                  "bg-slate-800 text-slate-300 border-slate-700"
                }`}>
                  <span className="tnum text-xs font-bold leading-none">{done ? "✓" : days < 0 ? `-${Math.abs(days)}` : days}</span>
                  <span className="text-[10px] font-semibold leading-none">{done ? "" : "يوم"}</span>
                </div>
                <button onClick={() => remove(d.id)} className="shrink-0 text-[11px] text-slate-500 hover:text-rose-400 transition-colors">حذف</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
