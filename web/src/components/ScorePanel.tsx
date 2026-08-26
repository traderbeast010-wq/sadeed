import type { Score, Verdict } from "@/lib/types";
import { VERDICT_STYLE } from "@/lib/types";
import { VerdictBar } from "./VerdictBadge";

const GRADE_COLOR: Record<string, string> = {
  قوي: "var(--color-compliant)",
  مقبول: "var(--color-deficient)",
  ضعيف: "var(--color-violation)",
  مرفوض: "var(--color-violation)",
  "خارج النطاق": "var(--color-neutral)",
};

export function ScorePanel({
  score,
  summary,
  clauseCount,
}: {
  score: Score;
  summary: Record<Verdict, number>;
  clauseCount: number;
}) {
  const order: Verdict[] = ["مخالف", "ناقص", "سليم", "لا مادة ذات صلة"];
  const missing = score.completeness.missing.filter((m) => m.required);

  return (
    <section className="card card-raised overflow-hidden">
      <div className="grid md:grid-cols-[auto_1fr]">
        {/* الدرجة — لوحة خضراء موقّعة */}
        <div className="relative overflow-hidden md:w-[232px] text-white">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(150deg, #173eac 0%, #12318a 55%, #0a2470 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.55] pointer-events-none"
            style={{
              background:
                "radial-gradient(115% 80% at 14% 0%, rgba(232,163,61,0.30) 0%, transparent 50%)",
            }}
          />
          <div className="relative p-6 text-center md:text-start">
            <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
              <span className="h-px w-5 bg-[var(--color-accent)]" />
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[rgba(255,255,255,0.62)]">
                درجة قوة العقد
              </p>
            </div>
            <div className="flex items-baseline gap-1.5 justify-center md:justify-start">
              {score.overall === null ? (
                <span className="text-[32px] leading-none font-bold">—</span>
              ) : (
                <>
                  <span className="tnum text-[56px] leading-none font-bold">
                    {score.overall}
                  </span>
                  <span className="tnum text-[16px] text-[rgba(255,255,255,0.5)]">
                    /100
                  </span>
                </>
              )}
            </div>
            <span className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white shadow-[0_2px_8px_rgba(10,36,112,0.25)]">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: GRADE_COLOR[score.grade] ?? "var(--color-neutral)" }}
              />
              <span
                className="text-[12px] font-bold"
                style={{ color: GRADE_COLOR[score.grade] ?? "var(--color-neutral)" }}
              >
                {score.grade}
              </span>
            </span>
            <p className="mt-4 text-[11px] leading-relaxed text-[rgba(255,255,255,0.74)]">
              {score.note}
            </p>
            {score.coverage &&
              score.coverage.evaluated < score.coverage.total && (
                <p className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.14)] tnum text-[10.5px] text-[rgba(255,255,255,0.6)] leading-relaxed">
                  تغطية التدقيق: {score.coverage.evaluated} من{" "}
                  {score.coverage.total} بنود وجدت لها سنداً في القوانين المتاحة
                </p>
              )}
          </div>
        </div>

        {/* التفصيل */}
        <div className="p-5 space-y-4">
          {/* توزيع الأحكام */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10px] font-semibold text-[var(--color-ink-faint)] tracking-wide">
                توزيع الأحكام
              </span>
              <span className="tnum text-[11px] text-[var(--color-ink-faint)]">
                {clauseCount} بند
              </span>
            </div>
            <VerdictBar summary={summary} total={clauseCount} />
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {order.map((v) => (
                <span key={v} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-[1px]"
                    style={{ background: VERDICT_STYLE[v].fg }}
                  />
                  <span className="text-[11.5px] text-[var(--color-ink-muted)]">
                    {v}
                  </span>
                  <span className="tnum text-[11.5px] font-bold text-[var(--color-ink)]">
                    {summary[v] ?? 0}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* المحوران */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Axis
              label="الامتثال"
              value={score.compliance.score}
              weight={score.compliance.weight}
              hint={`خصم ${score.compliance.penalty} نقطة من أحكام البنود`}
            />
            <Axis
              label="الاكتمال"
              value={score.completeness.score}
              weight={score.completeness.weight}
              hint={`بيانات إلزامية ${score.completeness.required_present} — المادة (36)`}
            />
          </div>

          {missing.length > 0 && (
            <div className="pt-3 border-t border-[var(--color-rule)]">
              <p className="text-[10px] font-semibold text-[var(--color-ink-faint)] tracking-wide mb-1.5">
                بيانات توجبها المادة (36) ولم ترد في العقد
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {missing.map((m) => (
                  <li
                    key={m.key}
                    className="text-[11.5px] text-[var(--color-violation)] flex items-center gap-1.5"
                  >
                    <span aria-hidden>✗</span>
                    {m.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10.5px] text-[var(--color-ink-faint)] leading-relaxed pt-1">
            الدرجة تُحسب بقواعد ثابتة من أحكام البنود ومن البيانات التي توجبها
            المادة (36) — لا يشارك النموذج اللغوي في احتسابها، فهي قابلة
            للتفسير والتكرار.
          </p>
        </div>
      </div>
    </section>
  );
}

function Axis({
  label,
  value,
  weight,
  hint,
}: {
  label: string;
  value: number;
  weight: number;
  hint: string;
}) {
  return (
    <div className="rounded-[3px] border border-[var(--color-rule)] p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11.5px] font-semibold text-[var(--color-ink-muted)]">
          {label}
        </span>
        <span className="tnum text-[10.5px] text-[var(--color-ink-faint)]">
          وزن {Math.round(weight * 100)}٪
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="tnum text-[22px] font-bold leading-none">{value}</span>
        <span className="tnum text-[11px] text-[var(--color-ink-faint)]">
          /100
        </span>
      </div>
      <div className="mt-2 h-1 rounded-[1px] bg-[var(--color-paper-sunk)] overflow-hidden">
        <div
          className="h-full bg-[var(--color-seal)]"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10.5px] text-[var(--color-ink-faint)] leading-relaxed">
        {hint}
      </p>
    </div>
  );
}
