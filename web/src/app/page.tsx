"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const PILLARS = [
  {
    title: "صفر هلوسة",
    body: "كل حكم مصحوب بنصّ المادة ورقمها واسم قانونها. حارس برمجيّ يرفض أي استشهاد بمادة لم تُسترجَع — فلا يخرج رقم مادة مُختلَق.",
  },
  {
    title: "يعمل على جهازك",
    body: "النموذج والبيانات على حاسوب المكتب، بلا اتصال بأي خدمة خارجية. وثائق موكّليك لا تغادر الجهاز.",
  },
  {
    title: "سبعة قوانين نافذة",
    body: "العمل، المعاملات المدنية، التجارة، الجزاء، الأحوال الشخصية، النظام الأساسي، وتنظيم القضاء — بآلاف المواد المفهرَسة.",
  },
];

const FEATURES = [
  ["تدقيق العقود", "يُفكَّك العقد إلى بنود، ويُحكَم على كلٍّ منها: مخالف، ناقص، سليم، أو لا مادة ذات صلة — مع درجة قوّة للعقد."],
  ["المساعد القانونيّ", "اسأل عن أحكام القوانين العُمانية — عقوبة، حقّ، مدّة، أو شرط — فيجيب من نصّ المادة مباشرة."],
  ["العقد المصحَّح", "لكل بند مخالف صياغة بديلة مبنيّة على المادة، تقبلها بنقرة فيُنتَج عقد مصحَّح جاهز للتنزيل."],
  ["إدارة العملاء والأتعاب", "ملفّات العملاء، قائمة أسعار حسب نوع العقد، وفواتير رسمية بترويسة مكتبك، ولوحة إيرادات."],
  ["المكتبة والبحث", "ابحث في بنود كل عقودك، واحفظ ما تريد الرجوع إليه في مكتبة بنودك."],
  ["متابعة المهل", "تواريخ انتهاء العقود وتجديدها في مكان واحد، مع تنبيه المتأخّر والقريب."],
];

export default function Home() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  // مستخدم مسجَّل — لا نومض صفحة التسويق قبل التحويل
  if (!ready || user) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-canvas)]">
      {/* الشريط العلويّ */}
      <header className="sticky top-0 z-40 bg-[var(--color-canvas)]/90 backdrop-blur-sm border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-[1080px] px-6 py-3.5 flex items-center">
          <span className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-bold text-[var(--color-ink)]">
              سديد
            </span>
            <span className="text-[11px] text-[var(--color-ink-3)] font-medium">
              Sadeed
            </span>
          </span>
          <Link
            href="/login"
            className="ms-auto px-4 py-2 rounded-[8px] bg-[var(--color-brand)] text-white text-[12.5px] font-semibold hover:bg-[var(--color-brand-2)] transition-colors"
          >
            الدخول
          </Link>
        </div>
      </header>

      {/* البطل */}
      <section className="mx-auto max-w-[1080px] px-6">
        <div className="relative mt-10 overflow-hidden rounded-[24px] text-white shadow-[0_24px_70px_-24px_rgba(0,0,0,0.6)]">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #0f172a 0%, #0f172a 52%, #3a2408 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.5] pointer-events-none"
            style={{
              background:
                "radial-gradient(120% 90% at 12% 0%, rgba(232,163,61,0.30) 0%, transparent 45%), radial-gradient(90% 80% at 100% 120%, rgba(255,255,255,0.06) 0%, transparent 50%)",
            }}
          />
          <div className="relative px-8 sm:px-14 py-16 sm:py-20 max-w-2xl">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="h-px w-8 bg-[var(--color-accent)]" />
              <span className="text-[11px] tracking-[0.22em] text-white/60 font-medium">
                للمحامي المرخّص في سلطنة عُمان
              </span>
            </div>
            <h1 className="display text-[36px] sm:text-[46px] leading-[1.08]">
              دقّق عقودك مقابل
              <br />
              القانون العُمانيّ، بثقة
            </h1>
            <p className="mt-5 text-[14.5px] leading-relaxed text-white/75 max-w-lg">
              يُفكّك «سديد» العقد إلى بنود ويحكم على كلٍّ منها باستشهادٍ من نصّ
              المادة — لا رأي بلا سند، ولا شيء يغادر جهازك.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="px-6 py-3 rounded-[10px] bg-white text-[var(--color-brand-deep)] text-[13.5px] font-bold hover:bg-white/90 transition-colors shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]"
              >
                ابدأ الآن
              </Link>
              <span className="text-[12px] text-white/55">
                يعمل محلياً · بلا اشتراك خدمات سحابية
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* الركائز */}
      <section className="mx-auto max-w-[1080px] px-6 mt-14">
        <div className="grid md:grid-cols-3 gap-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-[16px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6"
            >
              <h3 className="text-[15px] font-bold text-[var(--color-ink)] mb-2">
                {p.title}
              </h3>
              <p className="text-[12.5px] leading-relaxed text-[var(--color-ink-2)]">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* المزايا */}
      <section className="mx-auto max-w-[1080px] px-6 mt-16">
        <div className="flex items-baseline gap-3 mb-6">
          <h2 className="text-[17px] font-bold text-[var(--color-ink)]">
            ما يقدّمه المكتب في مكان واحد
          </h2>
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-7">
          {FEATURES.map(([t, b], i) => (
            <div key={t} className="flex gap-3.5">
              <span className="tnum shrink-0 w-7 h-7 grid place-items-center rounded-[9px] bg-[var(--color-brand-tint)] text-[var(--color-brand)] text-[12px] font-bold">
                {i + 1}
              </span>
              <div>
                <h3 className="text-[13.5px] font-bold text-[var(--color-ink)]">
                  {t}
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-ink-2)]">
                  {b}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* دعوة ختامية */}
      <section className="mx-auto max-w-[1080px] px-6 mt-16 mb-16">
        <div className="rounded-[20px] border border-[var(--color-brand-ring)] bg-[var(--color-brand-tint)] px-8 py-10 text-center">
          <h2 className="display text-[24px] text-[var(--color-brand-deep)]">
            جاهز لتدقيق أوّل عقد؟
          </h2>
          <p className="mt-2.5 text-[13px] text-[var(--color-ink-2)] max-w-md mx-auto leading-relaxed">
            أنشئ حساب مكتبك في دقيقة، وابدأ برفع عقد — كل شيء يبقى على جهازك.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 px-7 py-3 rounded-[10px] bg-[var(--color-brand)] text-white text-[13.5px] font-bold hover:bg-[var(--color-brand-2)] transition-colors"
          >
            الدخول إلى المنصّة
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--color-line)]">
        <div className="mx-auto max-w-[1080px] px-6 py-6 flex flex-wrap gap-x-6 gap-y-2 items-center text-[11px] text-[var(--color-ink-3)]">
          <span>سديد — تدقيق العقود مقابل القوانين العُمانية.</span>
          <span className="ms-auto">
            أداة مساعدة؛ القرار والمسؤولية المهنية على المحامي المرخّص وحده.
          </span>
        </div>
      </footer>
    </div>
  );
}
