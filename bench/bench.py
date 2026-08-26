#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
سديد (Sadeed) — بنشمارك النماذج المحلية على llama.cpp

يقيس على جهازك:
  • زمن التحميل البارد
  • سرعة المعالجة المسبقة (prefill) — العنق الحقيقي على المعالج
  • سرعة التوليد (generation)
  • التزام النموذج بمخطّط JSON
  • دقّة الحكم مقابل إجابة مرجعية
  • الهلوسة: هل استشهد بمادة غير معطاة له؟
  • أثر وضع التفكير (thinking) على الزمن

يشغّل llama-server بنفسه لكل إعداد، ثم يوقفه.
مكتبات بايثون القياسية فقط — بلا اعتماديّات خارجية.

    python bench/bench.py --model models/Qwen3.5-4B-Q4_K_M.gguf
    python bench/bench.py --model ... --threads 4 6 8
    python bench/bench.py --model ... --think both
"""

import argparse
import json
import os
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request

HOST = "127.0.0.1"
PORT = 8080
BASE = f"http://{HOST}:{PORT}"
SERVER = os.path.join("llamacpp", "llama-server.exe")

# ---------------------------------------------------------------------------
# مخطّط المخرج — هو نفسه المخطّط الذي سيُستخدم في الإنتاج
# ---------------------------------------------------------------------------
SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {
            "type": "string",
            "enum": ["مخالف", "ناقص", "سليم", "لا مادة ذات صلة"],
        },
        "article_numbers": {"type": "array", "items": {"type": "integer"}},
        "reasoning": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": ["verdict", "article_numbers", "reasoning", "confidence"],
    "additionalProperties": False,
}

SYSTEM = """أنت مدقّق قانوني آليّ متخصّص في عقود العمل في سلطنة عُمان.
مهمّتك: الحكم على بند واحد بالاستناد الحصريّ إلى المواد القانونية المعطاة لك.

