"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const LAWS = [
  { name: "قانون العمل", decree: "مرسوم سلطاني 53/2023", arts: 150, cat: "العمل والعمّال", desc: "ينظّم علاقات العمل وعقوده وساعاته وإجازاته ومكافأة نهاية الخدمة." },
  { name: "قانون المعاملات المدنية", decree: "مرسوم سلطاني 29/2013", arts: 1086, cat: "المعاملات المدنية", desc: "الإطار العامّ للعقود والالتزامات والملكية والضمان في التعاملات." },
  { name: "قانون الجزاء", decree: "مرسوم سلطاني 7/2018", arts: 389, cat: "العقوبات", desc: "الجرائم والعقوبات — السرقة، خيانة الأمانة، الاحتيال وغيرها." },
  { name: "قانون التجارة", decree: "مرسوم سلطاني 55/1990", arts: 578, cat: "التجارة والأعمال", desc: "الأعمال التجارية والعقود والوكالة والبيوع والالتزامات التجارية." },
  { name: "قانون الأحوال الشخصية", decree: "مرسوم سلطاني 32/1997", arts: 282, cat: "الأسرة", desc: "الزواج والطلاق والنفقة والميراث والولاية والأحوال الأسرية." },
  { name: "النظام الأساسي للدولة", decree: "مرسوم سلطاني 6/2021", arts: 98, cat: "الدستور", desc: "المبادئ الحاكمة والحقوق والحريات وأسس الدولة والسلطات." },
  { name: "نظام السلطة القضائية", decree: "مرسوم سلطاني 35/2022", arts: 13, cat: "القضاء", desc: "تنظيم شؤون القضاء والجهات القضائية والاختصاص." },
];

const DEMO = {
  clause1: {
    tab: "بند ١: فترة الاختبار في عقد العمل (٦ أشهر)",
    no: "بند رقم 2",
    original:
      "«يخضع الموظف لفترة اختبار وتجربة مدتها ستة (6) أشهر كاملة من تاريخ استلام العمل، ويحق للشركة إنهاء خدماته خلالها دون إشعار ودون إبداء الأسباب.»",
    verdict: "الحكم: مخالف صريح",
    conf: "درجة الثقة: 99%",
    lawTitle: "المادة (31) · قانون العمل العُمانيّ (مرسوم سلطاني 53/2023)",
    lawText:
      "«يجوز الاتفاق على إخضاع العامل لفترة اختبار لا تزيد على (٣) ثلاثة أشهر بالنسبة لمن يتقاضون أجورهم شهرياً، ولا يجوز وضع العامل تحت الاختبار أكثر من مرة لدى صاحب العمل ذاته.»",
    reason:
      "تحديد 6 أشهر باطل لمخالفته السقف الإلزاميّ المحدَّد بـ 3 أشهر للمعيَّنين براتب شهريّ.",
    redline:
      "«يخضع الموظف لفترة اختبار لا تتجاوز ثلاثة (3) أشهر تبدأ من تاريخ التحاقه الفعليّ بالعمل، ويكون لأيٍّ من الطرفين إنهاء العقد خلالها بعد إخطار الطرف الآخر بسبعة أيام على الأقلّ.»",
  },
  clause2: {
    tab: "بند ٢: الضمان العشريّ في المقاولات (سنتان فقط)",
    no: "بند رقم 5",
    original:
      "«يضمن المقاول الأعمال المنفَّذة لمدة سنتين (2) فقط من تاريخ التسليم الابتدائيّ، ويسقط بعد هذه المدة أيّ حقّ لربّ العمل في الرجوع بالضمان.»",
    verdict: "الحكم: مخالف للنظام العام (باطل)",
    conf: "درجة الثقة: 100%",
    lawTitle: "المادة (622) · قانون المعاملات المدنية (مرسوم سلطاني 29/2013)",
    lawText:
      "«يضمن المقاول والمهندس المعماريّ متضامنين ما يحدث خلال عشر سنوات من تهدُّم كليّ أو جزئيّ… ويقع باطلاً كل شرط يقضي بإعفائهما من الضمان أو الحدّ منه.»",
    reason:
      "الضمان العشريّ (10 سنوات) متّصل بالنظام العام ولا يجوز إنقاصه اتفاقاً إلى سنتين.",
    redline:
      "«يضمن المقاول والمهندس المعماريّ بالتضامن سلامة المبنى من أيّ تهدُّم كليّ أو جزئيّ أو عيوب تهدّد متانته لمدة عشر (10) سنوات كاملة من تاريخ التسليم النهائيّ، وفقاً للمادة (622) معاملات مدنية.»",
  },
};

