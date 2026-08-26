"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createClient,
  deleteClient,
  listClients,
  updateClient,
  type ClientPayload,
} from "@/lib/api";
import type { Client } from "@/lib/types";

const EMPTY: ClientPayload = { name: "", phone: "", email: "", notes: "" };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ClientPayload>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  async function refresh() {
    try {
      setClients(await listClients());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تحميل العملاء");
      setClients([]);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) await updateClient(editing, form);
      else await createClient(form);
      setForm(EMPTY);
      setEditing(null);
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  function onEdit(c: Client) {
    setEditing(c.id);
    setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id: string) {
    if (!confirm("حذف هذا العميل؟ تبقى عقوده وتحاليله ويُفكّ ربطها به.")) return;
    try {
      await deleteClient(id);
      if (editing === id) {
        setEditing(null);
        setForm(EMPTY);
        setShowForm(false);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحذف");
    }
  }

  const field =
    "w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
  const shown = (clients ?? []).filter((c) =>
    q ? `${c.name} ${c.phone ?? ""} ${c.email ?? ""} ${c.notes ?? ""}`.includes(q) : true,
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* الترويسة */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">ملفّات العملاء</h1>
          <p className="text-xs text-slate-400 mt-1">
            سجلّ عملاء المكتب — تنظيم العقود والأتعاب حسب كل عميل.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setShowForm((s) => !s);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold rounded-xl shadow-sm border border-amber-500/30 transition-all flex items-center gap-1.5 shrink-0"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          {showForm ? "إخفاء النموذج" : "عميل جديد"}
        </button>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/40 rounded-2xl px-4 py-3">
          <p className="text-sm text-rose-300 font-medium">{error}</p>
        </div>
      )}

      {/* نموذج */}
      {showForm && (
        <form onSubmit={onSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-slate-400">{editing ? "تعديل عميل" : "عميل جديد"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={field} placeholder="الاسم *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={field} placeholder="الهاتف" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={field} placeholder="البريد الإلكترونيّ" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className={field} placeholder="ملاحظات (الشركة/الوصف)" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="submit" disabled={busy || !form.name.trim()} className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold border border-amber-500/40 disabled:opacity-40 transition-all">
              {busy ? "جارٍ…" : editing ? "حفظ التعديل" : "إضافة العميل"}
            </button>
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(false); }} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors">
                إلغاء
              </button>
            )}
          </div>
        </form>
      )}

      {/* بحث */}
      <div className="relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في العملاء…" className="w-full pr-10 pl-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.7"/><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
      </div>

      {/* البطاقات */}
      {clients === null ? (
        <p className="text-xs text-slate-500 py-6">جارٍ التحميل…</p>
      ) : shown.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-300">{q ? "لا نتائج مطابقة." : "لا عملاء بعد."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((c) => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 space-y-4 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400 font-bold text-sm">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <Link href={`/clients/${c.id}`} className="font-bold text-white text-sm hover:text-amber-300 transition-colors">
                        {c.name}
                      </Link>
                      {c.notes && <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{c.notes}</p>}
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded font-semibold">نشط</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-slate-500"><path d="M4 5c0 8 7 15 15 15l2-3-4-2-2 2c-3-1.5-5.5-4-7-7l2-2-2-4-3 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
                      <span className="tnum">{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-slate-500"><rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6"/></svg>
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400"><span className="tnum">{c.contract_count ?? 0}</span> عقد مسجَّل</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => onEdit(c)} className="text-slate-400 hover:text-amber-300 transition-colors">تعديل</button>
                  <button onClick={() => onDelete(c.id)} className="text-slate-500 hover:text-rose-400 transition-colors">حذف</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
