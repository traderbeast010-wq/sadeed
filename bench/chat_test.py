# -*- coding: utf-8 -*-
"""اختبار الطبقات الأربع لمساعد المحادثة."""
import json, sys, time, urllib.request

AID = sys.argv[1] if len(sys.argv) > 1 else "94242d0e4665"
BASE = "http://127.0.0.1:8000"

TESTS = [
    ("① تحية",        "صباح الخير"),
    ("② عن العقد",    "من هم أطراف هذا العقد؟"),
    ("② عن العقد",    "كم الأجر المتفق عليه؟"),
    ("③ عن القانون",  "كم ساعة عمل يجيزها القانون في اليوم؟"),
    ("④ خارج النطاق", "ما حكم عقد الإيجار في القانون السعودي؟"),
    ("④ خارج النطاق", "وش رايك في أسعار العقارات هالفترة؟"),
    ("① تحية",        "شكراً"),
    ("② عن العقد",    "ما مدة العقد؟ وهل فيها مشكلة؟"),
]

def ask(msg, history):
    body = json.dumps({"message": msg, "history": history}).encode()
    req = urllib.request.Request(f"{BASE}/analyses/{AID}/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.perf_counter()
    mode, answer, arts, guard = None, "", [], []
    with urllib.request.urlopen(req, timeout=400) as r:
        for raw in r:
            line = raw.decode("utf-8").strip()
            if not line.startswith("data: "):
                continue
            e = json.loads(line[6:])
            if e["stage"] == "meta":
                mode, arts = e["mode"], e["articles"]
            elif e["stage"] == "done":
                answer, guard = e["answer"], e.get("guard_log", [])
            elif e["stage"] == "error":
                answer = "خطأ: " + e["message"]
    return mode, answer, arts, guard, time.perf_counter() - t0

hist = []
for label, q in TESTS:
    mode, ans, arts, guard, dt = ask(q, hist)
    print("=" * 72)
    print(f"{label}   [{mode}]   {dt:.1f}ث   مواد={arts or '—'}")
    print(f"  س: {q}")
    print(f"  ج: {ans}")
    for g in guard:
        print(f"  🛡 {g}")
    hist += [{"role": "user", "content": q},
             {"role": "assistant", "content": ans}]
