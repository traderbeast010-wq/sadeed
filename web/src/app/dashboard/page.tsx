"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getOffice,
  getRevenue,
  health,
  listAnalyses,
  listDeadlines,
  reviewQueue,
  startAnalysis,
  uploadContract,
} from "@/lib/api";
import type {
  AnalysisRow,
  Deadline,
  Office,
  RevenueSummary,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";

function daysUntil(due: string): number {
  const d = new Date(due + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<AnalysisRow[] | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [office, setOffice] = useState<Office | null>(null);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [corpus, setCorpus] = useState<{ laws: number; arts: number } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listAnalyses().then(setRows).catch(() => setRows([]));
    listDeadlines().then(setDeadlines).catch(() => setDeadlines([]));
    getOffice().then(setOffice).catch(() => setOffice(null));
    getRevenue().then(setRevenue).catch(() => setRevenue(null));
    reviewQueue().then((q) => setReviewCount(q.length)).catch(() => {});
    health()
      .then((h) => setCorpus({ laws: h.law_count, arts: h.article_count }))
      .catch(() => {});
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        setBusy("جارٍ قراءة الملف وتفكيكه إلى بنود…");
        const up = await uploadContract(file);
        setBusy(`استُخرج ${up.clause_count} بنداً — يبدأ التدقيق…`);
        const a = await startAnalysis(up.contract_id);
        router.push(`/analysis/${a.analysis_id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر رفع الملف");
        setBusy(null);
      }
    },
    [router],
  );

  const scored = (rows ?? []).filter((r) => r.score != null);
  const avgCompliance = scored.length
    ? Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length)
    : 0;
  const fees = revenue?.fees_total ?? 0;
  const pendingDeadlines = deadlines.filter((d) => !d.done);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {/* بانر الترحيب */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>مساحة العمل القانونية — معالجة محلية ١٠٠٪</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-normal">
              مرحباً بك، {user?.name ?? "المحامي"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {office?.office_name || "مكتبك"}
              {office?.license_no && (
                <>
                  {" "}
                  · <span className="tnum">قيد {office.license_no}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-amber-950/60 border border-amber-500/40 transition-all active:scale-95 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>{busy ? "جارٍ التدقيق…" : "تدقيق عقد جديد"}</span>
            </button>

            <Link
              href="/assistant"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium border border-slate-700/80 transition-all active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-400">
                <path d="M12 3l1.9 4.6L18.5 9l-3.7 3 1.1 4.8L12 14.4 8.1 16.8 9.2 12 5.5 9l4.6-1.4L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span>استشارة قانونية ذكية</span>
            </Link>
          </div>
        </div>
      </div>

      {busy && (
        <p className="text-xs text-amber-400 -mt-4">{busy} — اترك الصفحة مفتوحة.</p>
      )}
      {error && <p className="text-xs text-rose-400 -mt-4">{error}</p>}

      {/* ٤ بطاقات إحصاء */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* العقود المدققة */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">العقود المدقّقة</span>
              <div className="w-8 h-8 rounded-lg bg-blue-950/70 border border-blue-800/40 flex items-center justify-center text-blue-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13H7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="tnum text-3xl font-bold text-white">{rows?.length ?? 0}</span>
              <span className="text-xs text-slate-400">عقد مفحوص</span>
            </div>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-emerald-400 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>مطابقة لـ {corpus?.laws ?? 7} قوانين عُمانية</span>
          </p>
        </div>

        {/* متوسط الامتثال */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">متوسّط الامتثال</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3.5v5.2c0 4.3-3 7.4-7 8.3-4-.9-7-4-7-8.3V6.5L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12l2.1 2.1L15 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="tnum text-3xl font-bold text-white">{avgCompliance}٪</span>
              <span className="text-xs text-slate-400">مؤشّر الجودة</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-l from-emerald-400 to-amber-500 h-full rounded-full" style={{ width: `${avgCompliance}%` }} />
            </div>
          </div>
        </div>

        {/* تقدير الأتعاب */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400">تقدير الأتعاب</span>
                <span className="text-[9px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded border border-amber-900/30">داخليّ فقط</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-950/70 border border-amber-800/40 flex items-center justify-center text-amber-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 7h4v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="tnum text-3xl font-bold text-white">{fees.toLocaleString("ar", { maximumFractionDigits: 3 })}</span>
              <span className="text-xs text-amber-400 font-semibold">ر.ع</span>
            </div>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
            محسوبة تلقائياً حسب تسعيرة المكتب
          </p>
        </div>

        {/* تحتاج مراجعة */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">تحتاج مراجعة عاجلة</span>
              <div className="w-8 h-8 rounded-lg bg-rose-950/70 border border-rose-800/40 flex items-center justify-center text-rose-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3l9.5 16.5H2.5L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="tnum text-3xl font-bold text-rose-400">{reviewCount}</span>
              <span className="text-xs text-slate-400">بند يحتاج قراراً</span>
            </div>
          </div>
          <Link href="/review" className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-rose-300 hover:text-rose-200 flex items-center justify-between font-medium">
            <span>استعراض البنود</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </div>
      </div>

      {/* الشبكة الرئيسية */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* العقود الأخيرة (٨ أعمدة) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">العقود الأخيرة المدقّقة</h2>
              <p className="text-xs text-slate-400">انقر أي عقد لمعاينة تقرير التدقيق ومواده</p>
            </div>
          </div>

          {rows === null ? (
            <p className="text-xs text-slate-500 py-6">جارٍ التحميل…</p>
          ) : rows.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center">
              <p className="text-sm text-slate-300">لا عقود مدقّقة بعد.</p>
              <button onClick={() => fileRef.current?.click()} className="mt-3 text-xs text-amber-400 hover:text-amber-300 font-semibold">
                ابدأ بتدقيق عقد ←
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((c) => {
                const scoreColor =
                  c.score == null
                    ? "text-slate-400"
                    : c.score >= 80
                      ? "text-emerald-400"
                      : c.score >= 60
                        ? "text-amber-400"
                        : "text-rose-400";
                return (
                  <Link
                    key={c.id}
                    href={`/analysis/${c.id}`}
                    className="block bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 transition-all group hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                            <span className="tnum">{c.clause_count}</span> بند
                          </span>
                          <span className="text-xs text-slate-400">
                            {c.client_name ?? "بلا عميل"}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-100 group-hover:text-amber-300 transition-colors mt-1.5 truncate">
                          {c.filename}
                        </h3>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-center">
                          <div className="text-xs font-semibold text-slate-400">الدرجة</div>
                          <span className={`tnum text-sm font-bold ${scoreColor}`}>
                            {c.score ?? "—"}
                          </span>
                        </div>
                        <span
                          className="hidden sm:block text-[11px] px-2 py-1 rounded font-semibold border"
                          style={{
                            background: c.approved_by ? "rgba(6,37,31,0.7)" : "rgba(30,41,59,0.7)",
                            borderColor: c.approved_by ? "rgba(18,86,72,0.5)" : "rgba(51,65,85,0.6)",
                            color: c.approved_by ? "#34d399" : "#94a3b8",
                          }}
                        >
                          {c.approved_by ? "معتمَد" : "بانتظار الاعتماد"}
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-amber-600 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-end text-xs text-slate-400">
                      <span className="tnum text-[11px]">
                        {new Date(c.created_at).toLocaleDateString("ar", { dateStyle: "medium" })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* المهل + المرجع (٤ أعمدة) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-400"><rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <h3 className="text-sm font-bold text-white">المهل القانونية القادمة</h3>
              </div>
              <Link href="/deadlines" className="text-[11px] text-slate-400 hover:text-amber-300 transition-colors">
                عرض الكل
              </Link>
            </div>

            {pendingDeadlines.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-2">لا مهل قادمة.</p>
            ) : (
              <div className="space-y-3">
                {pendingDeadlines.slice(0, 3).map((dl) => {
                  const days = daysUntil(dl.due_date);
                  return (
                    <div key={dl.id} className="bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-slate-200 text-xs truncate block leading-snug">{dl.title}</span>
                          <p className="text-[11px] text-slate-400 mt-1 truncate">
                            {dl.client_name ? `${dl.client_name} · ` : ""}
                            <span className="tnum">{new Date(dl.due_date + "T00:00:00").toLocaleDateString("ar", { dateStyle: "medium" })}</span>
                          </p>
                        </div>
                        <div className={`shrink-0 flex items-center justify-center gap-1 min-w-[62px] px-2.5 py-1.5 rounded-xl text-center border ${
                          days <= 7 ? "bg-rose-500/20 text-rose-300 border-rose-500/30" :
                          days <= 15 ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                          "bg-slate-800 text-slate-300 border-slate-700"
                        }`}>
                          <span className="tnum text-xs font-bold leading-none">{days < 0 ? `-${Math.abs(days)}` : days}</span>
                          <span className="text-[10px] font-semibold leading-none">يوم</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* مرجع القوانين */}
          <div className="bg-gradient-to-br from-slate-900 to-amber-950/30 border border-amber-900/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5V5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              <span>القوانين العُمانية المفهرَسة</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              فُهرست <strong className="text-slate-100">{corpus?.laws ?? 7} قوانين عُمانية نافذة</strong> — منها قانون العمل 53/2023 والمعاملات المدنية 29/2013 — بمجموع{" "}
              <span className="tnum">{corpus?.arts ?? 2596}</span> مادة صريحة.
            </p>
            <Link href="/law" className="mt-3.5 w-full py-2.5 bg-slate-800/90 hover:bg-slate-800 text-amber-300 text-xs font-semibold rounded-xl border border-amber-500/30 transition-colors flex items-center justify-center gap-1.5">
              <span>البحث في نصوص المواد</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
