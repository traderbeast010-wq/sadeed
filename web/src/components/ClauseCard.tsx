"use client";

import { useState } from "react";
import type { Clause } from "@/lib/types";

/**
 * بطاقة البند — تصميم Sadeed الداكن: رقم البند، الحكم، النصّ الأصليّ،
 * السند التشريعيّ (كهرمانيّ)، التسبيب، والصياغة البديلة (Redline).
 */
const STATUS: Record<
  string,
  { label: string; pill: string; border: string; icon: React.ReactNode }
> = {
  مخالف: {
    label: "مخالف للنظام العام",
    pill: "bg-rose-950/80 text-rose-300 border-rose-800/60",
    border: "border-rose-900/50 hover:border-rose-700/60",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l9.5 16.5H2.5L12 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
    ),
  },
  ناقص: {
    label: "ناقص أو غامض",
    pill: "bg-amber-950/80 text-amber-300 border-amber-800/60",
    border: "border-amber-900/50 hover:border-amber-700/60",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l9.5 16.5H2.5L12 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
    ),
  },
  سليم: {
    label: "سليم قانوناً",
    pill: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60",
    border: "border-slate-800 hover:border-slate-700",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M8.5 12.5l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
  },
  "لا مادة ذات صلة": {
    label: "لا يوجد قيد مانع",
    pill: "bg-slate-800 text-slate-300 border-slate-700",
    border: "border-slate-800 hover:border-slate-700",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M9.2 9.5a2.8 2.8 0 115.3 1.2c-.4 1-1.5 1.4-2 2.1-.3.4-.3.8-.3 1.2M12 17.5h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
    ),
  },
};

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
  const [copied, setCopied] = useState(false);
  const [savedLib, setSavedLib] = useState(false);
  const st = STATUS[clause.verdict] ?? STATUS["لا مادة ذات صلة"];
  const cited = clause.citations[0];
  const canSuggest = clause.verdict === "مخالف" || clause.verdict === "ناقص";
  const accepted = clause.revision_status === "accepted";

  function copy() {
    navigator.clipboard?.writeText(clause.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      id={clause.clause_id}
      className={`settle bg-slate-900 border rounded-3xl p-5 sm:p-6 transition-all scroll-mt-20 ${st.border}`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {/* الرأس */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="tnum w-8 h-8 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center font-bold text-sm border border-slate-700">
            {index + 1}
          </span>
          <div>
            <h2 className="text-base font-bold text-white">
              {clause.heading || `البند ${index + 1}`}
            </h2>
            <span className="text-xs text-slate-400">
              نسبة الثقة: <span className="tnum">{Math.round(clause.confidence * 100)}٪</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {clause.needs_review && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/50 font-semibold">
              يتطلّب مراجعة
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${st.pill}`}>
            {st.icon}
            <span>{st.label}</span>
          </span>
        </div>
      </div>

      {/* الجسم */}
      <div className="py-4 space-y-3">
        {/* النصّ الأصليّ */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold">النصّ الأصليّ في مسودة العقد:</span>
            <button
              onClick={copy}
              className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1"
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-400"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.7"/></svg>
              )}
              <span>{copied ? "تمّ النسخ" : "نسخ"}</span>
            </button>
          </div>
          <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-slate-800 text-sm text-slate-200 leading-relaxed">
            {clause.text}
          </div>
        </div>

        {/* السند التشريعيّ */}
        {cited ? (
          <div className="p-3.5 bg-amber-950/20 border border-amber-800/40 rounded-2xl">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5V5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              <span className="text-xs font-bold text-amber-300">
                السند التشريعيّ: المادة (<span className="tnum">{cited.article_no}</span>) من {cited.law_name}
              </span>
            </div>
            <p className="text-xs text-amber-200/90 tnum mt-1">
              {cited.decree_no ? `مرسوم ${cited.decree_no}` : ""}
              {cited.chapter ? ` · ${cited.chapter}` : ""}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed mt-1.5 whitespace-pre-line border-r-2 border-amber-500/60 pr-3">
              «{cited.article_text}»
            </p>
            {clause.citations.length > 1 && (
              <p className="mt-2 text-[11px] text-amber-400/80">
                ومواد أخرى:{" "}
                {clause.citations.slice(1).map((c) => `${c.law_name} (${c.article_no})`).join("، ")}
              </p>
            )}
          </div>
        ) : (
          <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800">
            <span className="text-xs font-bold text-slate-300 block mb-1">السند التشريعيّ:</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              لم يجد النظام مادة تتناول موضوع هذا البند.
              {clause.considered.length > 0 && (
                <>
                  {" "}فُحصت: {clause.considered.map((c) => `${c.law_name} (${c.article_no})`).join("، ")}.
                </>
              )}
            </p>
          </div>
        )}

        {/* التسبيب */}
        <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800">
          <span className="text-xs font-bold text-slate-300 block mb-1">التسبيب والتحليل القانونيّ:</span>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{clause.reasoning}</p>
          {onSaveToLibrary && (
            <button
              onClick={() => {
                onSaveToLibrary(clause);
                setSavedLib(true);
                setTimeout(() => setSavedLib(false), 1800);
              }}
              className="mt-2 text-[11px] text-slate-500 hover:text-amber-300 transition-colors"
            >
              {savedLib ? "✓ حُفظ في المكتبة" : "حفظ في المكتبة"}
            </button>
          )}
        </div>

        {/* الصياغة البديلة */}
        {clause.suggested_text ? (
          <div className="p-4 bg-gradient-to-br from-emerald-950/40 to-slate-950 border border-emerald-800/50 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-emerald-400"><path d="M12 3l1.9 4.6L18.5 9l-3.7 3 1.1 4.8L12 14.4 8.1 16.8 9.2 12 5.5 9l4.6-1.4L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                <span className="text-xs font-bold text-emerald-300">الصياغة البديلة المقترحة (Redline):</span>
              </div>
              {onRevise && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onRevise(clause.clause_id, "accepted")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                      accepted ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span>{accepted ? "معتمَد في المسودة" : "اعتماد التعديل"}</span>
                  </button>
                  {clause.revision_status === "rejected" ? (
                    <span className="text-[10px] text-slate-500">مرفوض</span>
                  ) : (
                    !accepted && (
                      <button
                        onClick={() => onRevise(clause.clause_id, "rejected")}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700"
                      >
                        رفض
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-emerald-900/60 text-sm text-emerald-200 leading-relaxed font-medium">
              {clause.suggested_text}
            </div>
            <p className="text-[11px] text-slate-500">
              اقتراح آليّ مبنيّ على نصّ المادة — يراجعه المحامي قبل الاعتماد.
            </p>
          </div>
        ) : (
          canSuggest &&
          onSuggest && (
            <button
              onClick={() => onSuggest(clause.clause_id)}
              disabled={suggesting}
              className="w-full py-2.5 rounded-2xl bg-slate-950/60 hover:bg-slate-800 border border-emerald-900/40 text-emerald-300 text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 4.6L18.5 9l-3.7 3 1.1 4.8L12 14.4 8.1 16.8 9.2 12 5.5 9l4.6-1.4L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              <span>{suggesting ? "جارٍ صياغة البديل محلياً…" : "اقترح صياغة بديلة (Redline)"}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
