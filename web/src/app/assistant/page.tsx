"use client";

import { useEffect, useRef, useState } from "react";
import { API, saveConsultation } from "@/lib/api";

interface Turn {
  role: "user" | "assistant";
  content: string;
  articles?: number[];
  mode?: string;
  guardLog?: string[];
}

const SUGGESTIONS = [
  "موكّلي تعرّض لسرقة، ماذا ينصّ القانون؟",
  "ما مدّة إشعار إنهاء عقد العمل؟",
  "ما حكم الشرط المخالف للنظام العام؟",
  "ما عقوبة خيانة الأمانة؟",
];

const MODE_LABEL: Record<string, string> = {
  greeting: "ترحيب",
  meta: "تعريف",
  grounded: "من القانون",
};

export default function AssistantPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [mode, setMode] = useState<string | null>(null);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function saveTurn(i: number) {
    const answer = turns[i];
    const question = turns[i - 1];
    if (!answer || !question) return;
    try {
      await saveConsultation(
        question.content,
        answer.content,
        (answer.articles ?? []).map((n) => ({ article_no: n })),
      );
      setSavedIdx(i);
      setTimeout(() => setSavedIdx((s) => (s === i ? null : s)), 1800);
    } catch {
      /* تجاهل */
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, partial]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      const res = await fetch(`${API}/chat`, {
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
    <div className="mx-auto max-w-[760px] px-6 flex flex-col h-[calc(100dvh-3.5rem)]">
      {/* الرأس */}
      <div className="shrink-0 pt-7 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-[13px] grid place-items-center shrink-0"
            style={{
              background:
                "linear-gradient(135deg, #0f172a 0%, #0f172a 55%, #3a2408 100%)",
              boxShadow: "0 6px 16px -6px rgba(245,158,11,0.5)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3l7 3.5v5.2c0 4.3-3 7.4-7 8.3-4-.9-7-4-7-8.3V6.5L12 3z"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinejoin="round"
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
          <div>
            <h1 className="display text-[19px] text-[var(--color-ink)]">
              المساعد القانونيّ
            </h1>
            <p className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
              يجيب أسئلتك من مواد القوانين العُمانية السبعة — مع ذكر المادة.
            </p>
          </div>
        </div>
      </div>

      {/* المحادثة */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {empty && (
          <div className="pt-8">
            <p className="text-[13px] text-[var(--color-ink-2)] leading-relaxed mb-5 max-w-lg">
              اسأل عن أحكام القوانين العُمانية — عقوبة فعلٍ، حقٍّ، مدّةٍ، أو
              شرطٍ. كل إجابة مستندة إلى نصّ مادة، ولا تُغني عن اجتهادك.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="pop px-3.5 py-2 rounded-full text-[12px] font-medium text-[var(--color-brand-2)] transition-all hover:-translate-y-0.5"
                  style={{
                    background: "var(--color-surface)",
                    boxShadow:
                      "0 2px 8px rgba(10,16,22,0.06), inset 0 0 0 1px rgba(245,158,11,0.18)",
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
                className="max-w-[80%] px-4 py-2.5 text-[13px] leading-[1.7] text-white rounded-[18px] rounded-ss-[6px]"
                style={{
                  background: "linear-gradient(135deg, #0f172a, #0f172a)",
                  boxShadow: "0 4px 14px rgba(245,158,11,0.28)",
                }}
              >
                {t.content}
              </div>
            </div>
          ) : (
            <div key={i} className="rise flex justify-end">
              <div className="max-w-[90%]">
                <div
                  className="px-4 py-3 rounded-[18px] rounded-se-[6px] bg-[var(--color-surface)]"
                  style={{
                    boxShadow:
                      "0 3px 12px rgba(10,16,22,0.07), inset 0 0 0 1px rgba(10,16,22,0.05)",
                  }}
                >
                  <p className="text-[13.5px] leading-[1.95] text-[var(--color-ink)] whitespace-pre-line">
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
                    <span
                      key={j}
                      className="text-[9px] text-[var(--color-violation)]"
                    >
                      🛡 {g}
                    </span>
                  ))}
                  {t.mode !== "greeting" && (
                    <button
                      onClick={() => saveTurn(i)}
                      className="text-[9.5px] text-[var(--color-ink-3)] hover:text-[var(--color-brand)] transition-colors"
                    >
                      {savedIdx === i ? "✓ حُفظت" : "حفظ الاستشارة"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ),
        )}

        {streaming && (
          <div className="flex justify-end">
            <div className="max-w-[90%]">
              {partial ? (
                <div
                  className="px-4 py-3 rounded-[18px] rounded-se-[6px] bg-[var(--color-surface)]"
                  style={{
                    boxShadow:
                      "0 3px 12px rgba(10,16,22,0.07), inset 0 0 0 1px rgba(10,16,22,0.05)",
                  }}
                >
                  <p className="text-[13.5px] leading-[1.95] whitespace-pre-line text-[var(--color-ink)]">
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

      {/* الإدخال */}
      <div className="shrink-0 pb-5 pt-2">
        <div
          className="flex gap-1.5 items-end p-1.5 rounded-[18px] bg-[var(--color-surface)] transition-all focus-within:shadow-[0_0_0_3px_var(--color-brand-tint)]"
          style={{
            boxShadow:
              "0 4px 16px rgba(10,16,22,0.08), inset 0 0 0 1px rgba(10,16,22,0.07)",
          }}
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
            placeholder="اسأل عن حكم قانونيّ…"
            className="flex-1 resize-none max-h-32 px-3 py-2 bg-transparent text-[13px] leading-[1.7] outline-none text-[var(--color-ink)] placeholder:text-[var(--color-ink-4)]"
          />
          <button
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            aria-label="إرسال"
            className="w-10 h-10 grid place-items-center rounded-[13px] text-white transition-all disabled:opacity-40 shrink-0 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #0f172a, #0f172a)",
              boxShadow: "0 4px 12px rgba(245,158,11,0.32)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
              <path d="M14.5 8L2 2.5l2 5.5-2 5.5z" fill="currentColor" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[9.5px] text-[var(--color-ink-4)] text-center">
          يعمل محلياً · إجاباته من نصوص القوانين · لا يُغني عن اجتهاد المحامي
        </p>
      </div>
    </div>
  );
}
