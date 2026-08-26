"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { assignContractClient, listClients } from "@/lib/api";
import type { Client } from "@/lib/types";

/**
 * يربط عقداً بعميل من سجلّ المكتب — في صفحة التحليل.
 * التغيير فوريّ: يُحدَّث الاسم المعروض، ثم يُثبَّت على الخادم.
 */
export function ClientSelector({
  contractId,
  clientId,
  clientName,
}: {
  contractId: string;
  clientId: string | null;
  clientName: string | null;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [current, setCurrent] = useState<{ id: string | null; name: string | null }>(
    { id: clientId, name: clientName },
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listClients()
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  async function onChange(id: string) {
    const next = id || null;
    setSaving(true);
    try {
      await assignContractClient(contractId, next);
      const c = clients.find((x) => x.id === next);
      setCurrent({ id: next, name: c?.name ?? null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <span className="text-[11px] text-[var(--color-ink-3)]">العميل</span>
      <div className="relative">
        <select
          value={current.id ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving}
          className="appearance-none tnum ps-3 pe-8 py-1.5 rounded-[6px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[12px] text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] disabled:opacity-50 transition-colors"
        >
          <option value="">— غير مربوط —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-[9px] text-[var(--color-ink-3)]">
          ▾
        </span>
      </div>
      {current.id && (
        <Link
          href={`/clients/${current.id}`}
          className="text-[11px] text-[var(--color-brand)] hover:underline"
        >
          ملفّ العميل ←
        </Link>
      )}
      {clients.length === 0 && (
        <Link
          href="/clients"
          className="text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-brand)] transition-colors"
        >
          أضِف عملاء أولاً
        </Link>
      )}
    </div>
  );
}
