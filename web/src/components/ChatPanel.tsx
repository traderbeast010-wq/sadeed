"use client";

import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";

interface Turn {
  role: "user" | "assistant";
  content: string;
  articles?: number[];
  mode?: string;
  guardLog?: string[];
}

const SUGGESTIONS = [
  "من هم الأطراف؟",
  "أخطر مخالفة؟",
  "اشرح البند الأول",
  "لماذا هذه الدرجة؟",
];

const MODE_LABEL: Record<string, string> = {
  greeting: "ترحيب",
  meta: "تعريف",
  session: "ملخّص",
  grounded: "من القانون",
};

export function ChatPanel({
  analysisId,
  open,
  onClose,
}: {
  analysisId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [mode, setMode] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, partial]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 450);
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming) return;
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((p) => [...p, { role: "user", content: q }]);
    setInput("");
    setStreaming(true);
    setPartial("");
    setMode(null);
    try {
      const res = await fetch(`${API}/analyses/${analysisId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history }),
      });
      if (!res.ok || !res.body) throw new Error("تعذّر الاتصال بالمساعد");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const block of lines) {
          const line = block.trim();
          if (!line.startsWith("data: ")) continue;
          const evt = JSON.parse(line.slice(6));
          if (evt.stage === "meta") setMode(evt.mode);
          else if (evt.stage === "token") {
            acc += evt.text;
            setPartial(acc);
          } else if (evt.stage === "done") {
            setTurns((p) => [
              ...p,
              {
                role: "assistant",
                content: evt.answer,
                articles: (evt.articles ?? []).map(
                  (a: { article_no: number }) => a.article_no,
                ),
                mode: evt.mode,
                guardLog: evt.guard_log ?? [],
              },
            ]);
            setPartial("");
          } else if (evt.stage === "error") throw new Error(evt.message);
        }
      }
    } catch (e) {
      setTurns((p) => [
        ...p,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "حدث خطأ أثناء المحادثة.",
        },
      ]);
      setPartial("");
    } finally {
      setStreaming(false);
      setMode(null);
    }
  }

  const empty = turns.length === 0 && !streaming;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-stretch justify-start transition-opacity duration-500 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      dir="rtl"
    >
      {/* ستارة خفيفة — تُبقي التقرير واضحاً، الفصل بالظلّ لا بالتغبيش */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(10,16,22,0.14)] transition-opacity duration-500"
      />

      {/* البطاقة العائمة — سطح صلب نقيّ، مرفوع عن الحواف */}
      <div
        className={`relative m-3 sm:m-4 w-full sm:w-[430px] flex flex-col rounded-[24px] overflow-hidden bg-[var(--color-canvas)] transition-transform duration-[500ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "translate-x-0 scale-100" : "-translate-x-8 scale-95"
        }`}
        style={{
          boxShadow:
            "0 40px 80px -20px rgba(10,16,22,0.45), 0 12px 32px -8px rgba(10,16,22,0.20), 0 0 0 1px rgba(10,16,22,0.06)",
        }}
      >
        {/* الرأس — تدرّج زمرّدي فاخر */}
        <div
          className="shrink-0 relative px-5 pt-4 pb-4"
          style={{
            background:
              "linear-gradient(135deg, #1c5c46 0%, #164a38 55%, #0f3527 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-70 pointer-events-none"
            style={{
              background:
                "radial-gradient(300px 120px at 88% -30%, rgba(156,124,63,0.4), transparent), radial-gradient(240px 120px at 10% 130%, rgba(255,255,255,0.12), transparent)",
            }}
          />
          <div className="relative flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[11px] grid place-items-center shrink-0"
              style={{
                background: "rgba(255,255,255,0.14)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3l7 3.5v5.2c0 4.3-3 7.4-7 8.3-4-.9-7-4-7-8.3V6.5L12 3z"
                  stroke="#fff"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  opacity="0.95"
                />
                <path
                  d="M9 12l2.1 2.1L15 10"
                  stroke="#fff"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[14px] font-bold text-white leading-none">
                  المساعد القانوني
                </h2>
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shadow-[0_0_6px_#4ade80]" />
              </div>
              <p className="text-[10.5px] text-white/55 mt-1 leading-none">
                يجيب من العقد والقانون فقط
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="w-8 h-8 grid place-items-center rounded-[9px] text-white/60 hover:bg-white/12 hover:text-white transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* المحادثة */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
          {empty && (
            <div className="h-full flex flex-col justify-center px-2 py-6">
              <div className="pop text-center mb-6">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-[20px] grid place-items-center"
                  style={{
                    background: "linear-gradient(135deg, #eef4f1, #e2ede8)",
                    boxShadow: "inset 0 0 0 1px rgba(28,92,70,0.12)",
                  }}
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3l7 3.5v5.2c0 4.3-3 7.4-7 8.3-4-.9-7-4-7-8.3V6.5L12 3z"
                      stroke="#1c5c46"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                    <path d="M9 12l2.1 2.1L15 10" stroke="#1c5c46" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-[13px] text-[var(--color-ink-2)] leading-relaxed max-w-[280px] mx-auto">
                  اسأل عمّا ورد في العقد أو عن أحكام القوانين العُمانية —
                  كل إجابة مستندة إلى نصّ محدّد.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="pop px-3.5 py-2 rounded-full text-[12px] font-medium text-[var(--color-brand-2)] transition-all hover:-translate-y-0.5"
                    style={{
                      background: "var(--color-surface)",
                      boxShadow:
                        "0 2px 8px rgba(10,16,22,0.06), inset 0 0 0 1px rgba(28,92,70,0.18)",
                      animationDelay: `${i * 70}ms`,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="rise flex justify-start">
                <div
                  className="max-w-[82%] px-4 py-2.5 text-[12.5px] leading-[1.7] text-white rounded-[18px] rounded-ss-[6px]"
                  style={{
                    background: "linear-gradient(135deg, #1c5c46, #164a38)",
                    boxShadow: "0 4px 14px rgba(28,92,70,0.28)",
                  }}
                >
                  {t.content}
                </div>
              </div>
            ) : (
              <div key={i} className="rise flex justify-end">
                <div className="max-w-[92%]">
                  <div
                    className="px-4 py-3 rounded-[18px] rounded-se-[6px] bg-[var(--color-surface)]"
                    style={{ boxShadow: "0 3px 12px rgba(10,16,22,0.07), inset 0 0 0 1px rgba(10,16,22,0.05)" }}
                  >
                    <p className="text-[13px] leading-[1.9] text-[var(--color-ink)] whitespace-pre-line">
                      {t.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 px-1.5 flex-wrap">
                    {t.mode && MODE_LABEL[t.mode] && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-black/[0.04] text-[var(--color-ink-3)] font-medium">
                        {MODE_LABEL[t.mode]}
                      </span>
                    )}
                    {t.articles && t.articles.length > 0 && (
                      <span className="tnum text-[9.5px] px-2 py-0.5 rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand-2)] font-semibold">
                        المادة {t.articles.join("، ")}
                      </span>
                    )}
                    {t.guardLog?.map((g, j) => (
                      <span key={j} className="text-[9px] text-[var(--color-violation)]">
                        🛡 {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ),
          )}

          {streaming && (
            <div className="flex justify-end">
              <div className="max-w-[92%]">
                {partial ? (
                  <div
                    className="px-4 py-3 rounded-[18px] rounded-se-[6px] bg-[var(--color-surface)]"
                    style={{ boxShadow: "0 3px 12px rgba(10,16,22,0.07), inset 0 0 0 1px rgba(10,16,22,0.05)" }}
                  >
                    <p className="text-[13px] leading-[1.9] whitespace-pre-line text-[var(--color-ink)]">
                      {partial}
                      <span className="caret inline-block w-[2px] h-[15px] align-middle bg-[var(--color-brand)] ms-0.5" />
                    </p>
                  </div>
                ) : (
                  <div
                    className="px-4 py-3 rounded-[18px] rounded-se-[6px] bg-[var(--color-surface)] inline-flex items-center gap-2.5"
                    style={{ boxShadow: "0 3px 12px rgba(10,16,22,0.07)" }}
                  >
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce" />
                    </span>
                    <span className="text-[11px] text-[var(--color-ink-3)]">
                      {mode === "grounded" ? "يبحث في القوانين…" : "يكتب…"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* الإدخال — كبسولة عائمة */}
        <div className="shrink-0 px-3 pb-3 pt-2">
          <div
            className="flex gap-1.5 items-end p-1.5 rounded-[18px] bg-[var(--color-surface)] transition-all focus-within:shadow-[0_0_0_3px_var(--color-brand-tint)]"
            style={{ boxShadow: "0 4px 16px rgba(10,16,22,0.08), inset 0 0 0 1px rgba(10,16,22,0.07)" }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="اكتب سؤالك…"
              className="flex-1 resize-none max-h-28 px-2.5 py-2 bg-transparent text-[12.5px] leading-[1.7] outline-none text-[var(--color-ink)] placeholder:text-[var(--color-ink-4)]"
            />
            <button
              onClick={() => send(input)}
              disabled={streaming || !input.trim()}
              aria-label="إرسال"
              className="w-9 h-9 grid place-items-center rounded-[13px] text-white transition-all disabled:opacity-40 shrink-0 hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #1c5c46, #164a38)",
                boxShadow: "0 4px 12px rgba(28,92,70,0.32)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14.5 8L2 2.5l2 5.5-2 5.5z" fill="currentColor" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-[9px] text-[var(--color-ink-4)] text-center">
            يعمل محلياً · لا يُغني عن رأي المحامي
          </p>
        </div>
      </div>
    </div>
  );
}
