# -*- coding: utf-8 -*-
import json, sys, time, urllib.request
AID = sys.argv[1]
BASE = "http://127.0.0.1:8000"
TESTS = [
    ("أهلا", "أهلا"),
    ("من أنت", "من أنت"),
    ("سليم؟", "هل العقد سليم 100%؟"),
    ("عابر", "البند الرابع عن القانون الأجنبي، أي قانون يخصّه؟"),
]
def ask(msg, hist):
    body = json.dumps({"message": msg, "history": hist}).encode()
    req = urllib.request.Request(f"{BASE}/analyses/{AID}/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    t0=time.perf_counter(); mode,ans="?",""
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            for raw in r:
                line=raw.decode("utf-8").strip()
                if not line.startswith("data: "): continue
                e=json.loads(line[6:])
                if e["stage"]=="meta": mode=e["mode"]
                elif e["stage"]=="done": ans=e["answer"]
                elif e["stage"]=="error": ans="خطأ: "+e["message"]
    except Exception as ex: ans=f"NETWORK ERROR: {ex}"
    return mode, ans, time.perf_counter()-t0
hist=[]
for label,q in TESTS:
    mode,ans,dt=ask(q,hist)
    print("="*70); print(f"[{label}] [{mode}] {dt:.1f}ث")
    print(f"  س: {q}"); print(f"  ج: {ans}")
    hist+=[{"role":"user","content":q},{"role":"assistant","content":ans}]
