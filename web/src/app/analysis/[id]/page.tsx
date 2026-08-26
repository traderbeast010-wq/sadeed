"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  approve,
  getAnalysis,
  saveClauseToLibrary,
  setRevision,
  streamAnalysis,
  suggestRewrite,
} from "@/lib/api";
import type { Clause, Report, Verdict } from "@/lib/types";
import { ClauseCard } from "@/components/ClauseCard";
import { ClientSelector } from "@/components/ClientSelector";
import { FeePanel } from "@/components/FeePanel";
import { ScorePanel } from "@/components/ScorePanel";
import { RoutingPanel } from "@/components/RoutingPanel";
import { VerdictBadge } from "@/components/VerdictBadge";
import { ChatPanel } from "@/components/ChatPanel";
import { useAuth } from "@/lib/auth";

const EMPTY: Record<Verdict, number> = {
  مخالف: 0,
  ناقص: 0,
  سليم: 0,
  "لا مادة ذات صلة": 0,
};

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [live, setLive] = useState<Clause[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [stage, setStage] = useState<string>("جارٍ الاتصال…");
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const started = useRef(false);

  // التحاليل المحفوظة (خطة B) تعمل بلا خادم — لكن الشات يحتاج النموذج حيّاً
  // ليولّد، فلا يعمل عليها. نخفي زرّه بدل أن يعطي «تعذّر الاتصال بالمساعد».
  const isDemo = id.startsWith("demo-");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // تحليل مكتمل سابقاً؟ اعرضه مباشرة. وإلا اتصل بالمجرى الحيّ.
    getAnalysis(id)
      .then(setReport)
      .catch(() => {
        setStage("جارٍ تفكيك العقد…");
        streamAnalysis(
          id,
          (e) => {
            if (e.stage === "parsed") {
              setTotal(e.clause_count);
              setStage(`فُكّك إلى ${e.clause_count} بند — جارٍ الاسترجاع…`);
            } else if (e.stage === "retrieved") {
              setStage("استُرجعت المواد — يبدأ التدقيق…");
            } else if (e.stage === "clause") {
              setLive((p) => [...p, e.clause]);
              setStage(`تدقيق البند ${e.index} من ${e.total}`);
            } else if (e.stage === "done") {
              setReport(e.report);
            } else if (e.stage === "error") {
              setError(e.message);
            }
          },
          setError,
        );
      });
  }, [id]);

  const liveSummary = useMemo(() => {
    const s = { ...EMPTY };
    live.forEach((c) => (s[c.verdict] += 1));
    return s;
  }, [live]);

  async function onSuggest(clauseId: string) {
    setSuggesting(clauseId);
    try {
      const r = await suggestRewrite(id, clauseId);
      setReport((prev) =>
        prev
          ? {
              ...prev,
              clauses: prev.clauses.map((c) =>
                c.clause_id === clauseId
                  ? { ...c, suggested_text: r.suggested_text }
                  : c,
              ),
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّرت الصياغة");
    } finally {
      setSuggesting(null);
    }
  }

  async function onRevise(
    clauseId: string,
    status: "accepted" | "rejected",
  ) {
    // تحديث فوريّ متفائل، ثم تثبيت على الخادم
    setReport((prev) =>
      prev
        ? {
            ...prev,
            clauses: prev.clauses.map((c) =>
              c.clause_id === clauseId
                ? { ...c, revision_status: status }
                : c,
            ),
          }
        : prev,
    );
    try {
      await setRevision(id, clauseId, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ القرار");
    }
  }

  async function onApprove() {
    setApproving(true);
    try {
      const r = await approve(id, user?.name ?? "المحامي");
      setReport((p) =>
        p ? { ...p, approved_by: r.approved_by, approved_at: r.approved_at } : p,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الاعتماد");
    } finally {
      setApproving(false);
    }
  }

  const clauses = report?.clauses ?? live;
  const summary = report?.summary ?? liveSummary;
  const count = report?.clause_count ?? total ?? live.length;
  const done = Boolean(report);
  // العقد المصحَّح متاح متى وُجد بند مخالف/ناقص (قابل لصياغة بديلة)
  const hasRevisable =
    done &&
    (report?.clauses ?? []).some(
      (c) => c.verdict === "مخالف" || c.verdict === "ناقص",
    );
  const acceptedCount = (report?.clauses ?? []).filter(
    (c) => c.revision_status === "accepted",
  ).length;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      {/* المسار */}
      <div className="flex items-center gap-2 text-[11.5px] text-[var(--color-ink-faint)] mb-4">
        <Link href="/dashboard" className="hover:text-[var(--color-ink)]">
          التحليلات
        </Link>
        <span>/</span>
        <span className="text-[var(--color-ink-muted)]">
          {report?.filename ?? "تحليل جارٍ"}
        </span>
        {done && (
          <div className="ms-auto flex items-center gap-2">
            <Link
              href={`/analysis/${id}/report`}
              className="px-3 py-1.5 rounded-[3px] border border-[var(--color-rule-strong)] text-[var(--color-ink-muted)] text-[12px] font-semibold hover:border-[var(--color-ink-faint)] transition-colors"
            >
              التقرير الرسميّ
            </Link>
            {hasRevisable && (
              <Link
                href={`/analysis/${id}/corrected`}
                className="px-3 py-1.5 rounded-[3px] border border-[var(--color-gold)] text-[var(--color-gold)] text-[12px] font-semibold hover:bg-[var(--color-gold-soft)] transition-colors"
              >
                العقد المصحَّح
                {acceptedCount > 0 && (
                  <span className="tnum"> ({acceptedCount})</span>
                )}
              </Link>
            )}
            {!isDemo && (
              <button
                onClick={() => setChatOpen(true)}
                className="px-3 py-1.5 rounded-[3px] border border-[var(--color-seal)] text-[var(--color-seal)] text-[12px] font-semibold hover:bg-[var(--color-seal-soft)] transition-colors"
              >
                استشر المساعد حول هذا العقد
              </button>
            )}
          </div>
        )}
      </div>

      {report && !isDemo && (
        <div className="mb-5 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-2)] divide-y divide-[var(--color-line)]">
          <div className="px-4 py-2.5">
            <ClientSelector
              contractId={report.contract_id}
              clientId={report.client_id ?? null}
              clientName={report.client_name ?? null}
            />
          </div>
          <div className="px-4 py-2.5">
            <FeePanel
              analysisId={id}
              clientId={report.client_id ?? null}
              initialFee={report.fee ?? null}
              initialType={report.contract_type ?? null}
              suggestedType={report.suggested_type ?? null}
            />
          </div>
        </div>
      )}

      {report && !isDemo && (
        <ChatPanel
          analysisId={id}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}

      {error && (
        <div className="mb-5 rounded-[3px] border border-[var(--color-violation)]/30 bg-[var(--color-violation-bg)] px-4 py-3">
          <p className="text-[12.5px] text-[var(--color-violation)] font-semibold">
            {error}
          </p>
        </div>
      )}

      {/* شريط التقدّم الحيّ */}
      {!done && !error && (
        <div className="mb-6 rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-raised)] px-5 py-4">
          <div className="flex items-center justify-between gap-4 mb-2.5">
            <p className="pulse-soft text-[13px] font-semibold text-[var(--color-seal)]">
              {stage}
            </p>
            {total && (
              <span className="tnum text-[11.5px] text-[var(--color-ink-faint)]">
                {live.length} / {total}
              </span>
            )}
          </div>
          <div className="h-1 rounded-[1px] bg-[var(--color-paper-sunk)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-seal)] transition-[width] duration-500"
              style={{
                width: total ? `${(live.length / total) * 100}%` : "8%",
              }}
            />
          </div>
          <p className="mt-2.5 text-[11px] text-[var(--color-ink-faint)] leading-relaxed">
            يعمل النموذج على هذا الجهاز بلا اتصال بأي خدمة خارجية — لذلك
            يستغرق كل بند بضع ثوانٍ. تظهر النتائج فور اكتمال كل بند.
          </p>
        </div>
      )}

      {/* لوحة الدرجة */}
      {report && (
        <div className="mb-6 space-y-3">
          <ScorePanel
            score={report.score}
            summary={summary}
            clauseCount={count}
          />
          {report.routing && <RoutingPanel routing={report.routing} />}
        </div>
      )}

      {/* ملخّص حيّ أثناء التدقيق */}
      {!done && live.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(Object.keys(EMPTY) as Verdict[]).map((v) =>
            summary[v] ? (
              <span key={v} className="flex items-center gap-1.5">
                <VerdictBadge verdict={v} size="sm" />
                <span className="tnum text-[12px] font-bold">{summary[v]}</span>
              </span>
            ) : null,
          )}
        </div>
      )}

      {/* البنود */}
      <div className="space-y-3">
        {clauses.map((c, i) => (
          <ClauseCard
            key={c.clause_id}
            clause={c}
            index={i}
            onSuggest={done ? onSuggest : undefined}
            suggesting={suggesting === c.clause_id}
            onRevise={done && !isDemo ? onRevise : undefined}
            onSaveToLibrary={
              done && !isDemo
                ? (cl) =>
                    saveClauseToLibrary({
                      heading: cl.heading,
                      text: cl.text,
                      verdict: cl.verdict,
                      law_name: cl.citations[0]?.law_name ?? null,
                      article_no: cl.citations[0]?.article_no ?? null,
                      source_analysis_id: id,
                      source_filename: report?.filename ?? null,
                    }).catch(() => {})
                : undefined
            }
          />
        ))}

        {!done &&
          total !== null &&
          Array.from({ length: Math.max(0, total - live.length) }).map(
            (_, i) => (
              <div
                key={`skeleton-${i}`}
                className="rounded-[3px] border border-dashed border-[var(--color-rule)] px-4 py-5 flex items-center gap-3"
              >
                <span className="tnum text-[11px] font-semibold text-[var(--color-ink-faint)] w-6">
                  {String(live.length + i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`text-[12px] text-[var(--color-ink-faint)] ${
                    i === 0 ? "pulse-soft" : ""
                  }`}
                >
                  {i === 0 ? "جارٍ التدقيق…" : "بانتظار الدور"}
                </span>
              </div>
            ),
          )}
      </div>

      {/* سجلّ الحارس */}
      {report && report.guard_log.length > 0 && (
        <section className="mt-6 rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-raised)] p-4">
          <h3 className="text-[12px] font-bold mb-2">سجلّ الحارس</h3>
          <p className="text-[11px] text-[var(--color-ink-faint)] mb-2.5 leading-relaxed">
            تدخّلات برمجية رفضت أو خفّضت أحكاماً لم تستوفِ شرط الاستشهاد.
          </p>
          <ul className="space-y-1.5">
            {report.guard_log.flatMap((g) =>
              g.entries.map((e, i) => (
                <li
                  key={`${g.clause_id}-${i}`}
                  className="text-[11.5px] text-[var(--color-ink-muted)] flex gap-2"
                >
                  <span className="tnum font-semibold text-[var(--color-ink-faint)]">
                    {g.clause_id}
                  </span>
                  <span>{e}</span>
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      {/* الاعتماد */}
      {report && (
        <section className="mt-6 rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-raised)] px-5 py-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <p className="text-[12.5px] font-semibold">مراجعة المحامي</p>
            <p className="mt-1 text-[11.5px] text-[var(--color-ink-muted)] leading-relaxed">
              {report.approved_by
                ? `اعتمده ${report.approved_by} بتاريخ ${new Date(
                    report.approved_at!,
                  ).toLocaleString("ar", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`
                : "هذا التقرير آليّ ولا يُعتمد إلا بمراجعة محامٍ مرخّص."}
            </p>
          </div>
          {report.approved_by ? (
            <span className="px-3 py-1.5 rounded-[3px] bg-[var(--color-compliant-bg)] text-[var(--color-compliant)] text-[12px] font-bold">
              معتمَد
            </span>
          ) : (
            <button
              onClick={onApprove}
              disabled={approving}
              className="px-4 py-2 rounded-[3px] bg-[var(--color-seal)] text-[var(--color-paper)] text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {approving ? "جارٍ الاعتماد…" : "اعتماد التقرير"}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
