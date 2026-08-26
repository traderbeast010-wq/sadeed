"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API, listConsultations, saveConsultation } from "@/lib/api";
import type { Consultation } from "@/lib/types";

interface Cite {
  article_no: number;
  law_name?: string;
}
interface Turn {
  role: "user" | "assistant";
  content: string;
  articles?: Cite[];
  mode?: string;
}

const INTRO: Turn = {
  role: "assistant",
  content:
    "أهلاً بك يا أستاذ في المساعد القانونيّ «سديد». أنا محرّك استشاريّ محليّ مطابق حصراً لسبعة قوانين عُمانية نافذة (العمل 53/2023، المعاملات المدنية 29/2013، التجارة، الجزاء، الأحوال الشخصية، النظام الأساسي، ونظام السلطة القضائية). كيف أساندك في استشارات موكّليك اليوم؟",
  mode: "greeting",
};

const QUICK = [
  { title: "مكافأة نهاية الخدمة في قانون العمل", prompt: "ما أحكام وطريقة احتساب مكافأة نهاية الخدمة في قانون العمل 53/2023؟" },
  { title: "الضمان العشريّ في المقاولات", prompt: "ما مدّة ونطاق الضمان العشريّ للمقاول والمهندس المعماريّ في القانون العُمانيّ؟" },
  { title: "عقوبة شيك بدون رصيد", prompt: "ما عقوبة إصدار شيك بدون رصيد في القانون العُمانيّ؟" },
];

export default function AssistantPage() {
  const [turns, setTurns] = useState<Turn[]>([INTRO]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [mode, setMode] = useState<string | null>(null);
  const [saved, setSaved] = useState<Consultation[]>([]);
  const [histSearch, setHistSearch] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listConsultations().then(setSaved).catch(() => setSaved([]));
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, partial]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming) return;
    const history = turns
      .filter((t) => t.mode !== "greeting")
      .map((t) => ({ role: t.role, content: t.content }));
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
                articles: (evt.articles ?? []) as Cite[],
                mode: evt.mode,
              },
            ]);
            setPartial("");
          } else if (evt.stage === "error") throw new Error(evt.message);
        }
      }
    } catch (e) {
      setTurns((p) => [
        ...p,
        { role: "assistant", content: e instanceof Error ? e.message : "حدث خطأ." },
      ]);
      setPartial("");
    } finally {
      setStreaming(false);
      setMode(null);
    }
  }

  async function saveTurn(i: number) {
    const answer = turns[i];
    const question = turns[i - 1];
    if (!answer || !question) return;
    try {
      await saveConsultation(question.content, answer.content, answer.articles ?? []);
      setSavedIdx(i);
      setTimeout(() => setSavedIdx((s) => (s === i ? null : s)), 1800);
      listConsultations().then(setSaved).catch(() => {});
    } catch {
      /* تجاهل */
    }
  }

  function copy(i: number) {
    navigator.clipboard?.writeText(turns[i].content);
    setCopied(i);
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 2000);
  }

  const hist = saved.filter((c) =>
    histSearch ? c.question.includes(histSearch) : true,
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* سجلّ الاستشارات */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-400"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5V5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              <h2 className="text-sm font-bold text-white">سجلّ الاستشارات المحفوظة</h2>
            </div>
            <span className="tnum text-[11px] text-slate-400">{saved.length} استشارة</span>
          </div>

          <div className="relative">
            <input
              value={histSearch}
              onChange={(e) => setHistSearch(e.target.value)}
              placeholder="بحث في الاستشارات…"
              className="w-full ps-3 pe-8 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.7"/><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {hist.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-2">لا استشارات محفوظة بعد.</p>
            ) : (
              hist.map((c) => (
                <button
                  key={c.id}
                  onClick={() => send(c.question)}
                  className="w-full text-right p-3 bg-slate-950/70 hover:bg-slate-950 rounded-xl border border-slate-800 hover:border-amber-500/30 transition-all group"
                >
                  <span className="block text-xs font-semibold text-slate-200 group-hover:text-amber-300 transition-colors truncate">
                    {c.question}
                  </span>
                  <span className="tnum text-[10px] text-slate-500">
                    {new Date(c.created_at).toLocaleDateString("ar", { dateStyle: "short" })}
                    {c.articles?.length > 0 && ` · م.${c.articles.map((a) => a.article_no).join("، ")}`}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-400 block">نماذج استفسارات شائعة:</span>
            <div className="space-y-1.5">
              {QUICK.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => send(qp.prompt)}
                  className="w-full text-right p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 transition-colors flex items-center justify-between group"
                >
                  <span className="truncate">{qp.title}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-slate-500 group-hover:text-amber-400 shrink-0"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* المحادثة */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col h-[70vh] min-h-[520px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white shadow-md">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M7 21h10M12 6l-6 2 3 5a3 3 0 01-6 0l3-5m12 0l-6 2 3 5a3 3 0 01-6 0l3-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-white">المساعد القانونيّ العُمانيّ الموثوق</h1>
                <p className="text-[11px] text-slate-400">إجابات مستندة حصراً إلى مواد القوانين السبعة النافذة.</p>
              </div>
            </div>
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/40 font-semibold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3.5v5.2c0 4.3-3 7.4-7 8.3-4-.9-7-4-7-8.3V6.5L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12l2.1 2.1L15 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              سند تشريعيّ قطعيّ
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
            {turns.map((t, i) => {
              const isA = t.role === "assistant";
              return (
                <div key={i} className={`flex flex-col ${isA ? "items-start" : "items-end"}`}>
                  <div className={`max-w-2xl rounded-2xl p-4 space-y-3 ${isA ? "bg-slate-950 border border-slate-800 text-slate-200" : "bg-amber-700/30 border border-amber-600/40 text-white"}`}>
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800/60">
                      <span className="font-semibold text-slate-300">
                        {isA ? "سديد · المساعد القانونيّ" : "أنت"}
                      </span>
                      {isA && t.mode !== "greeting" && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <button onClick={() => copy(i)} className="hover:text-amber-400" title="نسخ">
                            {copied === i ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-400"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.7"/></svg>
                            )}
                          </button>
                          <button onClick={() => saveTurn(i)} className="hover:text-amber-400" title="حفظ الاستشارة">
                            {savedIdx === i ? (
                              <span className="text-emerald-400">✓</span>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 3h12v18l-6-4-6 4V3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">{t.content}</div>
                    {t.articles && t.articles.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5V5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                          المواد المستنَد إليها:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {t.articles.map((c, idx) => (
                            <Link
                              key={idx}
                              href={`/law?q=${encodeURIComponent(c.law_name ?? "")}`}
                              className="tnum text-[11px] bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 border border-amber-700/50 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              {c.law_name ?? "مادة"} (م.{c.article_no})
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {streaming && (
              <div className="flex flex-col items-start">
                <div className="max-w-2xl rounded-2xl p-4 bg-slate-950 border border-slate-800 text-slate-200">
                  {partial ? (
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                      {partial}
                      <span className="caret inline-block w-[2px] h-[14px] align-middle bg-amber-400 ms-0.5" />
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]" />
                      <span className="mr-2">{mode === "grounded" ? "يبحث في مواد القوانين السبعة…" : "يكتب…"}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="pt-4 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك القانونيّ… (مثال: موكّلي يريد فسخ عقد توريد، ما الشروط؟)"
              className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold shadow-md shadow-amber-950/60 border border-amber-500/40 transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14.5 8L2 2.5l2 5.5-2 5.5z" fill="currentColor"/></svg>
              <span className="hidden sm:inline">إرسال</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
