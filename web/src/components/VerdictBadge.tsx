import type { Verdict } from "@/lib/types";
import { VERDICT_STYLE } from "@/lib/types";

export function VerdictBadge({
  verdict,
  size = "md",
}: {
  verdict: Verdict;
  size?: "sm" | "md";
}) {
  const s = VERDICT_STYLE[verdict];
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-[3px] text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[3px] font-semibold whitespace-nowrap ${pad}`}
      style={{ color: s.fg, background: s.bg }}
    >
      <span
        className="w-1 h-1 rounded-full"
        style={{ background: s.fg }}
        aria-hidden
      />
      {s.label}
    </span>
  );
}

/** شريط أفقي يوزّع الأحكام بالتناسب — قراءة العقد بنظرة واحدة. */
export function VerdictBar({
  summary,
  total,
}: {
  summary: Record<Verdict, number>;
  total: number;
}) {
  const order: Verdict[] = ["مخالف", "ناقص", "سليم", "لا مادة ذات صلة"];
  if (!total) return null;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-[2px] bg-[var(--color-paper-sunk)]">
      {order.map((v) =>
        summary[v] ? (
          <div
            key={v}
            style={{
              width: `${(summary[v] / total) * 100}%`,
              background: VERDICT_STYLE[v].fg,
            }}
            title={`${v}: ${summary[v]}`}
          />
        ) : null,
      )}
    </div>
  );
}