const PLANS = [
  { name: "تجربة مجانية", price: "مجانًا", unit: "", desc: "مراجعة عقدين", feats: ["تدقيق عقدين كاملين", "كل مزايا التدقيق الأساسية", "بلا بطاقة دفع"], cta: "ابدأ مجاناً", hi: false },
  { name: "الدفع لكل استخدام", price: "2", unit: "ر.ع / للعقد", desc: "للاستخدام غير المنتظم", feats: ["ادفع لكل عقد تدقّقه", "بلا اشتراك شهريّ", "كل مزايا التدقيق"], cta: "اختر الباقة", hi: false },
  { name: "الأساسية", price: "9", unit: "ر.ع / شهرياً", desc: "حتى 10 عقود شهرياً", feats: ["حتى 10 عقود شهرياً", "المساعد القانونيّ الذكيّ", "إدارة العملاء والأتعاب"], cta: "اشترك الآن", hi: true },
  { name: "الاحترافية", price: "19", unit: "ر.ع / شهرياً", desc: "حتى 30 عقداً + تقارير وأرشفة", feats: ["حتى 30 عقداً شهرياً", "تقارير رسمية وأرشفة كاملة", "فوترة ومكتبة بنود"], cta: "اشترك الآن", hi: false },
];

const SEALS = [
  { color: "text-amber-400", title: "سند قانونيّ قطعيّ", body: "كل حكم مستند لنصّ المادة ورقمها ومرسومها.", icon: "check" },
  { color: "text-emerald-400", title: "محليّ ١٠٠٪", body: "عقود موكّليك لا تغادر جهاز مكتبك إطلاقاً.", icon: "lock" },
  { color: "text-blue-400", title: "٧ تشريعات رئيسية", body: "العمل، المعاملات المدنية، الجزاء، التجارة…", icon: "layers" },
  { color: "text-purple-400", title: "المحامي صاحب القرار", body: "أداة تسليح مهنيّ وإبداء رأي معتمَد.", icon: "award" },
];

