"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getAnalysis, getOffice } from "@/lib/api";
import type { Office, Report } from "@/lib/types";
import { Letterhead } from "@/components/Letterhead";

function contractTitle(filename: string): string {
  return filename.replace(/\.(pdf|docx?|txt)$/i, "").replace(/^[�\s-]+/, "");
}

const VERDICT_MARK: Record<string, string> = {
  مخالف: "■",
  ناقص: "◧",
  سليم: "□",
  "لا مادة ذات صلة": "·",
};

export default function OfficialReport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalysis(id)
      .then(setReport)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "تعذّر تحميل التقرير"),
      );
    getOffice().then(setOffice).catch(() => setOffice(null));
  }, [id]);

  const sc = report?.score;
  const s = report?.summary;

  return (
    <div className="mx-auto max-w-[820px] px-8 py-8">
      {/* شريط الأدوات — يختفي عند الطباعة */}
      <div className="no-print flex items-center gap-2 text-[11.5px] text-[var(--color-ink-faint)] mb-6">
        <Link href={`/analysis/${id}`} className="hover:text-[var(--color-ink)]">
          ← رجوع إلى التحليل
        </Link>
        <button
          onClick={() => window.print()}
          disabled={!report}
          className="ms-auto px-3 py-1.5 rounded-[3px] bg-[var(--color-brand)] text-white text-[12px] font-semibold hover:bg-[var(--color-brand-2)] disabled:opacity-40 transition-colors"
        >
          طباعة / حفظ PDF
        </button>
      </div>

      {error && (
        <p className="text-[12.5px] text-[var(--color-violation)]">{error}</p>
      )}

      {report && sc && s && (
        <article className="doc bg-white text-black rounded-[4px] border border-[var(--color-line)] px-12 py-12 print:border-0 print:px-0 print:py-0">
          <Letterhead office={office} />

          {/* العنوان */}
          <header className="text-center mb-8">
            <h1 className="text-[20px] font-bold">تقرير تدقيق قانونيّ</h1>
            <p className="mt-1 text-[11px] text-[#555]">
              تدقيق عقد مقابل القوانين العُمانية النافذة
            </p>
            <div className="mt-4 h-px bg-black/20" />
          </header>

          {/* بيانات التقرير */}
          <section className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12px] mb-7">
            <Row k="العقد" v={contractTitle(report.filename)} />
            <Row
              k="التاريخ"
              v={new Date().toLocaleDateString("ar", { dateStyle: "long" })}
            />
            {report.client_name && <Row k="العميل" v={report.client_name} />}
            <Row k="عدد البنود" v={String(report.clause_count)} />
            <Row
              k="المرجع"
              v={`${report.laws?.length ?? 7} قوانين · ${report.article_count} مادة`}
            />
            {report.contract_type && (
              <Row k="نوع العقد" v={report.contract_type} />
            )}
          </section>

          {/* الخلاصة */}
          <section className="mb-8 border border-black/25 rounded-[3px]">
            <div className="flex items-stretch">
              <div className="px-6 py-4 text-center border-e border-black/20">
                <p className="text-[9.5px] text-[#666] mb-1">درجة قوّة العقد</p>
                <p className="tnum text-[30px] font-bold leading-none">
                  {sc.overall ?? "—"}
                  {sc.overall !== null && (
                    <span className="text-[13px] text-[#777]">/100</span>
                  )}
                </p>
                <p className="text-[11px] font-bold mt-1">{sc.grade}</p>
              </div>
              <div className="flex-1 px-6 py-4">
                <p className="text-[12px] leading-relaxed mb-2">{sc.note}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px]">
                  {(["مخالف", "ناقص", "سليم", "لا مادة ذات صلة"] as const).map(
                    (v) => (
                      <span key={v}>
                        {VERDICT_MARK[v]} {v}:{" "}
                        <span className="tnum font-bold">{s[v] ?? 0}</span>
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* البنود */}
          <h2 className="text-[13px] font-bold mb-3 pb-1.5 border-b border-black/25">
            تفصيل أحكام البنود
          </h2>
          <div className="space-y-5">
            {report.clauses.map((c, i) => {
              const cit = c.citations[0];
              return (
                <section key={c.clause_id} className="break-inside-avoid">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="tnum text-[12px] font-bold">{i + 1}.</span>
                    <span className="text-[12.5px] font-bold flex-1">
                      {c.heading || `البند ${i + 1}`}
                    </span>
                    <span className="text-[11px] font-bold">
                      {VERDICT_MARK[c.verdict]} {c.verdict}
                    </span>
                  </div>
                  <p className="text-[12px] leading-[1.85] text-justify text-[#222] mb-2 ps-4 border-s-2 border-black/15">
                    {c.text}
                  </p>
                  {cit ? (
                    <p className="text-[11.5px] leading-[1.8] text-[#333] ps-4">
                      <span className="font-bold">
                        السند: {cit.law_name}، المادة ({cit.article_no}).
                      </span>{" "}
                      {cit.article_text}
                    </p>
                  ) : (
                    <p className="text-[11.5px] text-[#555] ps-4">
                      السند: لا مادة ذات صلة في القوانين المتاحة.
                    </p>
                  )}
                  <p className="text-[11.5px] leading-[1.7] text-[#444] ps-4 mt-1">
                    التعليل: {c.reasoning}
                  </p>
                </section>
              );
            })}
          </div>

          {/* بيانات المادة 36 الناقصة */}
          {sc.completeness.missing.filter((m) => m.required).length > 0 && (
            <section className="mt-8 break-inside-avoid">
              <h2 className="text-[13px] font-bold mb-2 pb-1.5 border-b border-black/25">
                بيانات توجبها المادة (36) ولم ترد في العقد
              </h2>
              <ul className="text-[12px] leading-relaxed ps-4 list-disc list-inside">
                {sc.completeness.missing
                  .filter((m) => m.required)
                  .map((m) => (
                    <li key={m.key}>{m.label}</li>
                  ))}
              </ul>
            </section>
          )}

          {/* التذييل والاعتماد */}
          <footer className="mt-10 pt-4 border-t border-black/25">
            <div className="flex items-end justify-between gap-6">
              <p className="text-[10px] text-[#666] leading-relaxed max-w-md">
                أُعِدّ هذا التقرير آلياً بمنصّة «سديد» استناداً حصراً إلى مواد
                القوانين المسترجَعة. الدرجة تُحسب بقاعدة ثابتة لا يشارك فيها أي
                نموذج. القرار النهائي والمسؤولية المهنية على المحامي المرخّص.
              </p>
              <div className="text-center shrink-0">
                <div className="w-40 border-b border-black/40 mb-1 h-8" />
                <p className="text-[10.5px] text-[#444]">
                  {report.approved_by
                    ? `اعتمده: ${report.approved_by}`
                    : "توقيع المحامي المعتمِد"}
                </p>
              </div>
            </div>
          </footer>
        </article>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[#777] shrink-0">{k}:</span>
      <span className="font-medium text-black">{v}</span>
    </div>
  );
}