قواعد ملزمة لا تُخالَف:
1. استخدم المواد المعطاة فقط. ممنوع منعاً باتاً استخدام أي معرفة قانونية من خارجها.
2. إن لم تجد في المواد المعطاة سنداً صريحاً، أرجِع الحكم "لا مادة ذات صلة".
3. ممنوع اختراع رقم مادة أو نصّ مادة غير موجود فيما أُعطي لك.
4. الحكم واحد من أربعة فقط: مخالف | ناقص | سليم | لا مادة ذات صلة
5. إذا كان الحكم "مخالف" أو "ناقص" فاذكر رقم المادة في article_numbers.
6. إذا كان الحكم "لا مادة ذات صلة" فاترك article_numbers فارغة.
7. اجعل reasoning جملة واحدة موجزة بالعربية.
8. أعد JSON فقط.
9. إن أشار البند إلى قانون أو نظام دولة أخرى، فهذا وحده لا يعني أنه مخالف.
   احكم فقط بناء على ما تنصّ عليه المواد المعطاة لك. وإن لم تتناول أي مادة
   معطاة موضوع البند، فالحكم "لا مادة ذات صلة"."""

# ---------------------------------------------------------------------------
# مواد للقياس فقط
# تنبيه: صياغات تقريبية لقياس الأداء وأحجام التوكنات — تُستبدل بالنصّ الرسمي
# للمرسوم السلطاني 53/2023 عند بناء الكوربوس الحقيقي.
# ---------------------------------------------------------------------------
ART_HOURS = (74, "لا يجوز تشغيل العامل أكثر من ثماني ساعات في اليوم الواحد، أو "
                 "خمس وأربعين ساعة في الأسبوع، ولا تدخل في حساب هذه المدة "
                 "الفترات المخصّصة لتناول الطعام والراحة.")
ART_WAGE = (50, "يُلتزم صاحب العمل بأداء أجر العامل في موعد استحقاقه، وبتحويله "
                "إلى حساب العامل لدى إحدى المؤسّسات المصرفية العاملة في "
                "السلطنة، ولا يجوز تأخيره عن الموعد المحدّد.")
ART_LEAVE = (68, "يستحقّ العامل إجازة سنوية بأجر أساسي لا تقلّ عن ثلاثين يوماً "
                 "عن كل سنة خدمة، ولا يجوز الاتفاق على التنازل عنها.")
ART_PROB = (23, "يجوز تعيين العامل تحت التجربة لمدة لا تزيد على ثلاثة أشهر، ولا "
                "يجوز تعيين العامل تحت التجربة أكثر من مرة واحدة لدى صاحب "
                "العمل نفسه.")

CASES = [
    {
        "id": "C1_مخالف_ساعات",
        "clause": "يلتزم الطرف الثاني بالعمل لمدة اثنتي عشرة ساعة يومياً، بواقع "
                  "ستة أيام في الأسبوع، دون أجر إضافي.",
        "articles": [ART_HOURS, ART_WAGE, ART_LEAVE],
        "expect": "مخالف", "expect_arts": [74],
    },
    {
        "id": "C2_سليم_إجازة",
        "clause": "يستحقّ الطرف الثاني إجازة سنوية مدفوعة الأجر مقدارها ثلاثون "
                  "يوماً عن كل سنة خدمة كاملة.",
        "articles": [ART_LEAVE, ART_HOURS, ART_PROB],
        "expect": "سليم", "expect_arts": [68],
    },
    {
        "id": "C3_لا_مادة",
        "clause": "يكون لون السيارة المخصّصة للطرف الثاني أبيض، ويلتزم بغسلها "
                  "مرّة كل أسبوعين على نفقته الخاصة.",
        "articles": [ART_HOURS, ART_WAGE, ART_LEAVE],
        "expect": "لا مادة ذات صلة", "expect_arts": [],
    },
    {
        "id": "C4_مخالف_تجربة",
        "clause": "يخضع الطرف الثاني لفترة تجربة مدتها ستة أشهر، قابلة للتجديد "
                  "مرة أخرى بقرار من صاحب العمل.",
        "articles": [ART_PROB, ART_WAGE, ART_HOURS],
        "expect": "مخالف", "expect_arts": [23],
    },
    {
        # اختبار حقن معادٍ: بند يستند لقانون أجنبي غير معطى للنموذج.
        # النجاح = "لا مادة ذات صلة" بلا اختراع مادة عُمانية.
        "id": "C5_حقن_قانون_أجنبي",
        "clause": "تُحسب مكافأة نهاية الخدمة وفقاً لنظام العمل السعودي الصادر "
                  "بالمرسوم الملكي م/51، بواقع نصف شهر عن كل سنة من السنوات "
                  "الخمس الأولى.",
        "articles": [ART_HOURS, ART_LEAVE, ART_WAGE],
        "expect": "لا مادة ذات صلة", "expect_arts": [],
    },
]


def build_user_msg(case):
    lines = ["### المواد القانونية المتاحة", ""]
    for no, text in case["articles"]:
        lines.append(f"[المادة {no}] {text}")
    lines += ["", "### البند محلّ التدقيق", f"«{case['clause']}»", "",
              "أصدر حكمك الآن بصيغة JSON."]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# إدارة الخادم
# ---------------------------------------------------------------------------
def start_server(model, threads, ctx):
    if not os.path.exists(SERVER):
        sys.exit(f"خطأ: لم أجد {SERVER}")
    if not os.path.exists(model):
        sys.exit(f"خطأ: لم أجد النموذج {model}")
    cmd = [SERVER, "-m", model, "-c", str(ctx), "-t", str(threads),
           "--host", HOST, "--port", str(PORT), "-np", "1", "--no-webui"]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL)
    t0 = time.perf_counter()
    while time.perf_counter() - t0 < 300:
        if proc.poll() is not None:
            sys.exit("خطأ: توقّف llama-server أثناء الإقلاع")
        try:
            with urllib.request.urlopen(f"{BASE}/health", timeout=2) as r:
                if json.loads(r.read())["status"] == "ok":
                    return proc, time.perf_counter() - t0
        except Exception:
            time.sleep(1)
    proc.kill()
    sys.exit("خطأ: انتهت مهلة إقلاع الخادم")


def stop_server(proc):
    proc.terminate()
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()


def chat(case, think, timeout=600):
    body = {
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": build_user_msg(case)},
        ],
        "temperature": 0,
        "max_tokens": 900 if think else 250,
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "verdict", "strict": True, "schema": SCHEMA},
        },
        "chat_template_kwargs": {"enable_thinking": bool(think)},
    }
    req = urllib.request.Request(
        f"{BASE}/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        out = json.loads(r.read().decode("utf-8"))
    return out, time.perf_counter() - t0


def run_case(case, think):
    out, wall = chat(case, think)
    msg = out["choices"][0]["message"]
    raw = msg.get("content") or ""

    tm = out.get("timings") or {}
    usage = out.get("usage") or {}
    p_tok = tm.get("prompt_n", usage.get("prompt_tokens", 0))
    g_tok = tm.get("predicted_n", usage.get("completion_tokens", 0))
    prefill_tps = tm.get("prompt_per_second") or 0
    gen_tps = tm.get("predicted_per_second") or 0

    ok, verdict, arts = False, None, []
    try:
        parsed = json.loads(raw)
        ok = True
        verdict = parsed.get("verdict")
        arts = parsed.get("article_numbers") or []
    except Exception:
        pass

    given = {no for no, _ in case["articles"]}
    hallucinated = [a for a in arts if a not in given]

    return {
        "case": case["id"], "wall": wall,
        "prefill_tps": prefill_tps, "gen_tps": gen_tps,
        "p_tok": p_tok, "g_tok": g_tok,
        "json_ok": ok, "verdict": verdict,
        "verdict_ok": verdict == case["expect"],
        "arts": arts, "arts_ok": sorted(arts) == sorted(case["expect_arts"]),
        "hallucinated": hallucinated, "raw": raw[:400],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--threads", nargs="+", type=int, default=[6])
    ap.add_argument("--ctx", type=int, default=2048)
    ap.add_argument("--think", choices=["off", "on", "both"], default="both")
    ap.add_argument("--runs", type=int, default=1)
    args = ap.parse_args()

    think_modes = {"off": [False], "on": [True], "both": [False, True]}[args.think]
    summary = []

    for nt in args.threads:
        print("=" * 80)
        print(f"تشغيل الخادم: threads={nt}  ctx={args.ctx}  model={os.path.basename(args.model)}")
        proc, load_s = start_server(args.model, nt, args.ctx)
        print(f"زمن التحميل البارد: {load_s:.1f}ث")
        try:
            for think in think_modes:
                tag = "تفكير مفعّل " if think else "تفكير معطّل"
                print(f"\n--- {tag} | threads={nt} ---")
                rows = []
                for case in CASES:
                    for _ in range(args.runs):
                        try:
                            r = run_case(case, think)
                        except Exception as e:
                            print(f"  {case['id']}: خطأ — {e}")
                            continue
                        rows.append(r)
                        mark = "OK" if r["verdict_ok"] else "XX"
                        hall = "  !!هلوسة" if r["hallucinated"] else ""
                        print(f"  {mark} {r['case']:<24} {r['wall']:>6.1f}ث  "
                              f"prefill {r['prefill_tps']:>6.1f}t/s ({r['p_tok']:>4}tk)  "
                              f"gen {r['gen_tps']:>5.1f}t/s ({r['g_tok']:>4}tk)  "
                              f"json={'Y' if r['json_ok'] else 'N'}  "
                              f"→ {r['verdict']}{hall}")
                if not rows:
                    continue
                agg = {
                    "threads": nt, "think": think,
                    "load_s": load_s,
                    "avg_wall": statistics.mean(r["wall"] for r in rows),
                    "avg_prefill": statistics.mean(r["prefill_tps"] for r in rows),
                    "avg_gen": statistics.mean(r["gen_tps"] for r in rows),
                    "avg_gtok": statistics.mean(r["g_tok"] for r in rows),
                    "json_rate": sum(r["json_ok"] for r in rows) / len(rows),
                    "verdict_rate": sum(r["verdict_ok"] for r in rows) / len(rows),
                    "hall": sum(1 for r in rows if r["hallucinated"]),
                    "n": len(rows),
                }
                summary.append(agg)
                print(f"  متوسّط البند {agg['avg_wall']:.1f}ث | "
                      f"JSON {agg['json_rate']*100:.0f}% | "
                      f"دقّة {agg['verdict_rate']*100:.0f}% | "
                      f"هلوسة {agg['hall']}")
        finally:
            stop_server(proc)

    if not summary:
        return
    print("\n" + "=" * 80)
    print("الخلاصة — مرتّبة حسب الدقّة ثم السرعة")
    print("=" * 80)
    print(f"{'خيوط':>5}{'تفكير':>8}{'بند':>9}{'prefill':>10}{'gen':>8}"
          f"{'مخرج':>7}{'JSON':>7}{'دقّة':>7}{'هلوسة':>8}")
    print("-" * 80)
    for a in sorted(summary, key=lambda x: (-x["verdict_rate"], x["avg_wall"])):
        print(f"{a['threads']:>5}{('نعم' if a['think'] else 'لا'):>8}"
              f"{a['avg_wall']:>8.1f}ث{a['avg_prefill']:>10.1f}{a['avg_gen']:>8.1f}"
              f"{a['avg_gtok']:>7.0f}{a['json_rate']*100:>6.0f}%"
              f"{a['verdict_rate']*100:>6.0f}%{a['hall']:>8}")

    best = sorted(summary, key=lambda x: (-x["verdict_rate"], x["avg_wall"]))[0]
    print("-" * 80)
    print(f"الأفضل: threads={best['threads']} | "
          f"تفكير={'نعم' if best['think'] else 'لا'} | {best['avg_wall']:.1f}ث للبند")
    print(f"عقد ٤ بنود ≈ {best['avg_wall']*4:.0f}ث   |   "
          f"عقد ٦ بنود ≈ {best['avg_wall']*6:.0f}ث")

    os.makedirs("bench", exist_ok=True)
    with open("bench/results.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print("\nحُفظت النتائج في bench/results.json")


if __name__ == "__main__":
    main()
