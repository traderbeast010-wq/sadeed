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
  const [busy, setBusy] = useState(false);

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
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  function onEdit(c: Client) {
    setEditing(c.id);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      notes: c.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id: string) {
    if (!confirm("حذف هذا العميل؟ تبقى عقوده وتحاليله، ويُفكّ ربطها به.")) return;
    try {
      await deleteClient(id);
      if (editing === id) {
        setEditing(null);
        setForm(EMPTY);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحذف");
    }
  }

  const field =
    "w-full px-3 py-2 rounded-[6px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[13px] outline-none focus:border-[var(--color-brand)] transition-colors";

  return (
    <div className="mx-auto max-w-[1000px] px-8 py-10">
      <div className="pb-5 mb-6 border-b border-[var(--color-line)]">
        <div className="flex items-baseline gap-3">
          <h1 className="display text-[24px] text-[var(--color-ink)]">العملاء</h1>
          {clients && (
            <span className="tnum text-[12px] text-[var(--color-ink-3)]">
              {clients.length}
            </span>
          )}
        </div>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
          سجلّ عملاء المكتب — لتنظيم العقود والأتعاب حسب كل عميل.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 border-s-2 border-[var(--color-violation)] bg-[var(--color-violation-bg)]">
          <p className="text-[12.5px] text-[var(--color-violation)] font-medium">
            {error}
          </p>
        </div>
      )}

      {/* نموذج الإضافة/التعديل */}
      <form
        onSubmit={onSubmit}
        className="mb-8 rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
      >
        <p className="text-[11px] tracking-[0.1em] text-[var(--color-ink-3)] font-medium mb-3">
          {editing ? "تعديل عميل" : "عميل جديد"}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className={field}
            placeholder="الاسم *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className={field}
            placeholder="الهاتف"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            className={field}
            placeholder="البريد الإلكتروني"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className={field}
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            disabled={busy || !form.name.trim()}
            className="px-4 py-2 rounded-[8px] bg-[var(--color-brand)] text-white text-[13px] font-semibold hover:bg-[var(--color-brand-2)] disabled:opacity-40 transition-colors"
          >
            {busy ? "جارٍ الحفظ…" : editing ? "حفظ التعديل" : "إضافة العميل"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
              className="px-4 py-2 rounded-[8px] border border-[var(--color-line-strong)] text-[var(--color-ink-muted)] text-[13px] font-semibold hover:bg-[var(--color-surface-2)] transition-colors"
            >
              إلغاء
            </button>
          )}
        </div>
      </form>

      {/* القائمة */}
      {clients === null ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)] py-6">جارٍ التحميل…</p>
      ) : clients.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)] py-4">
          لا عملاء بعد. أضِف أوّل عميل من النموذج أعلاه.
        </p>
      ) : (
        <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden">
          {clients.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--color-surface-2)] transition-colors ${
                i > 0 ? "border-t border-[var(--color-line-soft)]" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/clients/${c.id}`}
                  className="text-[13.5px] font-semibold text-[var(--color-ink)] hover:text-[var(--color-brand)] transition-colors"
                >
                  {c.name}
                </Link>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-[var(--color-ink-3)]">
                  {c.phone && <span className="tnum">{c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                  {c.notes && <span className="truncate">{c.notes}</span>}
                </div>
              </div>
              <span className="tnum text-[11px] text-[var(--color-ink-3)] shrink-0">
                {c.contract_count ?? 0} عقد
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onEdit(c)}
                  className="px-2 py-1 text-[11.5px] text-[var(--color-ink-muted)] hover:text-[var(--color-brand)] transition-colors"
                >
                  تعديل
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  className="px-2 py-1 text-[11.5px] text-[var(--color-ink-3)] hover:text-[var(--color-violation)] transition-colors"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
