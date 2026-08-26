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
    "px-3 py-2 rounded-[6px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[13px] outline-none focus:border-[var(--color-brand)] transition-colors";

  return (
    <div className="mx-auto max-w-[900px] px-8 py-10">
      <div className="pb-5 mb-6 border-b border-[var(--color-line)]">
        <h1 className="display text-[24px] text-[var(--color-ink)]">
          متابعة المهل
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
          تواريخ انتهاء العقود وتجديدها ومواعيدها — مرتّبة بالأقرب، مع تمييز
          المتأخّر والقريب.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 border-s-2 border-[var(--color-violation)] bg-[var(--color-violation-bg)]">
          <p className="text-[12.5px] text-[var(--color-violation)] font-medium">
            {error}
          </p>
        </div>
      )}

      {/* إضافة */}
      <form
        onSubmit={onAdd}
        className="mb-8 rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
      >
        <p className="text-[11px] tracking-[0.1em] text-[var(--color-ink-3)] font-medium mb-3">
          موعد جديد
        </p>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2.5">
          <input
            className={field}
            placeholder="العنوان — مثل: تجديد عقد إيجار المكتب"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            type="date"
            className={field + " tnum"}
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
          <select
            className={field}
            value={form.client_id ?? ""}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          >
            <option value="">— بلا عميل —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <input
            className={field + " flex-1"}
            placeholder="ملاحظة (اختياري)"
            value={form.note ?? ""}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <button
            type="submit"
            disabled={busy || !form.title.trim() || !form.due_date}
            className="px-4 py-2 rounded-[8px] bg-[var(--color-brand)] text-white text-[13px] font-semibold hover:bg-[var(--color-brand-2)] disabled:opacity-40 transition-colors shrink-0"
          >
            إضافة
          </button>
        </div>
      </form>

      {/* القائمة */}
      {items === null ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)] py-6">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)] py-4">
          لا مواعيد بعد.
        </p>
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
                className={`flex items-center gap-3.5 px-4 py-3 rounded-[10px] border transition-colors ${
                  done
                    ? "border-[var(--color-line-soft)] bg-[var(--color-surface-2)] opacity-70"
                    : overdue
                      ? "border-[var(--color-violation-ring)] bg-[var(--color-violation-bg)]"
                      : soon
                        ? "border-[var(--color-deficient-ring)] bg-[var(--color-deficient-bg)]"
                        : "border-[var(--color-line)] bg-[var(--color-surface)]"
                }`}
              >
                <button
                  onClick={() => toggle(d)}
                  className={`shrink-0 w-5 h-5 rounded-full border grid place-items-center transition-colors ${
                    done
                      ? "bg-[var(--color-compliant)] border-[var(--color-compliant)] text-white"
                      : "border-[var(--color-line-strong)] hover:border-[var(--color-brand)]"
                  }`}
                  aria-label="تعليم منجَز"
                >
                  {done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[13px] font-medium ${
                      done
                        ? "text-[var(--color-ink-3)] line-through"
                        : "text-[var(--color-ink)]"
                    }`}
                  >
                    {d.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-[var(--color-ink-3)]">
                    {d.client_name && <span>{d.client_name}</span>}
                    {d.note && <span>{d.note}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <p className="tnum text-[11.5px] text-[var(--color-ink-2)]">
                    {new Date(d.due_date + "T00:00:00").toLocaleDateString("ar", {
                      dateStyle: "medium",
                    })}
                  </p>
                  <p
                    className={`text-[10.5px] font-medium ${
                      overdue
                        ? "text-[var(--color-violation)]"
                        : soon
                          ? "text-[var(--color-deficient)]"
                          : "text-[var(--color-ink-4)]"
                    }`}
                  >
                    {done
                      ? "منجَز"
                      : overdue
                        ? `متأخّر ${Math.abs(days)} يوم`
                        : days === 0
                          ? "اليوم"
                          : `بعد ${days} يوم`}
                  </p>
                </div>
                <button
                  onClick={() => remove(d.id)}
                  className="shrink-0 text-[11px] text-[var(--color-ink-4)] hover:text-[var(--color-violation)] transition-colors"
                >
                  حذف
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
