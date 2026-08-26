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
    "w-full px-3.5 py-2.5 rounded-[8px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[13.5px] outline-none focus:border-[var(--color-brand)] transition-colors";

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* اللوحة الخضراء */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden"
        style={{
          background:
            "linear-gradient(150deg, #173eac 0%, #12318a 55%, #0a2470 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.5] pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 0%, rgba(232,163,61,0.28) 0%, transparent 45%)",
          }}
        />
        <Link href="/" className="relative flex items-baseline gap-2.5">
          <span className="text-[18px] font-bold">سديد</span>
          <span className="text-[11px] text-white/50">Sadeed</span>
        </Link>
        <div className="relative">
          <h2 className="display text-[30px] leading-[1.2]">
            تدقيق العقود مقابل
            <br />
            القانون العُمانيّ
          </h2>
          <p className="mt-4 text-[13.5px] text-white/70 leading-relaxed max-w-sm">
            كل حكم مستند إلى نصّ مادة، ويعمل على جهازك بلا اتصال بأي خدمة
            خارجية.
          </p>
        </div>
        <p className="relative text-[11px] text-white/45">
          أداة مساعدة للمحامي المرخّص — القرار والمسؤولية على المحامي وحده.
        </p>
      </div>

      {/* النموذج */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-[360px]">
          <div className="lg:hidden mb-8 flex items-baseline gap-2.5">
            <span className="text-[18px] font-bold text-[var(--color-brand)]">
              سديد
            </span>
          </div>

          <h1 className="display text-[22px] text-[var(--color-ink)]">
            {mode === "signup"
              ? firstRun
                ? "إنشاء حساب المكتب"
                : "إنشاء حساب"
              : "تسجيل الدخول"}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-[var(--color-ink-3)]">
            {mode === "signup"
              ? firstRun
                ? "أول تشغيل — أنشئ حساب المحامي."
                : "أدخل بياناتك لإنشاء حساب."
              : "أدخل اسم المستخدم وكلمة المرور."}
          </p>

          {error && (
            <div className="mt-4 px-3.5 py-2.5 rounded-[8px] border-s-2 border-[var(--color-violation)] bg-[var(--color-violation-bg)]">
              <p className="text-[12px] text-[var(--color-violation)] font-medium">
                {error}
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <input
                className={field}
                placeholder="الاسم الكامل (يظهر على التقارير)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
            <input
              className={field}
              placeholder="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <input
              className={field}
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            <button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className="w-full py-2.5 rounded-[8px] bg-[var(--color-brand)] text-white text-[13.5px] font-semibold hover:bg-[var(--color-brand-2)] disabled:opacity-40 transition-colors"
            >
              {busy
                ? "…"
                : mode === "signup"
                  ? "إنشاء الحساب والدخول"
                  : "دخول"}
            </button>
          </form>

          {!firstRun && (
            <p className="mt-5 text-[12px] text-[var(--color-ink-3)] text-center">
              {mode === "signup" ? "لديك حساب؟ " : "ليس لديك حساب؟ "}
              <button
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setError(null);
                }}
                className="text-[var(--color-brand)] font-semibold hover:underline"
              >
                {mode === "signup" ? "تسجيل الدخول" : "أنشئ حساباً"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
