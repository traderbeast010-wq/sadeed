#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
إدارة خوادم llama.cpp والتخاطب معها.

خادمان منفصلان:
  • التضمين (bge-m3)  على المنفذ 8081 — للاسترجاع
  • الاستدلال (Qwen3.5-4B) على المنفذ 8080 — للحكم

الذاكرة ضيّقة على هذا الجهاز، فالافتراضي تشغيلهما بالتناوب لا معاً:
نضمّن كل البنود دفعة واحدة، نوقف خادم التضمين، ثم نشغّل خادم الاستدلال.
"""

import json
import os
import subprocess
import time
import urllib.error
import urllib.request

# اختيار الواجهة الخلفية.
#
# بناء Vulkan (كرت إنتل المدمج) أسرع في المعالجة المسبقة: 72 توكن/ث مقابل
# 30 على المعالج، فينزل زمن البند من 29.3ث إلى 22.1ث. لكنه **انهار مرّة**
# أثناء التقييم بذاكرة حرّة 8.6 جيجا — أي عدم استقرار في التعريف لا ضغط
# موارد. سبع ثوانٍ لا تساوي مخاطرة انهيار أثناء العرض، فالافتراضي المعالج.
#
#     set LAWMIND_BACKEND=vulkan     لتفعيل الكرت
# اسم الثنائيّ حسب النظام: ‎.exe‎ على ويندوز، بلا امتداد على Linux (الـVPS).
_EXE = ".exe" if os.name == "nt" else ""
_CPU = os.path.join("llamacpp", "llama-server" + _EXE)
_VULKAN = os.path.join("llamacpp-vulkan", "llama-server" + _EXE)
SERVER_BIN = (_VULKAN
              if os.environ.get("LAWMIND_BACKEND") == "vulkan"
              and os.path.exists(_VULKAN)
              else _CPU)

EMBED_MODEL = os.path.join("models", "bge-m3-q8_0.gguf")
LLM_MODEL = os.path.join("models", "Qwen3.5-4B-Q4_K_M.gguf")

# نموذج المحادثة — مُعطَّل عمداً بعد قياس فعليّ.
#
# جُرّب Qwen3.5-2B للمحادثة على أمل مضاعفة السرعة (السرعة ∝ 1/الحجم).
# كسبنا 36% من الزمن وخسرنا صحّة الجواب. أربعة عيوب في خمسة أسئلة:
#
#   ① تناقض داخل الجواب الواحد: «البند مخالف» ثم «البند غير مخالف».
#   ② اختلاق مضمون ينسبه لمواد حقيقية: «المادة (46) تنص على أن صاحب العمل
#      لا يجوز له تقليص عدد عماله إلا بعد موافقة العامل» — مخترَع بالكامل.
#      الحارس لا يمسك هذا: الرقم حقيقي ومسترجَع، والمختلَق هو المضمون.
#   ③ كسر حدّ صريح: أفتى بـ«لا أنصح بتوقيع العقد» بدل ترك القرار للمحامي.
#   ④ جواب فارغ تماماً على سؤال سليم.
#
# الخلاصة: 4B هو الحدّ الأدنى لهذه المهمّة على هذا العتاد. الطريق الوحيد
# لسرعة أعلى بجودة أعلى هو عتاد أقوى، لا نموذج أصغر.
# (ملف 2B حُذف. أعِد المسار هنا لو أردت إعادة التجربة بنموذج آخر.)
CHAT_MODEL = os.path.join("models", "__disabled__.gguf")

EMBED_PORT = 8081
LLM_PORT = 8080
CHAT_PORT = 8082

# الإعداد الأمثل يختلف بين الواجهتين — قياس فعلي لا افتراض:
#   المعالج : خيوط 12 · ub 512   → prefill 30.7 توكن/ث
#   الكرت   : خيوط  6 · ub 2048  → prefill 72.1 توكن/ث
_IS_VULKAN = SERVER_BIN == _VULKAN
# عدد الخيوط: على VPS ذي نواتين، 12 خيطاً يتزاحم ويُبطئ — اضبطه بـ
#   LAWMIND_THREADS=2  ليطابق النوى. الافتراضي كما كان محلياً.
THREADS = int(os.environ.get("LAWMIND_THREADS", "0")) or (6 if _IS_VULKAN else 12)
UBATCH = 2048 if _IS_VULKAN else 512


class LlamaServer:
    """يشغّل llama-server كعملية فرعية ويوقفه عند الخروج."""

    def __init__(self, model, port, embedding=False, ctx=2048,
                 threads=THREADS, pooling="cls", parallel=1):
        self.model, self.port, self.embedding = model, port, embedding
        self.ctx, self.threads, self.pooling = ctx, threads, pooling
        # عدد المَسالك (slots): نسخة واحدة من النموذج في الذاكرة، وذاكرة
        # برومبت مؤقتة مستقلّة لكل مَسلك. هكذا يتشارك التدقيق والمحادثة
        # النموذج نفسه دون أن يُبطل أحدهما بادئة الآخر — بدل تحميله مرّتين
        # وهو ما كان يلتهم 8.8 جيجا لنموذج حجمه 2.6.
        self.parallel = parallel
        self.proc = None
        self.base = f"http://127.0.0.1:{port}"

    # أدنى نافذة يحتاجها مَسلك واحد: برومبت النظام + مادّتان + بند + مخرَج.
    MIN_SLOT_CTX = 1800

    def start(self, timeout=300):
        for path in (SERVER_BIN, self.model):
            if not os.path.exists(path):
                raise FileNotFoundError(path)

        # llama.cpp يقسم -c على عدد المَسالك. طلبُ ctx صغير مع np كبير
        # يعطي نافذة أضيق من أن تسع مادّتين قانونيتين، فيُقتطع البرومبت
        # صامتاً («لا مادة ذات صلة» لبند واضح) ثم يُرجع الخادم 400.
        if not self.embedding:
            per_slot = self.ctx // max(self.parallel, 1)
            if per_slot < self.MIN_SLOT_CTX:
                raise ValueError(
                    f"نافذة المَسلك {per_slot} توكن (ctx={self.ctx} ÷ "
                    f"np={self.parallel}) أضيق من الحد الأدنى "
                    f"{self.MIN_SLOT_CTX}. ارفع ctx أو أنقص parallel."
                )
        # خادم التضمين يحتاج دفعة تسع المادة كاملة (التجميع يشترط ذلك)
        ub = min(self.ctx, 4096) if self.embedding else min(UBATCH, self.ctx)
        cmd = [SERVER_BIN, "-m", self.model, "-c", str(self.ctx),
               "-t", str(self.threads), "--host", "127.0.0.1",
               "--port", str(self.port), "--no-webui",
               "-b", str(max(2048, ub)), "-ub", str(ub),
               "-np", str(self.parallel)]
        if self.embedding:
            # التضمين بالتجميع (pooling) يشترط أن تسع الدفعة الفيزيائية
            # التسلسل كاملاً — والافتراضي (512) أصغر من مواد القانون الطويلة.
            cmd += ["--embedding", "--pooling", self.pooling]
        self.proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL)
        t0 = time.perf_counter()
        while time.perf_counter() - t0 < timeout:
            if self.proc.poll() is not None:
                raise RuntimeError(f"توقّف llama-server أثناء الإقلاع ({self.model})")
            try:
                with urllib.request.urlopen(f"{self.base}/health", timeout=2) as r:
                    if json.loads(r.read())["status"] == "ok":
                        return time.perf_counter() - t0
            except Exception:
                time.sleep(0.7)
        self.stop()
        raise TimeoutError("انتهت مهلة إقلاع الخادم")

    def stop(self):
        if not self.proc:
            return
        self.proc.terminate()
        try:
            self.proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.proc = None

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *exc):
        self.stop()

    # ── الطلبات ────────────────────────────────────────────────────────
    def _post(self, path, payload, timeout=600):
        req = urllib.request.Request(
            f"{self.base}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))

    def embed(self, texts, batch=16):
        """نصوص ← متجهات مطبَّعة الطول (جاهزة لحاصل الضرب النقطي)."""
        if isinstance(texts, str):
            texts = [texts]
        out = []
        for i in range(0, len(texts), batch):
            chunk = texts[i:i + batch]
            res = self._post("/v1/embeddings", {"input": chunk})
            out.extend(d["embedding"] for d in
                       sorted(res["data"], key=lambda d: d["index"]))
        return out

    def chat(self, system, user, schema=None, max_tokens=250, temperature=0.0):
        body = {
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": user}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "chat_template_kwargs": {"enable_thinking": False},
        }
        if schema:
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "out", "strict": True, "schema": schema},
            }
        res = self._post("/v1/chat/completions", body)
        msg = res["choices"][0]["message"].get("content") or ""
        return msg, res.get("timings", {})

    def chat_stream(self, messages, max_tokens=320, temperature=0.3,
                    timeout=600):
        """
        يبثّ الردّ توكناً توكناً.

        على هذا الجهاز التوليد ~7–9 توكن/ث، أي أن ردّاً من 150 توكن يستغرق
        ~18 ثانية. بلا بثّ تبدو المحادثة معلّقة؛ مع البثّ تبدو حيّة رغم
        السرعة نفسها.
        """
        body = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            "cache_prompt": True,
            "chat_template_kwargs": {"enable_thinking": False},
        }
        req = urllib.request.Request(
            f"{self.base}/v1/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            for raw in r:
                line = raw.decode("utf-8").strip()
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                piece = delta.get("content")
                if piece:
                    yield piece


def embedding_server(**kw):
    return LlamaServer(EMBED_MODEL, EMBED_PORT, embedding=True,
                       ctx=kw.pop("ctx", 8192), **kw)


def llm_server(**kw):
    """
    خادم التوليد — يخدم التدقيق والمحادثة معاً.

    السياق موزّع على مَسلكين: 8192 إجمالاً = 4096 لكل مَسلك. يكفي التدقيق
    (يحتاج ~1000) والمحادثة (تحتاج ~2500 مع نصّ العقد والتاريخ)، ويبقي
    ذاكرة كلٍّ مستقلّة.
    """
    return LlamaServer(LLM_MODEL, LLM_PORT, embedding=False,
                       ctx=kw.pop("ctx", 8192),
                       parallel=kw.pop("parallel", 2), **kw)


def _resolve_chat_model():
    """
    نموذج المحادثة. يُختار الصغير إن وُجد، ويُرجع إلى نموذج التدقيق إن لم
    يُنزَّل بعد — فلا ينكسر النظام في الحالتين.

        set LAWMIND_CHAT_MODEL=big    ← للعودة إلى 4B إن لم ترضَ الجودة
    """
    if os.environ.get("LAWMIND_CHAT_MODEL") == "big":
        return LLM_MODEL
    return CHAT_MODEL if os.path.exists(CHAT_MODEL) else LLM_MODEL


def chat_server(**kw):
    return LlamaServer(_resolve_chat_model(), CHAT_PORT, embedding=False,
                       ctx=kw.pop("ctx", 4096), **kw)


def chat_model_name():
    return os.path.basename(_resolve_chat_model())
