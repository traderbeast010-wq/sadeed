"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "التحليلات" },
  { href: "/assistant", label: "المساعد" },
  { href: "/clients", label: "العملاء" },
  { href: "/revenue", label: "الإيرادات" },
  { href: "/deadlines", label: "المهل" },
  { href: "/review", label: "تحتاج مراجعة" },
  { href: "/library", label: "المكتبة" },
  { href: "/consultations", label: "الاستشارات" },
  { href: "/law", label: "نصّ القانون" },
  { href: "/settings", label: "الإعدادات" },
];

// صفحات عامّة بلا ترويسة ولا حارس: الهبوط «/» وتسجيل الدخول
const PUBLIC = ["/", "/login"];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, logout } = useAuth();
  const isPublic = PUBLIC.includes(pathname);

  useEffect(() => {
    if (!ready) return;
    if (!isPublic && !user) router.replace("/");
    if (user && pathname === "/login") router.replace("/dashboard");
  }, [ready, isPublic, user, pathname, router]);

  // الصفحات العامّة: المحتوى وحده
  if (isPublic) return <>{children}</>;

  // انتظار قراءة الجلسة أو إعادة التوجيه — لا نومض المحتوى المحميّ
  if (!ready || !user) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-[var(--color-paper)]/92 backdrop-blur-sm rule-y">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-baseline gap-2.5 shrink-0"
          >
            <span className="text-[15px] font-bold tracking-tight">سديد</span>
            <span className="text-[11px] text-[var(--color-ink-faint)] font-medium">
              Sadeed
            </span>
          </Link>

          <nav className="flex items-center gap-0.5 text-[12.5px] overflow-x-auto">
            {NAV.map((n) => {
              const active =
                n.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-2.5 py-1 rounded-[6px] whitespace-nowrap transition-colors ${
                    active
                      ? "bg-[var(--color-brand-tint)] text-[var(--color-brand)] font-semibold"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-sunk)]"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex items-center gap-3 shrink-0">
            <span className="hidden md:block text-[12px] text-[var(--color-ink-2)]">
              {user.name}
            </span>
            <button
              onClick={() => {
                logout();
                router.replace("/");
              }}
              className="text-[11.5px] text-[var(--color-ink-3)] hover:text-[var(--color-violation)] transition-colors"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="rule-y border-b-0 border-t border-[var(--color-rule)] mt-16">
        <div className="mx-auto max-w-[1400px] px-6 py-5 flex flex-wrap gap-x-6 gap-y-2 items-center text-[11px] text-[var(--color-ink-faint)] leading-relaxed">
          <span>
            أداة مساعدة للمحامي المرخّص — القرار النهائي والمسؤولية المهنية على
            المحامي وحده.
          </span>
          <span className="ms-auto">
            كل حكم مستند حصراً إلى مواد القانون المسترجَعة.
          </span>
        </div>
      </footer>
    </>
  );
}
