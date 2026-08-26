#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
مسح أداء المعالجة المسبقة (prefill) — العنق الحقيقي.

القياس الأول أعطى 29 توكن/ث، وهو رقم منخفض لمعالج i5-12450H بـAVX2 على
نموذج 4B مكمّم. هذا المسح يبحث عن الإعداد الأمثل.

يستخدم برومبتاً **حقيقياً** من الكوربوس (لا مواد مختصرة مخترعة) حتى تعكس
الأرقام الحمل الفعلي.

    python bench/perf_sweep.py
    python bench/perf_sweep.py --vulkan
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "agent"))
from validator import SYSTEM, SCHEMA, build_user_message  # noqa: E402

MODEL = os.path.join("models", "Qwen3.5-4B-Q4_K_M.gguf")
PORT = 8088
BASE = f"http://127.0.0.1:{PORT}"

CLAUSE = ("يلتزم الطرف الثاني بالعمل لمدة اثنتي عشرة ساعة يومياً، بواقع ستة "
          "أيام في الأسبوع، دون أجر إضافي.")


def load_real_articles(nums=(70, 71, 76)):
    with open(os.path.join("corpus", "articles.json"), encoding="utf-8") as f:
        arts = {a["article_no"]: a for a in json.load(f)["articles"]}
    return [{"article_no": n, "text": arts[n]["text"]} for n in nums]


def start(binary_dir, threads, ctx, flash, batch, ubatch, ngl=None):
    exe = os.path.join(binary_dir, "llama-server.exe")
    cmd = [exe, "-m", MODEL, "-c", str(ctx), "-t", str(threads),
           "--host", "127.0.0.1", "--port", str(PORT), "--no-webui",
           "-b", str(batch), "-ub", str(ubatch)]
    if ngl is not None:
        cmd += ["-ngl", str(ngl)]
    if flash:
        cmd += ["-fa", "on"]
    p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.perf_counter()
    while time.perf_counter() - t0 < 240:
        if p.poll() is not None:
            return None, 0
        try:
            with urllib.request.urlopen(f"{BASE}/health", timeout=2) as r:
                if json.loads(r.read())["status"] == "ok":
                    return p, time.perf_counter() - t0
        except Exception:
            time.sleep(0.7)
    p.kill()
    return None, 0


def stop(p):
    if not p:
        return
    p.terminate()
    try:
        p.wait(timeout=15)
    except subprocess.TimeoutExpired:
        p.kill()


def run_once(hits, tag=""):
    # cache_prompt=False إلزامي: بدونه يقيس الطلبُ الثاني إصابةَ الذاكرة
    # المؤقتة لا المعالجة المسبقة الحقيقية، فتخرج أرقام لا معنى لها.
    body = {
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user",
                      "content": build_user_message(CLAUSE + tag, hits)}],
        "cache_prompt": False,
        "temperature": 0, "max_tokens": 250,
        "response_format": {"type": "json_schema",
                            "json_schema": {"name": "o", "strict": True,
                                            "schema": SCHEMA}},
        "chat_template_kwargs": {"enable_thinking": False},
    }
    req = urllib.request.Request(
        f"{BASE}/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=600) as r:
        out = json.loads(r.read().decode("utf-8"))
    wall = time.perf_counter() - t0
    tm = out.get("timings", {})
    return {
        "wall": wall,
        "p_tok": tm.get("prompt_n", 0),
        "prefill": tm.get("prompt_per_second", 0),
        "g_tok": tm.get("predicted_n", 0),
        "gen": tm.get("predicted_per_second", 0),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vulkan", action="store_true")
    ap.add_argument("--threads", nargs="+", type=int, default=[4, 6, 8, 12])
    ap.add_argument("--ngl", nargs="+", type=int, default=None)
    args = ap.parse_args()

    bindir = "llamacpp-vulkan" if args.vulkan else "llamacpp"
    if not os.path.exists(os.path.join(bindir, "llama-server.exe")):
        sys.exit(f"لم أجد {bindir}/llama-server.exe")

    hits = load_real_articles()
    total_chars = sum(len(h["text"]) for h in hits)
    print(f"البناء : {bindir}")
    print(f"البرومبت: مواد حقيقية {[h['article_no'] for h in hits]} "
          f"({total_chars} محرف)\n")

    configs = []
    if args.ngl is not None:
        for g in args.ngl:
            configs.append({"threads": args.threads[0], "flash": False,
                            "b": 2048, "ub": 2048, "ngl": g})
    else:
        for t in args.threads:
            configs.append({"threads": t, "flash": False, "b": 2048, "ub": 512})
    if args.ngl is None:
        # أفضل عدد خيوط يُعاد اختباره مع Flash Attention وأحجام دفعات مختلفة
        configs.append({"threads": 0, "flash": True, "b": 2048, "ub": 512})
        configs.append({"threads": 0, "flash": True, "b": 2048, "ub": 2048})
        configs.append({"threads": 0, "flash": False, "b": 2048, "ub": 2048})

    results, best_threads = [], None
    print(f"{'خيوط':>5}{'ngl':>5}{'fa':>4}{'ub':>7}{'تحميل':>8}"
          f"{'prefill':>10}{'gen':>8}{'زمن البند':>11}")
    print("-" * 56)

    for cfg in configs:
        threads = cfg["threads"] or best_threads or args.threads[0]
        p, load = start(bindir, threads, 2048, cfg["flash"], cfg["b"],
                        cfg["ub"], cfg.get("ngl"))
        if not p:
            print(f"{threads:>5}{'Y' if cfg['flash'] else 'N':>5}"
                  f"{cfg['ub']:>7}   فشل الإقلاع")
            continue
        try:
            # لاحقة مختلفة لكل تشغيل تمنع أي إصابة عرضية للذاكرة المؤقتة
            r = run_once(hits, tag=f" [{threads}/{cfg['ub']}]")
        except Exception as e:
            print(f"{threads:>5}  خطأ: {e}")
            stop(p)
            continue
        finally:
            pass
        stop(p)

        row = {"threads": threads, "flash": cfg["flash"], "ub": cfg["ub"],
               "load": load, **r}
        results.append(row)
        print(f"{threads:>5}{str(cfg.get('ngl','—')):>5}"
              f"{'Y' if cfg['flash'] else 'N':>4}{cfg['ub']:>7}"
              f"{load:>7.1f}ث{r['prefill']:>10.1f}{r['gen']:>8.1f}"
              f"{r['wall']:>10.1f}ث")

        if cfg["threads"] and (best_threads is None or
                               r["prefill"] > max(x["prefill"] for x in results
                                                  if x["threads"] == best_threads)):
            best_threads = threads

    if not results:
        return
    print("-" * 56)
    best = max(results, key=lambda x: x["prefill"])
    base = results[0]
    print(f"\nالأفضل: خيوط={best['threads']} fa={'Y' if best['flash'] else 'N'} "
          f"ub={best['ub']}")
    print(f"  prefill {best['prefill']:.1f} توكن/ث  "
          f"(الأساس {base['prefill']:.1f} → تحسّن "
          f"{(best['prefill']/base['prefill']-1)*100:+.0f}%)")
    print(f"  زمن البند {best['wall']:.1f}ث (الأساس {base['wall']:.1f}ث)")
    print(f"  عقد ٥ بنود ≈ {best['wall']*5:.0f}ث")


if __name__ == "__main__":
    main()
