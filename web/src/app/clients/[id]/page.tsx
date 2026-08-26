"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/api";
import type { Client, ClientAnalysisRow } from "@/lib/types";

export default function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [client, setClient] = useState<
    (Client & { analyses: ClientAnalysisRow[] }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getClient(id)
      .then(setClient)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "تعذّر تحميل العميل"),
      );
  }, [id]);

  return (
    <div className="mx-auto max-w-[1000px] px-8 py-10">
      <div className="flex items-center gap-2 text-[11.5px] text-[var(--color-ink-3)] mb-5">
        <Link href="/clients" className="hover:text-[var(--color-ink)]">
          العملاء
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink-2)]">
          {client?.name ?? "…"}
        </span>
      </div>

      {error && (
        <p className="text-[12.5px] text-[var(--color-violation)]">{error}</p>
      )}

      {client && (
        <>
          <div className="pb-5 mb-6 border-b border-[var(--color-line)]">
            <h1 className="display text-[24px] text-[var(--color-ink)]">
              {client.name}
            </h1>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-[var(--color-ink-2)]">
              {client.phone && (
                <span className="tnum">📞 {client.phone}</span>
              )}
              {client.email && <span>✉ {client.email}</span>}
            </div>
            {client.notes && (
              <p className="mt-2 text-[12px] text-[var(--color-ink-3)] leading-relaxed">
                {client.notes}
              </p>
            )}
          </div>

          <div className="flex items-baseline gap-2 mb-3.5">
            <h2 className="text-[13px] font-bold text-[var(--color-ink)]">
              عقود العميل
            </h2>
            <span className="tnum text-[11px] text-[var(--color-ink-3)]">
              ({client.analyses.length})
            </span>
            <span className="h-px flex-1 bg-[var(--color-line)]" />
          </div>

          {client.analyses.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-ink-3)] py-4">
              لا عقود مرتبطة بهذا العميل بعد. اربط عقداً من صفحة تحليله.
            </p>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-[10px] tracking-wide text-[var(--color-ink-4)] border-b border-[var(--color-line)]">
                    <th className="text-start font-medium pb-2.5">الملف</th>
                    <th className="text-start font-medium pb-2.5 w-20">البنود</th>
                    <th className="text-start font-medium pb-2.5 w-24">الدرجة</th>
                    <th className="text-start font-medium pb-2.5 w-32">الحالة</th>
                    <th className="text-start font-medium pb-2.5 w-36">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {client.analyses.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-[var(--color-line-soft)] hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      <td className="py-3">
                        <Link
                          href={`/analysis/${a.id}`}
                          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] transition-colors"
                        >
                          {a.filename}
                        </Link>
                      </td>
                      <td className="py-3 tnum text-[var(--color-ink-2)]">
                        {a.clause_count}
                      </td>
                      <td className="py-3 tnum font-bold text-[var(--color-ink)]">
                        {a.score ?? "—"}
                      </td>
                      <td className="py-3">
                        {a.approved_by ? (
                          <span className="text-[11px] text-[var(--color-compliant)] font-medium">
                            ● معتمَد
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--color-ink-3)]">
                            بانتظار الاعتماد
                          </span>
                        )}
                      </td>
                      <td className="py-3 tnum text-[11px] text-[var(--color-ink-3)]">
                        {new Date(a.created_at).toLocaleString("ar", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
