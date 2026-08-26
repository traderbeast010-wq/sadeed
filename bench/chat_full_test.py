# -*- coding: utf-8 -*-
"""اختبار شامل: التحيّات الفورية + الفئات العشر."""
import json, sys, time, urllib.request

AID = sys.argv[1] if len(sys.argv) > 1 else "94242d0e4665"
BASE = "http://127.0.0.1:8000"

TESTS = [
    ("تحية", "أهلا"),
    ("جلسة", "احنا وين"),
    ("عقد-عامية", "منهو الطرف الثاني؟"),
    ("جلسة", "وش الوضع"),
    ("قانون-عامية", "كم ساعة يبي يشتغل حسب القانون؟"),
    ("جلسة", "لخص لي"),
]

def ask(msg, hist):
    body = json.dumps({"message": msg, "history": hist}).encode()
    req = urllib.request.Request(f"{BASE}/analyses/{AID}/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.perf_counter(); mode, ans, arts, guard = None, "", [], []
    with urllib.request.urlopen(req, timeout=400) as r:
        for raw in r:
            line = raw.decode("utf-8").strip()
            if not line.startswith("data: "):
                continue
            e = json.loads(line[6:])
            if e["stage"] == "meta":
                mode, arts = e["mode"], e["articles"]
            elif e["stage"] == "done":
                ans, guard = e["answer"], e.get("guard_log", [])
            elif e["stage"] == "error":
                ans = "خطأ: " + e["message"]
    return mode, ans, arts, guard, time.perf_counter() - t0

hist = []
for label, q in TESTS:
    mode, ans, arts, guard, dt = ask(q, hist)
    flag = "⚡" if dt < 1 else "  "
    print("=" * 74)
    print(f"{flag} [{label}] [{mode}] {dt:.1f}ث  مواد={arts or '—'}")
    print(f"   س: {q}")
    print(f"   ج: {ans}")
    for g in guard:
        print(f"   🛡 {g}")
    hist += [{"role": "user", "content": q},
             {"role": "assistant", "content": ans}]
