"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAnalysis, getOffice } from "@/lib/api";
import type { Clause, Office, Report } from "@/lib/types";
import { Letterhead } from "@/components/Letterhead";

/**
 * العقد المصحَّح — يدمج الصياغات البديلة التي قبِلها المحامي في وثيقة نظيفة
 * قابلة للطباعة والتنزيل. الأصل: بنود العقد كما فُكّكت، والبند المقبول بديله
 * يُستبدَل نصّه. لا ألوان ولا زخرفة — وثيقة رسمية.
 */
function finalText(c: Clause): string {
  return c.revision_status === "accepted" && c.suggested_text
    ? c.suggested_text
    : c.text;
}

export default function CorrectedPage({
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
        setError(e instanceof Error ? e.message : "تعذّر تحميل العقد"),
      );
    getOffice().then(setOffice).catch(() => setOffice(null));
  }, [id]);

  const amended = useMemo(
    () =>
      report?.clauses.filter((c) => c.revision_status === "accepted") ?? [],
    [report],
  );

  function downloadWord() {
    if (!report) return;
    const rows = report.clauses
      .map((c, i) => {
        const heading = c.heading || `البند ${i + 1}`;
        return `<h3 style="font-size:13pt;margin:18pt 0 6pt;">${
          i + 1
        }. ${escapeHtml(heading)}</h3><p style="font-size:12pt;line-height:1.9;text-align:justify;">${escapeHtml(
          finalText(c),
        )}</p>`;
      })
      .join("");
    const doc = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"></head>
<body style="font-family:'Times New Roman',serif;color:#000;">
<h1 style="text-align:center;font-size:16pt;">${escapeHtml(
      contractTitle(report.filename),
    )}</h1>
<p style="text-align:center;font-size:10pt;color:#444;">نسخة مصحَّحة — مطابقة للقانون العُمانيّ</p>
<hr/>${rows}
<p style="margin-top:24pt;font-size:9pt;color:#555;">أُعدّت هذه النسخة استناداً إلى تقرير تدقيق سديد، وتبقى مسودة حتى يعتمدها المحامي المرخّص.</p>
</body></html>`;
    const blob = new Blob(["﻿", doc], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contractTitle(report.filename)} - مصحَّح.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[820px] px-8 py-8">
      {/* شريط الأدوات — يختفي عند الطباعة */}
      <div className="no-print flex items-center gap-2 text-[11.5px] text-[var(--color-ink-faint)] mb-6">
        <Link
          href={`/analysis/${id}`}
          className="hover:text-[var(--color-ink)]"
        >
          ← رجوع إلى التقرير
        </Link>
        <div className="ms-auto flex items-center gap-2">
          <button
            onClick={downloadWord}
            disabled={!report}
            className="px-3 py-1.5 rounded-[3px] bg-[var(--color-brand)] text-white text-[12px] font-semibold hover:bg-[var(--color-brand-2)] disabled:opacity-40 transition-colors"
          >
            تنزيل Word
          </button>
          <button
            onClick={() => window.print()}
            disabled={!report}
            className="px-3 py-1.5 rounded-[3px] border border-[var(--color-rule-strong)] text-[var(--color-ink-muted)] text-[12px] font-semibold hover:border-[var(--color-ink-faint)] disabled:opacity-40 transition-colors"
          >
            طباعة / حفظ PDF
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[12.5px] text-[var(--color-violation)]">{error}</p>
      )}

      {report && (
        <>
          {/* شريط ملخّص التعديلات — شاشة فقط */}
          <div className="no-print mb-6 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
            <p className="text-[12px] text-[var(--color-ink-2)]">
              {amended.length > 0 ? (
                <>
                  دُمج{" "}
                  <span className="font-bold text-[var(--color-brand)]">
                    {amended.length}
                  </span>{" "}
                  بند مصحَّح. البنود غير المقبولة تبقى بنصّها الأصليّ.
                </>
              ) : (
                <>
                  لم تُقبل أي صياغة بديلة بعد — تظهر البنود بنصّها الأصليّ.
                  ارجع إلى التقرير واقبل البدائل المناسبة.
                </>
              )}
            </p>
          </div>

          {/* الوثيقة الرسمية */}
          <article className="doc bg-white text-black rounded-[4px] border border-[var(--color-line)] px-12 py-14 print:border-0 print:px-0 print:py-0">
            <Letterhead office={office} />
            <header className="text-center mb-8">
              <h1 className="text-[19px] font-bold">
                {contractTitle(report.filename)}
              </h1>
              <p className="mt-1.5 text-[11px] text-[#555]">
                نسخة مصحَّحة — مطابقة للقانون العُمانيّ
              </p>
              <div className="mt-4 h-px bg-black/20" />
            </header>

            <div className="space-y-5">
              {report.clauses.map((c, i) => {
                const isAmended = c.revision_status === "accepted";
                return (
                  <section key={c.clause_id} className="break-inside-avoid">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-[13.5px] font-bold">
                        {i + 1}. {c.heading || `البند ${i + 1}`}
                      </h2>
                      {isAmended && (
                        <span className="no-print text-[9.5px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand)] font-semibold">
                          معدّل
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-[2] text-justify text-black">
                      {finalText(c)}
                    </p>
                  </section>
                );
              })}
            </div>

            <footer className="mt-10 pt-4 border-t border-black/15 text-[10px] text-[#555] leading-relaxed">
              أُعدّت هذه النسخة استناداً إلى تقرير تدقيق «سديد»، وتبقى مسودة
              حتى يراجعها المحامي المرخّص ويعتمدها. القرار والمسؤولية المهنية
              على المحامي وحده.
            </footer>
          </article>
        </>
      )}
    </div>
  );
}

function contractTitle(filename: string): string {
  return filename.replace(/\.(pdf|docx?|txt)$/i, "").replace(/^[�\s-]+/, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
