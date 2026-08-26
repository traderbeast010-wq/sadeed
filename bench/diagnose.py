#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تشخيص الحالة C5 — حقن قانون أجنبي.

هذه الحالة الوحيدة التي فشلت في البنشمارك: أعطينا النموذج مواداً عُمانية عن
ساعات العمل والإجازات والأجر، وبنداً يستشهد بنظام العمل السعودي عن مكافأة
نهاية الخدمة. أعاد "مخالف" بدل "لا مادة ذات صلة".

السؤال الحاسم: بماذا استشهد؟
  • إن أعاد article_numbers فارغة  → الحارس يصحّحه تلقائياً، والمعمارية سليمة
  • إن استشهد بمادة غير ذات صلة    → مشكلة حقيقية تحتاج علاجاً في البرومبت

يطبع المخرج الخام كاملاً، ثم يطبّق منطق الحارس ويُظهر الحكم النهائي.
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bench import (SCHEMA, SYSTEM, CASES, build_user_msg,   # noqa: E402
                   start_server, stop_server, BASE)
import urllib.request                                        # noqa: E402
import time                                                  # noqa: E402

MODEL = os.path.join("models", "Qwen3.5-4B-Q4_K_M.gguf")
RUNS = 3


def ask(case, extra_rule=None):
    system = SYSTEM if not extra_rule else SYSTEM + "\n" + extra_rule
    body = {
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": build_user_msg(case)},
        ],
        "temperature": 0,
        "max_tokens": 250,
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "verdict", "strict": True, "schema": SCHEMA},
        },
        "chat_template_kwargs": {"enable_thinking": False},
    }
    req = urllib.request.Request(
        f"{BASE}/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=300) as r:
        out = json.loads(r.read().decode("utf-8"))
    return out["choices"][0]["message"].get("content") or "", time.perf_counter() - t0


def guard(parsed, case):
    """منطق الحارس كما سيُطبَّق في الإنتاج."""
    given = {no for no, _ in case["articles"]}
    verdict = parsed.get("verdict")
    arts = parsed.get("article_numbers") or []
    log = []

    fake = [a for a in arts if a not in given]
    if fake:
        log.append(f"رُفضت مواد غير مسترجَعة: {fake}")
        arts = [a for a in arts if a in given]

    if verdict in ("مخالف", "ناقص") and not arts:
        log.append(f"الحكم '{verdict}' بلا استشهاد → خُفّض إلى 'لا مادة ذات صلة'")
        verdict = "لا مادة ذات صلة"

    return verdict, arts, log


# قاعدة إضافية مرشّحة لعلاج المشكلة إن ثبتت
EXTRA = ("9. تحذير: إن أشار البند إلى قانون أو نظام دولة أخرى، فهذا لا يعني "
         "أنه مخالف. احكم فقط بناء على ما تنصّ عليه المواد المعطاة لك. إن لم "
         "تتناول أي مادة معطاة موضوع البند، فالحكم 'لا مادة ذات صلة'.")


def main():
    case = next(c for c in CASES if c["id"] == "C5_حقن_قانون_أجنبي")
    print(f"البند: {case['clause']}")
    print(f"المواد المعطاة: {[no for no, _ in case['articles']]}")
    print(f"الحكم المتوقّع: {case['expect']}\n")

    proc, load = start_server(MODEL, 6, 2048)
    print(f"(الخادم جاهز في {load:.1f}ث)\n")
    try:
        for label, rule in (("البرومبت الحالي", None),
                            ("البرومبت + قاعدة 9", EXTRA)):
            print("=" * 72)
            print(label)
            print("=" * 72)
            for i in range(RUNS):
                raw, dt = ask(case, rule)
                print(f"\n--- تشغيل {i+1}  ({dt:.1f}ث) ---")
                try:
                    p = json.loads(raw)
                except Exception:
                    print("JSON غير صالح:", raw[:300])
                    continue
                print(f"  verdict         : {p.get('verdict')}")
                print(f"  article_numbers : {p.get('article_numbers')}")
                print(f"  confidence      : {p.get('confidence')}")
                print(f"  reasoning       : {p.get('reasoning')}")
                v, a, log = guard(p, case)
                print(f"  ── الحارس ──")
                for line in log:
                    print(f"     ! {line}")
                ok = "صحيح" if v == case["expect"] else "خطأ"
                print(f"     الحكم النهائي: {v}  ({ok})")
            print()
    finally:
        stop_server(proc)


if __name__ == "__main__":
    main()
