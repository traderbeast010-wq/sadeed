"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  approve,
  getAnalysis,
  pollAnalysis,
  saveClauseToLibrary,
  setRevision,
  suggestRewrite,
} from "@/lib/api";
import type { Clause, Report, Verdict } from "@/lib/types";
import { ClauseCard } from "@/components/ClauseCard";
import { ClientSelector } from "@/components/ClientSelector";
import { FeePanel } from "@/components/FeePanel";
import { ChatPanel } from "@/components/ChatPanel";
import { useAuth } from "@/lib/auth";

const EMPTY: Record<Verdict, number> = {
  مخالف: 0,
  ناقص: 0,
  سليم: 0,
  "لا مادة ذات صلة": 0,
};

const GRADE_COLOR: Record<string, string> = {
  قوي: "text-emerald-400",
  مقبول: "text-amber-400",
  ضعيف: "text-rose-400",
  مرفوض: "text-rose-400",
  "خارج النطاق": "text-slate-400",
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
  const [filter, setFilter] = useState<"all" | Verdict>("all");
  const [search, setSearch] = useState("");
  const started = useRef(false);

  const isDemo = id.startsWith("demo-");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    getAnalysis(id)
      .then(setReport)
      .catch(() => {
        setStage("جارٍ تفكيك العقد…");
        pollAnalysis(
          id,
          (p) => {
            if (p.error) {
              setError(p.error);
              return;
            }
            if (p.clause_count != null) setTotal(p.clause_count);
            setLive(p.clauses); // لقطة كاملة كل سبرة — تحديث لا إلحاق
            if (p.report) {
              setReport(p.report);
              return;
            }
            if (p.stage === "parsed") {
              setStage(`فُكّك إلى ${p.clause_count} بند — جارٍ الاسترجاع…`);
            } else if (p.stage === "retrieved") {
              setStage("استُرجعت المواد — يبدأ التدقيق…");
            } else if (p.stage === "clause") {
              setStage(
                `تدقيق البند ${p.clauses.length}${p.clause_count ? ` من ${p.clause_count}` : ""}`,
              );
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

  function markRevision(clauseId: string, status: "accepted" | "rejected") {
    setReport((prev) =>
      prev
        ? {
            ...prev,
            clauses: prev.clauses.map((c) =>
              c.clause_id === clauseId ? { ...c, revision_status: status } : c,
            ),
          }
        : prev,
    );
  }

  async function onRevise(clauseId: string, status: "accepted" | "rejected") {
    markRevision(clauseId, status);
    try {
      await setRevision(id, clauseId, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ القرار");
    }
  }

  async function acceptAll() {
    const targets = (report?.clauses ?? []).filter(
      (c) => c.suggested_text && c.revision_status !== "accepted",
    );
    targets.forEach((c) => markRevision(c.clause_id, "accepted"));
    for (const c of targets) {
      try {
        await setRevision(id, c.clause_id, "accepted");
      } catch {
        /* تجاهل */
      }
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
  const sc = report?.score;
  const hasRevisable =
    done && clauses.some((c) => c.verdict === "مخالف" || c.verdict === "ناقص");
  const acceptedCount = clauses.filter(
    (c) => c.revision_status === "accepted",
  ).length;
  const redlineCount = clauses.filter((c) => c.suggested_text).length;

  const shown = clauses.filter((c) => {
    if (
      search &&
      !`${c.heading} ${c.text} ${c.reasoning}`.includes(search.trim())
    )
      return false;
    if (filter === "all") return true;
    return c.verdict === filter;
  });

  const filters: { key: "all" | Verdict; label: string; on: string; off: string }[] = [
    { key: "all", label: `جميع البنود (${count})`, on: "bg-slate-800 text-white", off: "text-slate-400 hover:text-slate-200" },
    { key: "مخالف", label: `مخالف (${summary["مخالف"] ?? 0})`, on: "bg-rose-600 text-white", off: "text-rose-400 hover:bg-rose-950/50" },
    { key: "ناقص", label: `ناقص (${summary["ناقص"] ?? 0})`, on: "bg-amber-600 text-white", off: "text-amber-400 hover:bg-amber-950/50" },
    { key: "سليم", label: `سليم (${summary["سليم"] ?? 0})`, on: "bg-emerald-600 text-white", off: "text-emerald-400 hover:bg-emerald-950/50" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* شريط الأدوات العلويّ */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link href="/dashboard" className="text-slate-400 hover:text-white">
          التحليلات
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300 truncate max-w-[220px]">
          {report?.filename ?? "تحليل جارٍ"}
        </span>
        {done && (
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {!isDemo && (
              <button
                onClick={() => setChatOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-amber-400"><path d="M12 3l1.9 4.6L18.5 9l-3.7 3 1.1 4.8L12 14.4 8.1 16.8 9.2 12 5.5 9l4.6-1.4L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                استشر المساعد
              </button>
            )}
            {hasRevisable && (
              <Link
                href={`/analysis/${id}/corrected`}
                className="px-3.5 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 font-semibold border border-emerald-700/50 transition-colors flex items-center gap-1.5"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 4.6L18.5 9l-3.7 3 1.1 4.8L12 14.4 8.1 16.8 9.2 12 5.5 9l4.6-1.4L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                العقد المصحَّح{acceptedCount > 0 && <span className="tnum"> ({acceptedCount})</span>}
              </Link>
            )}
            <Link
              href={`/analysis/${id}/report`}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold shadow-sm shadow-amber-950/50 border border-amber-500/40 transition-all flex items-center gap-1.5"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6M6 18h12v3H6zM6 14h12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
              تصدير تقرير رسميّ
            </Link>
          </div>
        )}
      </div>

      {/* العميل والأتعاب */}
      {report && !isDemo && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
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
        <ChatPanel analysisId={id} open={chatOpen} onClose={() => setChatOpen(false)} />
      )}

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/40 rounded-2xl px-4 py-3">
          <p className="text-sm text-rose-300 font-semibold">{error}</p>
        </div>
      )}

      {/* التقدّم الحيّ */}
      {!done && !error && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between gap-4 mb-2.5">
            <span className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <span className="animate-spin w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full" />
              {stage}
            </span>
            {total && <span className="tnum text-[11px] text-slate-400">{live.length} / {total}</span>}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full transition-all duration-500 rounded-full" style={{ width: total ? `${(live.length / total) * 100}%` : "8%" }} />
          </div>
          <p className="mt-2.5 text-[11px] text-slate-400 leading-relaxed">
            النموذج يعمل محلياً بلا اتصال خارجيّ — كل بند يستغرق ثوانٍ، وتظهر النتائج فور اكتماله.
          </p>
        </div>
      )}

      {/* بانر الدرجات */}
      {report && sc && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 rounded-3xl p-6 shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {report.contract_type && (
                  <span className="text-xs font-semibold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    {report.contract_type}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  العميل: <strong className="text-slate-200">{report.client_name ?? "غير مربوط"}</strong>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{report.filename}</h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">{sc.note}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <Gauge label="درجة القوّة" value={sc.overall == null ? "—" : `${sc.overall}`} sub={sc.grade} color={GRADE_COLOR[sc.grade] ?? "text-white"} />
              <Gauge label="الامتثال" value={`${sc.compliance.score}٪`} sub="مطابقة المواد" color={sc.compliance.score >= 80 ? "text-emerald-400" : sc.compliance.score >= 60 ? "text-amber-400" : "text-rose-400"} />
              <Gauge label="الاكتمال" value={`${sc.completeness.score}٪`} sub="الشروط الإلزامية" color="text-blue-400" />
              {report.fee != null && (
                <div className="bg-amber-950/30 border border-amber-800/40 p-3.5 rounded-2xl text-center min-w-[118px]">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[10px] font-semibold text-amber-300">أتعاب التدقيق</span>
                    <span className="text-[8px] bg-amber-900/60 text-amber-200 px-1 rounded">داخليّ</span>
                  </div>
                  <div className="tnum text-xl font-bold text-amber-400 mt-1">
                    {report.fee.toLocaleString("ar", { maximumFractionDigits: 3 })} <span className="text-xs font-normal">ر.ع</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">لا تظهر في التقرير</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">توزيع الأحكام:</span>
              <span className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-2.5 py-1 rounded-lg text-xs font-medium"><span className="tnum">{summary["سليم"] ?? 0}</span> سليم</span>
              <span className="bg-rose-950/60 text-rose-300 border border-rose-800/40 px-2.5 py-1 rounded-lg text-xs font-medium"><span className="tnum">{summary["مخالف"] ?? 0}</span> مخالف</span>
              <span className="bg-amber-950/60 text-amber-300 border border-amber-800/40 px-2.5 py-1 rounded-lg text-xs font-medium"><span className="tnum">{summary["ناقص"] ?? 0}</span> ناقص</span>
            </div>
            {redlineCount > 0 && !isDemo && (
              <button
                onClick={acceptAll}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/80 px-3.5 py-1.5 rounded-lg border border-emerald-800/40 transition-colors flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                اعتماد كل الصياغات المصحَّحة (<span className="tnum">{redlineCount}</span>)
              </button>
            )}
          </div>
        </div>
      )}

      {/* شريط الفلترة */}
      {done && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
          <div className="relative w-full sm:w-80">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-400 absolute right-3 top-2.5"><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.7"/><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في البنود والتسبيب…"
              className="w-full ps-3 pe-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${filter === f.key ? `${f.on} font-bold` : f.off}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* البنود */}
      <div className="space-y-4">
        {shown.map((c) => (
          <ClauseCard
            key={c.clause_id}
            clause={c}
            index={clauses.indexOf(c)}
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
          Array.from({ length: Math.max(0, total - live.length) }).map((_, i) => (
            <div key={`sk-${i}`} className="rounded-2xl border border-dashed border-slate-800 px-5 py-5 flex items-center gap-3">
              <span className="tnum text-xs font-semibold text-slate-500 w-6">{live.length + i + 1}</span>
              <span className={`text-xs text-slate-500 ${i === 0 ? "pulse-soft" : ""}`}>
                {i === 0 ? "جارٍ التدقيق…" : "بانتظار الدور"}
              </span>
            </div>
          ))}
      </div>

      {/* سجلّ الحارس */}
      {report && report.guard_log.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-1">سجلّ الحارس</h3>
          <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
            تدخّلات برمجية رفضت أحكاماً لم تستوفِ شرط الاستشهاد بمادة مسترجَعة.
          </p>
          <ul className="space-y-1.5">
            {report.guard_log.flatMap((g) =>
              g.entries.map((e, i) => (
                <li key={`${g.clause_id}-${i}`} className="text-[11.5px] text-slate-300 flex gap-2">
                  <span className="tnum font-semibold text-slate-500">{g.clause_id}</span>
                  <span>{e}</span>
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      {/* الاعتماد */}
      {report && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <p className="text-sm font-semibold text-white">مراجعة المحامي واعتماده</p>
            <p className="mt-1 text-[11.5px] text-slate-400 leading-relaxed">
              {report.approved_by
                ? `اعتمده ${report.approved_by} بتاريخ ${new Date(report.approved_at!).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}`
                : "هذا التقرير آليّ ولا يُعتمد إلا بمراجعة محامٍ مرخّص."}
            </p>
          </div>
          {report.approved_by ? (
            <span className="px-3.5 py-1.5 rounded-lg bg-emerald-950/70 text-emerald-300 border border-emerald-800/50 text-xs font-bold flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              معتمَد
            </span>
          ) : (
            !isDemo && (
              <button
                onClick={onApprove}
                disabled={approving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold shadow-sm shadow-amber-950/50 border border-amber-500/40 transition-all disabled:opacity-50"
              >
                {approving ? "جارٍ الاعتماد…" : "اعتماد التقرير"}
              </button>
            )
          )}
        </section>
      )}
    </div>
  );
}

function Gauge({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl text-center min-w-[104px]">
      <span className="text-[11px] font-semibold text-slate-400 block">{label}</span>
      <div className={`tnum text-2xl font-black mt-1 ${color}`}>{value}</div>
      <span className="text-[10px] text-slate-400 block mt-0.5">{sub}</span>
    </div>
  );
}
