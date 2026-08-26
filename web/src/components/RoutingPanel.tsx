import type { RoutingRow } from "@/lib/types";

/**
 * لوحة ترجيح القوانين — تُظهر كيف وزّع الموجّه العقد على القوانين السبعة.
 *
 * الشفافية في الترجيح جزء من المنتج: الحكّام (والمحامي) يرون لماذا استند
 * النظام إلى قانون دون آخر — وأنه لا يفلتر بل يرجّح، فتبقى القوانين
 * العابرة حاضرة بوزن أقلّ لا صفر.
 */
export function RoutingPanel({ routing }: { routing: RoutingRow[] }) {
  if (!routing?.length) return null;
  const primary = routing[0];
  const active = routing.filter((r) => r.weight >= 0.5);

  return (
    <details className="group card overflow-hidden">
      <summary className="cursor-pointer list-none px-4 py-2.5 flex items-center gap-2 text-[12px]">
        <span className="text-[10px] text-[var(--color-ink-faint)] transition-transform group-open:rotate-90">
          ▸
        </span>
        <span className="font-semibold text-[var(--color-ink-muted)]">
          موجّه النطاق
        </span>
        <span className="text-[var(--color-ink-faint)]">
          القانون الأساسي:{" "}
          <span className="font-bold text-[var(--color-seal)]">
            {primary.law_name}
          </span>
          {active.length > 1 && (
            <span className="text-[11px]">
              {" "}
              + {active.length - 1} قانون مساعد
            </span>
          )}
        </span>
      </summary>

      <div className="px-4 pb-3 pt-1 border-t border-[var(--color-rule)]">
        <p className="text-[10.5px] text-[var(--color-ink-faint)] leading-relaxed my-2">
          يرجّح النظام القوانين بحسب نوع العقد قبل الاسترجاع — بلا نموذج
          لغوي، بمقارنة العقد بمركز ثقل كل قانون. الوزن الأقلّ لا يُلغي
          القانون، فتبقى الإحالات العابرة ممكنة.
        </p>
        <div className="space-y-1.5">
          {routing.map((r) => (
            <div key={r.law_id} className="flex items-center gap-2.5">
              <span className="tnum text-[10px] text-[var(--color-ink-faint)] w-8 text-start">
                {r.weight.toFixed(2)}
              </span>
              <div className="flex-1 h-1.5 rounded-[1px] bg-[var(--color-paper-sunk)] overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${r.similarity * 100}%`,
                    background:
                      r.weight >= 1
                        ? "var(--color-seal)"
                        : r.weight >= 0.5
                          ? "var(--color-compliant)"
                          : "var(--color-rule-strong)",
                  }}
                />
              </div>
              <span
                className={`text-[11.5px] w-44 ${
                  r.weight >= 0.5
                    ? "text-[var(--color-ink)] font-medium"
                    : "text-[var(--color-ink-faint)]"
                }`}
              >
                {r.law_name}
              </span>
              <span className="tnum text-[10px] text-[var(--color-ink-faint)] w-10 text-end">
                {r.similarity.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
