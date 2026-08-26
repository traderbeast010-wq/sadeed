"use client";

import { useState } from "react";
import type { Clause } from "@/lib/types";
import { VERDICT_STYLE } from "@/lib/types";
import { VerdictBadge } from "./VerdictBadge";

/**
 * البند ومادته **متجاوران دائماً**.
 * هذه قاعدة التصميم الحاكمة: التحقّق من الاستشهاد يجب أن يتمّ بنظرة واحدة،
 * بلا نقر ولا تمرير ولا بحث. هذا هو ما يميّز أداة تدقيق عن شات بوت.
 */
export function ClauseCard({
  clause,
  index,
  onSuggest,
  suggesting,
  onRevise,
  onSaveToLibrary,
}: {
  clause: Clause;
  index: number;
  onSuggest?: (clauseId: string) => void;
  suggesting?: boolean;
  onRevise?: (clauseId: string, status: "accepted" | "rejected") => void;
  onSaveToLibrary?: (clause: Clause) => void;
}) {
  const [open, setOpen] = useState(clause.revision_status === "accepted");
  const [savedLib, setSavedLib] = useState(false);
  const style = VERDICT_STYLE[clause.verdict];
  const cited = clause.citations[0];
  const canSuggest =
    clause.verdict === "مخالف" || clause.verdict === "ناقص";
  const status = clause.revision_status ?? null;

  return (
    <article
      id={clause.clause_id}
      className="settle card overflow-hidden hover:shadow-[var(--shadow-md)] transition-shadow scroll-mt-20"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {/* الترويسة */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
        <span className="tnum text-[11px] font-semibold text-[var(--color-ink-faint)] w-6">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="text-[12px] font-semibold text-[var(--color-ink-muted)]">
          {clause.heading || `البند ${index + 1}`}
        </span>
        <div className="ms-auto flex items-center gap-2">
          {clause.needs_review && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--color-deficient-bg)] text-[var(--color-deficient)] font-semibold">
              يتطلّب مراجعة
            </span>
          )}
          <VerdictBadge verdict={clause.verdict} />
        </div>
      </div>

      {/* الجسم: البند | المادة */}
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[var(--color-rule)]">
        {/* البند */}
        <div
          className="verdict-edge p-4"
          style={{ color: style.fg }}
        >
          <p className="text-[10px] font-semibold text-[var(--color-ink-faint)] mb-2 tracking-wide">
            نصّ البند
          </p>
          <p className="text-[13.5px] leading-[1.85] text-[var(--color-ink)]">
            {clause.text}
          </p>
        </div>

        {/* المادة */}
        <div className="p-4 bg-[var(--color-paper)]/60">
          {cited ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
                <p className="text-[10px] font-semibold text-[var(--color-ink-faint)] tracking-wide">
                  السند القانوني
                </p>
                <span className="text-[11px] font-bold text-[var(--color-ink)]">
                  {cited.law_name}
                </span>
                <span className="tnum text-[12px] font-bold text-[var(--color-seal)]">
                  المادة ({cited.article_no})
                </span>
                {cited.chapter && (
                  <span className="text-[10px] text-[var(--color-ink-faint)]">
                    {cited.book} · {cited.chapter}
                  </span>
                )}
              </div>
              <p className="text-[12.5px] leading-[1.85] text-[var(--color-ink-muted)] whitespace-pre-line">
                {cited.article_text}
              </p>
              {clause.citations.length > 1 && (
                <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
                  ومواد أخرى:{" "}
                  {clause.citations
                    .slice(1)
                    .map((c) =>
                      c.law_name === cited.law_name
                        ? `(${c.article_no})`
                        : `${c.law_name} (${c.article_no})`,
                    )
                    .join("، ")}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-[var(--color-ink-faint)] mb-2 tracking-wide">
                السند القانوني
              </p>
              <p className="text-[12.5px] leading-[1.8] text-[var(--color-ink-faint)]">
                لم يجد النظام مادة تتناول موضوع هذا البند.
              </p>
              <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
                فُحصت:{" "}
                {clause.considered
                  .map((c) => `${c.law_name} (${c.article_no})`)
                  .join("، ")}
              </p>
            </>
          )}
        </div>
      </div>

      {/* السبب */}
      <div className="px-4 py-3 border-t border-[var(--color-rule)] bg-[var(--color-paper-sunk)]/40">
        <div className="flex items-start gap-2.5">
          <span className="text-[10px] font-semibold text-[var(--color-ink-faint)] shrink-0 mt-0.5">
            التعليل
          </span>
          <p className="text-[12.5px] leading-[1.75] text-[var(--color-ink-muted)]">
            {clause.reasoning}
          </p>
        </div>

        <div className="mt-2.5 flex items-center gap-3 flex-wrap">
          <span className="tnum text-[10.5px] text-[var(--color-ink-faint)]">
            الثقة {Math.round(clause.confidence * 100)}٪
          </span>
          <span className="w-px h-3 bg-[var(--color-rule)]" />
          <span className="tnum text-[10.5px] text-[var(--color-ink-faint)]">
            {clause.seconds}ث
          </span>
          {onSaveToLibrary && (
            <button
              onClick={() => {
                onSaveToLibrary(clause);
                setSavedLib(true);
                setTimeout(() => setSavedLib(false), 1800);
              }}
              className="text-[10.5px] text-[var(--color-ink-faint)] hover:text-[var(--color-brand)] transition-colors"
            >
              {savedLib ? "✓ في المكتبة" : "حفظ في المكتبة"}
            </button>
          )}

          {canSuggest && !clause.suggested_text && onSuggest && (
            <button
              onClick={() => onSuggest(clause.clause_id)}
              disabled={suggesting}
              className="ms-auto text-[11.5px] font-semibold text-[var(--color-seal)] hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {suggesting ? "جارٍ الصياغة…" : "اقترح صياغة بديلة"}
            </button>
          )}
          {clause.suggested_text && (
            <div className="ms-auto flex items-center gap-3">
              {status === "accepted" && (
                <span className="text-[10.5px] font-semibold text-[var(--color-compliant)]">
                  ● مقبول — سيُدمج في العقد المصحَّح
                </span>
              )}
              {status === "rejected" && (
                <span className="text-[10.5px] font-semibold text-[var(--color-ink-faint)]">
                  مرفوض — يبقى النصّ الأصلي
                </span>
              )}
              <button
                onClick={() => setOpen((o) => !o)}
                className="text-[11.5px] font-semibold text-[var(--color-seal)] hover:underline"
              >
                {open ? "إخفاء البديل" : "عرض البديل"}
              </button>
            </div>
          )}
        </div>

        {open && clause.suggested_text && (
          <div className="settle mt-3 p-3 rounded-[3px] border border-dashed border-[var(--color-seal)]/35 bg-[var(--color-seal-soft)]">
            <p className="text-[10px] font-semibold text-[var(--color-seal)] mb-1.5">
              صياغة بديلة مقترحة
            </p>
            <p className="text-[13px] leading-[1.85] text-[var(--color-ink)]">
              {clause.suggested_text}
            </p>
            <div className="mt-3 flex items-center gap-2.5 flex-wrap">
              <p className="text-[10.5px] text-[var(--color-ink-faint)] leading-relaxed flex-1 min-w-[180px]">
                اقتراح آليّ مبنيّ على نصّ المادة — يراجعه المحامي قبل اعتماده.
              </p>
              {onRevise && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRevise(clause.clause_id, "accepted")}
                    className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-[6px] transition-colors ${
                      status === "accepted"
                        ? "bg-[var(--color-compliant)] text-white"
                        : "border border-[var(--color-compliant)] text-[var(--color-compliant)] hover:bg-[var(--color-compliant-bg)]"
                    }`}
                  >
                    {status === "accepted" ? "✓ مقبول" : "قبول"}
                  </button>
                  <button
                    onClick={() => onRevise(clause.clause_id, "rejected")}
                    className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-[6px] transition-colors ${
                      status === "rejected"
                        ? "bg-[var(--color-neutral)] text-white"
                        : "border border-[var(--color-rule-strong)] text-[var(--color-ink-muted)] hover:bg-[var(--color-paper-sunk)]"
                    }`}
                  >
                    رفض
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
