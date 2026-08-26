"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authState } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [firstRun, setFirstRun] = useState(false);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authState()
      .then((s) => {
        if (!s.has_users) {
          setFirstRun(true);
          setMode("signup");
        }
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await signup(username, name, password);
      else await login(username, password);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الدخول");
      setBusy(false);
    }
  }

  const field =
    "w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[13px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-slate-100 relative"
        style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,0.7)" }}
      >
        {/* الترويسة */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center mx-auto shadow-lg shadow-amber-950/60 border border-amber-500/40 text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect
                x="4.5"
                y="10.5"
                width="15"
                height="10"
                rx="2.2"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M8 10.5V7.5a4 4 0 118 0v3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="mt-4 flex items-baseline justify-center gap-2">
            <span className="text-[20px] font-bold text-white">سديد</span>
            <span className="text-[11px] text-slate-500">Sadeed</span>
          </div>
          <h3 className="text-[15px] font-bold text-white mt-3">
            {mode === "signup"
              ? firstRun
                ? "إنشاء حساب المكتب"
                : "إنشاء حساب"
              : "تسجيل الدخول إلى بيئة المحامي"}
          </h3>
          <p className="text-[11.5px] text-slate-400 mt-1 leading-relaxed">
            {mode === "signup"
              ? firstRun
                ? "أوّل تشغيل — أنشئ حساب المحامي المعتمد."
                : "أدخل بياناتك لإنشاء حساب جديد."
              : "بيانات دخولك محفوظة محلياً على الخادم."}
          </p>
        </div>

        {/* النموذج */}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-[11.5px] font-semibold text-slate-300 mb-1.5">
                اسم المحامي المعتمد
              </label>
              <input
                className={field}
                placeholder="يظهر على التقارير والفواتير"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-300 mb-1.5">
              اسم المستخدم
            </label>
            <input
              className={field}
              placeholder="اسم الدخول"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-300 mb-1.5">
              كلمة المرور
            </label>
            <input
              className={field}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[12px] text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/40">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0"
              >
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 7.5v5M12 16h.01"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-[13px] transition-all shadow-md shadow-amber-950/50 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3l7 3.5v5.2c0 4.3-3 7.4-7 8.3-4-.9-7-4-7-8.3V6.5L12 3z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9 12l2.1 2.1L15 10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              {busy
                ? "جارٍ…"
                : mode === "signup"
                  ? "إنشاء الحساب والدخول"
                  : "دخول"}
            </span>
          </button>

          {!firstRun && (
            <p className="text-[12px] text-slate-400 text-center pt-1">
              {mode === "signup" ? "لديك حساب؟ " : "ليس لديك حساب؟ "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setError(null);
                }}
                className="text-amber-400 font-semibold hover:text-amber-300"
              >
                {mode === "signup" ? "تسجيل الدخول" : "أنشئ حساباً"}
              </button>
            </p>
          )}
        </form>

        {/* تذييل أمنيّ */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-400">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="text-emerald-400"
            >
              <path
                d="M12 3l7 3.5v5.2c0 4.3-3 7.4-7 8.3-4-.9-7-4-7-8.3V6.5L12 3z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9 12l2.1 2.1L15 10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>يعمل محلياً — لا يتّصل بأي خدمة ذكاء اصطناعيّ خارجية</span>
          </div>
          <Link
            href="/"
            className="inline-block mt-3 text-[11px] text-slate-500 hover:text-slate-300"
          >
            ← العودة للصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