function Icon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  const p: Record<string, React.ReactNode> = {
    scale: <><path d="M12 3v18M7 21h10M12 6l-6 2 3 5a3 3 0 01-6 0l3-5m12 0l-6 2 3 5a3 3 0 01-6 0l3-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    shield: <><path d="M12 3l7 3.5v5.2c0 4.3-3 7.4-7 8.3-4-.9-7-4-7-8.3V6.5L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12l2.1 2.1L15 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></>,
    check: <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>,
    lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.7"/><path d="M8 10.5V7.5a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>,
    layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>,
    award: <><circle cx="12" cy="9" r="5" stroke="currentColor" strokeWidth="1.6"/><path d="M8.5 13l-1.5 8 5-3 5 3-1.5-8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></>,
    book: <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5V5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>,
    sparkles: <path d="M12 3l1.9 4.6L18.5 9l-3.7 3 1.1 4.8L12 14.4 8.1 16.8 9.2 12 5.5 9l4.6-1.4L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>,
    alert: <><path d="M12 3l9.5 16.5H2.5L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></>,
    search: <><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.7"/><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>,
    arrow: <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      {p[name]}
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<"clause1" | "clause2">("clause1");

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  if (!ready || user) {
    return (
      <div className="min-h-dvh grid place-items-center bg-slate-950">
        <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const d = DEMO[tab];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* الرأس */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-950/50 border border-amber-400/30 text-white">
              <Icon name="scale" className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">سديد</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  سلطنة عُمان
                </span>
              </div>
              <p className="text-xs text-slate-400">منظومة التدقيق القانونيّ الرصين للمحامي</p>
            </div>
          </div>

          <Link
            href="/login"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs sm:text-sm font-semibold shadow-md shadow-amber-950/60 border border-amber-500/30 transition-all"
          >
            <span>دخول منصّة المحامي</span>
            <Icon name="arrow" className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* البطل */}
      <section className="relative pt-16 pb-24 overflow-hidden border-b border-slate-900">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(circle at top, rgba(146,64,14,0.18), #020617 55%)" }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/30 text-amber-300 text-xs font-medium mb-8">
              <Icon name="shield" className="w-4 h-4 text-emerald-400" />
              <span>مبنيّ خصيصاً للمحامي العُمانيّ المرخّص · دقّة تشريعية موثّقة</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 leading-normal sm:leading-relaxed max-w-4xl mx-auto py-1">
              تدقيق العقود والامتثال للقوانين العُمانية
              <br />
              <span className="text-amber-400 font-bold inline-block mt-3">
                بحكمٍ سديد وسندٍ قانونيّ قطعيّ
              </span>
            </h1>

            <p className="mt-7 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
              «سديد» يفكّك العقد بنداً بنداً، ويطابقه بدقّة مع{" "}
              <strong className="text-slate-100">٧ قوانين عُمانية نافذة</strong>{" "}
              ومراسيمها، مستخلصاً المخالفات والشروط الناقصة مع صياغات بديلة جاهزة
              — <em>كلّ ذلك على حاسوبك محلياً بسرّية مهنية مطلقة</em>.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-sm sm:text-base shadow-xl shadow-amber-950/60 border border-amber-500/40 transition-all"
              >
                <span>ابدأ العمل على قضاياك الآن</span>
                <Icon name="arrow" className="w-5 h-5" />
              </Link>
              <a
                href="#demo"
                className="flex items-center gap-2 px-6 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm sm:text-base border border-slate-800 transition-all"
              >
                <Icon name="search" className="w-5 h-5 text-amber-400" />
                <span>شاهد عيّنة تدقيق حيّة</span>
              </a>
            </div>

            {/* أختام الثقة */}
            <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-right">
              {SEALS.map((s) => (
                <div key={s.title} className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className={`flex items-center gap-2 ${s.color} text-xs font-semibold`}>
                    <Icon name={s.icon} className="w-4 h-4" />
                    <span>{s.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* عرض التدقيق التفاعليّ */}
      <section id="demo" className="py-20 bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold text-amber-400 tracking-wider">شاهد الفارق بأمّ عينك</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">
              كيف يحلّل «سديد» بنود العقد مقابل المراسيم العُمانية؟
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              اختر بنداً شائعاً لترى الحكم الفوريّ وسند المادة والصياغة المصحَّحة.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap gap-3 pb-6 border-b border-slate-800">
              {(["clause1", "clause2"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    tab === k
                      ? "bg-amber-600 text-white shadow-md"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {DEMO[k].tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 items-start">
              {/* الأصل */}
              <div className="lg:col-span-5 bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-200">النصّ الأصليّ في مسودة العقد</span>
                  <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">{d.no}</span>
                </div>
                <p className="text-sm leading-relaxed bg-rose-950/20 border border-rose-900/30 p-3 rounded-lg text-rose-100">
                  {d.original}
                </p>
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <Icon name="alert" className="w-4 h-4" />
                    {d.verdict}
                  </span>
                  <span className="tnum text-slate-400 text-[11px]">{d.conf}</span>
                </div>
              </div>

              {/* السند + البديل */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-amber-950/20 border border-amber-800/40 p-4 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1.5">
                    <Icon name="book" className="w-4 h-4 text-amber-400" />
                    <span>{d.lawTitle}</span>
                  </div>
                  <blockquote className="text-xs text-slate-300 leading-relaxed border-r-2 border-amber-500 pr-3 my-2 bg-slate-900/60 p-2.5 rounded">
                    {d.lawText}
                  </blockquote>
                  <p className="text-xs text-amber-200/90">
                    <strong>التسبيب القانونيّ:</strong> {d.reason}
                  </p>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-xl">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-300 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Icon name="sparkles" className="w-4 h-4 text-emerald-400" />
                      الصياغة البديلة المقترحة
                    </span>
                    <span className="text-emerald-400 text-[11px]">تُعتمَد بنقرة</span>
                  </div>
                  <p className="text-xs text-emerald-100 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-emerald-900/30">
                    {d.redline}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* القوانين السبعة */}
      <section className="py-20 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-semibold text-amber-400 tracking-wider">المرجعية التشريعية الشاملة</span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-3 leading-relaxed py-1">
              مفهرَس على ٧ قوانين عُمانية نافذة وآلاف المواد
            </h2>
            <p className="text-sm sm:text-base text-slate-300 mt-3 leading-relaxed">
              لا نماذج عامّة معرَّبة — كل مطابقة تتمّ مع النصوص الرسمية الصادرة بالمراسيم السلطانية.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {LAWS.map((law) => (
              <div key={law.name} className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 hover:border-amber-500/40 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-700/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <Icon name="book" className="w-5 h-5" />
                  </div>
                  <span className="tnum text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    {law.arts} مادة
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-4">{law.name}</h3>
                <p className="text-xs text-amber-400/90 font-medium mt-1">{law.decree}</p>
                <p className="text-xs text-slate-400 leading-relaxed mt-2.5">{law.desc}</p>
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{law.cat}</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Icon name="check" className="w-3 h-3" />
                    مفهرَس ومحدَّث
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* الأسعار */}
      <section className="py-20 bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold text-amber-400 tracking-wider">باقات تناسب مكتبك</span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-3 leading-relaxed py-1">
              أسعار بسيطة وشفّافة بالريال العُمانيّ
            </h2>
            <p className="text-sm sm:text-base text-slate-300 mt-3 leading-relaxed">
              ابدأ مجاناً، وادفع فقط عندما يكبر عملك. بلا رسوم خفيّة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-3xl p-6 flex flex-col ${
                  p.hi
                    ? "bg-gradient-to-b from-amber-950/40 to-slate-900 border-2 border-amber-500/50"
                    : "bg-slate-900 border border-slate-800"
                }`}
              >
                {p.hi && (
                  <span className="absolute -top-3 right-6 text-[10px] font-bold bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full">
                    الأكثر شيوعاً
                  </span>
                )}
                <h3 className="text-base font-bold text-white">{p.name}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className={`tnum text-3xl font-black ${p.hi ? "text-amber-400" : "text-white"}`}>
                    {p.price}
                  </span>
                  {p.unit && <span className="text-xs text-slate-400">{p.unit}</span>}
                </div>
                <ul className="mt-5 space-y-2.5 flex-1">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`mt-6 w-full py-2.5 rounded-xl text-center text-xs font-semibold transition-all ${
                    p.hi
                      ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white border border-amber-500/40 shadow-md shadow-amber-950/50"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-slate-500 mt-6">
            جميع الباقات تعمل محلياً على جهاز مكتبك — بلا اتصال بأي خدمة ذكاء اصطناعيّ خارجية.
          </p>
        </div>
      </section>

      {/* الدعوة الختامية */}
      <section className="py-16 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-6 text-amber-400">
            <Icon name="scale" className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white">
            جاهز لرفع كفاءة مكتبك ودقّة تدقيق عقودك؟
          </h2>
          <p className="text-sm sm:text-base text-slate-300 mt-4 max-w-xl mx-auto">
            انضمّ إلى «سديد». وفّر ساعات من البحث اليدويّ، واضمن لعملائك حكماً
            قانونياً سديداً لا تشوبه شائبة.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-sm shadow-xl shadow-amber-950/60 border border-amber-500/40 transition-all"
            >
              الدخول المباشر إلى المنصّة
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-400">
            سديد © 2026 · مصمَّم خصيصاً للمجتمع القانونيّ في سلطنة عُمان
          </p>
        </div>
      </section>
    </div>
  );
}
