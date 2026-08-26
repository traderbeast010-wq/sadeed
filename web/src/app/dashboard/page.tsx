"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  demoList,
  health,
  listAnalyses,
  startAnalysis,
  uploadContract,
} from "@/lib/api";
import type { AnalysisRow } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<AnalysisRow[] | null>(null);
  const [corpus, setCorpus] = useState<{ lawCount: number; articleCount: number } | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    health()
      .then((h) =>
        setCorpus({ lawCount: h.law_count, articleCount: h.article_count }),
      )
      .catch(() => setOffline(true));
    listAnalyses().then(setRows).catch(() => setRows([]));
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

  return (
    <div className="mx-auto max-w-[1080px] px-8 pb-16">
      {/* لوحة الاستقبال — الأخضر العُمانيّ توقيعُ المنتج */}
      <div className="relative mt-8 overflow-hidden rounded-[20px] text-white shadow-[0_20px_60px_-20px_rgba(15,53,39,0.55)]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #1c5c46 0%, #164a38 52%, #0f3527 100%)",
          }}
        />
        {/* توهّج ذهبيّ خفيف + بريق علويّ */}
        <div
          className="absolute inset-0 opacity-[0.5] pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 90% at 12% 0%, rgba(156,124,63,0.28) 0%, transparent 45%), radial-gradient(90% 80% at 100% 120%, rgba(255,255,255,0.06) 0%, transparent 50%)",
          }}
        />
        <div className="relative px-9 sm:px-11 py-11">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
            <div className="max-w-xl">
              <div className="flex items-center gap-2.5 mb-5">
                <span className="h-px w-8 bg-[var(--color-accent)]" />
                <span className="text-[11px] tracking-[0.22em] text-[rgba(255,255,255,0.62)] font-medium">
                  سديد
                </span>
              </div>
              <h1 className="display text-[34px] sm:text-[40px] leading-[1.08]">
                تدقيق العقود مقابل
                <br />
                القانون العُمانيّ
              </h1>
              <p className="mt-4 text-[13.5px] leading-relaxed text-[rgba(255,255,255,0.72)] max-w-md">
                يُفكَّك العقد إلى بنود، ويُحكَم على كلٍّ منها باستشهادٍ من نصّ
                المادة وقانونها — لا رأي بلا سند.
              </p>
            </div>

            {/* إحصاءات المتن — مفصولة بخيط ذهبيّ */}
            <div className="flex items-stretch gap-6 shrink-0 sm:pb-1">
              <div className="text-end">
                <p className="tnum text-[32px] font-bold leading-none">
                  {corpus?.articleCount ?? "٢٥٩٦"}
                </p>
                <p className="text-[10.5px] text-[rgba(255,255,255,0.55)] mt-1.5">
                  مادة مفهرَسة
                </p>
              </div>
              <div className="w-px bg-[rgba(156,124,63,0.55)]" />
              <div className="text-end">
                <p className="tnum text-[32px] font-bold leading-none">
                  {corpus?.lawCount ?? "٧"}
                </p>
                <p className="text-[10.5px] text-[rgba(255,255,255,0.55)] mt-1.5">
                  قوانين نافذة
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {offline && (
        <div className="mt-5 px-4 py-3 rounded-[var(--radius)] border-s-2 border-[var(--color-deficient)] bg-[var(--color-deficient-bg)]">
          <p className="text-[12.5px] text-[var(--color-deficient)] font-medium">
            الخادم متوقّف — التحاليل المحفوظة أدناه متاحة، أو شغّل{" "}
            <code className="tnum">.\run.ps1</code>
          </p>
        </div>
      )}

      {/* بطاقة الرفع — مرفوعة فوق اللوحة بظلّ حقيقيّ */}
      <div className="relative -mt-6 mx-1 sm:mx-6 grid lg:grid-cols-[1.7fr_1fr]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`relative rounded-[16px] bg-[var(--color-surface)] shadow-[0_16px_40px_-16px_rgba(26,26,23,0.22)] transition-all ${
            drag
              ? "ring-2 ring-[var(--color-brand)] ring-offset-2 ring-offset-[var(--color-canvas)]"
              : "ring-1 ring-[var(--color-line)]"
          }`}
        >
          <div className="px-8 py-9">
            {busy ? (
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin" />
                <div>
                  <div className="text-[14px] font-semibold text-[var(--color-ink)]">
                    {busy}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">
                    اترك الصفحة مفتوحة حتى ينتهي.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="group shrink-0 inline-flex items-center gap-2.5 px-5 py-3 rounded-[10px] bg-[var(--color-brand)] text-white text-[13.5px] font-semibold shadow-[0_6px_18px_-6px_rgba(28,92,70,0.6)] hover:bg-[var(--color-brand-2)] transition-colors"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 16V5m0 0L8 9m4-4l4 4M5 19h14"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  اختيار ملف العقد
                </button>
                <div>
                  <p className="text-[14.5px] font-medium text-[var(--color-ink)]">
                    أو اسحب العقد وأفلته هنا
                  </p>
                  <p className="mt-1 text-[11.5px] text-[var(--color-ink-3)]">
                    PDF أو Word، حتى ١٠ ميجابايت · يُعالَج على هذا الجهاز
                  </p>
                </div>
              </div>
            )}
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
          </div>
        </div>
        <div className="hidden lg:block" />
      </div>

      {error && (
        <p className="mt-4 mx-6 text-[12.5px] text-[var(--color-violation)]">
          {error}
        </p>
      )}

      {/* نماذج جاهزة — صفّ بطاقات أنيق */}
      <div className="mt-11">
        <div className="flex items-baseline gap-2 mb-3.5">
          <h2 className="text-[13px] font-bold text-[var(--color-ink)]">
            نماذج جاهزة للاستعراض
          </h2>
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {demoList().map((d, i) => (
            <a
              key={d.id}
              href={`/analysis/${d.id}`}
              className="group rise flex items-center justify-between gap-3 px-4 py-3.5 rounded-[12px] bg-[var(--color-surface)] ring-1 ring-[var(--color-line)] hover:ring-[var(--color-brand-ring)] hover:shadow-[0_10px_28px_-14px_rgba(26,26,23,0.2)] transition-all"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span className="text-[12.5px] text-[var(--color-ink-2)] group-hover:text-[var(--color-ink)] transition-colors leading-snug">
                {d.label}
              </span>
              <span className="shrink-0 w-6 h-6 grid place-items-center rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand)] group-hover:bg-[var(--color-brand)] group-hover:text-white transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M15 6l-6 6 6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* السجلّ */}
      <div className="mt-11">
        <div className="flex items-baseline gap-2 mb-3.5">
          <h2 className="text-[13px] font-bold text-[var(--color-ink)]">
            التحليلات السابقة
          </h2>
          {rows && rows.length > 0 && (
            <span className="tnum text-[11px] text-[var(--color-ink-3)]">
              ({rows.length})
            </span>
          )}
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>

        {rows === null ? (
          <p className="text-[12.5px] text-[var(--color-ink-3)] py-6">
            جارٍ التحميل…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-ink-3)] py-4">
            لا توجد تحليلات بعد.
          </p>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10px] tracking-wide text-[var(--color-ink-4)] border-b border-[var(--color-line)]">
                  <th className="text-start font-medium pb-2.5">الملف</th>
                  <th className="text-start font-medium pb-2.5 w-32">العميل</th>
                  <th className="text-start font-medium pb-2.5 w-16">البنود</th>
                  <th className="text-start font-medium pb-2.5 w-20">الدرجة</th>
                  <th className="text-start font-medium pb-2.5 w-32">الحالة</th>
                  <th className="text-start font-medium pb-2.5 w-32">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--color-line-soft)] hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <td className="py-3">
                      <Link
                        href={`/analysis/${r.id}`}
                        className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] transition-colors"
                      >
                        {r.filename}
                      </Link>
                    </td>
                    <td className="py-3 text-[12px] text-[var(--color-ink-2)]">
                      {r.client_id ? (
                        <Link
                          href={`/clients/${r.client_id}`}
                          className="hover:text-[var(--color-brand)] transition-colors"
                        >
                          {r.client_name}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-ink-4)]">—</span>
                      )}
                    </td>
                    <td className="py-3 tnum text-[var(--color-ink-2)]">
                      {r.clause_count}
                    </td>
                    <td className="py-3 tnum font-bold text-[var(--color-ink)]">
                      {r.score ?? "—"}
                    </td>
                    <td className="py-3">
                      {r.approved_by ? (
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
                      {new Date(r.created_at).toLocaleString("ar", {
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
      </div>
    </div>
  );
}
