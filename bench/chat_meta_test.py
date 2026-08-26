# -*- coding: utf-8 -*-
"""اختبار فئة الأسئلة عن المساعد نفسه."""
import json, sys, time, urllib.request

AID = sys.argv[1] if len(sys.argv) > 1 else "94242d0e4665"
BASE = "http://127.0.0.1:8000"
TESTS = ["من أنت؟", "كيف تعمل؟", "على أي قانون تعتمد؟",
         "هل أنت محامي؟", "صباح الخير", "من هم أطراف العقد؟"]

def ask(msg, hist):
    body = json.dumps({"message": msg, "history": hist}).encode()
    req = urllib.request.Request(f"{BASE}/analyses/{AID}/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.perf_counter(); mode, ans, arts = None, "", []
    with urllib.request.urlopen(req, timeout=400) as r:
        for raw in r:
            line = raw.decode("utf-8").strip()
            if not line.startswith("data: "):
                continue
            e = json.loads(line[6:])
            if e["stage"] == "meta":
                mode, arts = e["mode"], e["articles"]
            elif e["stage"] == "done":
                ans = e["answer"]
            elif e["stage"] == "error":
                ans = "خطأ: " + e["message"]
    return mode, ans, arts, time.perf_counter() - t0

hist = []
for q in TESTS:
    mode, ans, arts, dt = ask(q, hist)
    print("=" * 72)
    print(f"[{mode}]  {dt:.1f}ث  مواد={arts or '—'}")
    print(f"  س: {q}")
    print(f"  ج: {ans}")
    hist += [{"role": "user", "content": q},
             {"role": "assistant", "content": ans}]
