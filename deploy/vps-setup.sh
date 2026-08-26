#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# سديد (Sadeed) — إعداد كامل على VPS بنظام Ubuntu (x86_64)، يُشغَّل مرّة واحدة.
# يثبّت التبعيات، ويُنزّل llama.cpp و cloudflared، ويُنشئ خدمتي systemd.
# لا يُنزّل النموذجين (models/) — تُنسخ من جهازك بـscp (تُطبع التعليمات آخِراً).
# يعمل سواء كمستخدم root (Hostinger) أو بـsudo.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
RUN_USER="$(id -un)"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
# ⬇️ نطاق Vercel — عدّله إن تغيّر
VERCEL_ORIGIN="https://sadeed-nine.vercel.app"

echo "== المشروع: $ROOT  ·  المستخدم: $RUN_USER =="

echo "== [1/5] حزم النظام =="
$SUDO apt-get update -y
$SUDO apt-get install -y python3 python3-venv python3-pip unzip curl libgomp1

echo "== [2/5] بيئة بايثون + التبعيات =="
python3 -m venv .venv
. .venv/bin/activate
pip install -q -U pip
pip install -q -r requirements.txt

echo "== [3/5] بناء llama.cpp من المصدر (أضمن من الثنائيّ الجاهز) =="
$SUDO apt-get install -y build-essential cmake git
mkdir -p llamacpp
rm -rf /tmp/llamacpp-src
git clone --depth 1 https://github.com/ggml-org/llama.cpp /tmp/llamacpp-src
cmake -S /tmp/llamacpp-src -B /tmp/llamacpp-src/build -DLLAMA_CURL=OFF
cmake --build /tmp/llamacpp-src/build --config Release -j"$(nproc)" --target llama-server
cp /tmp/llamacpp-src/build/bin/llama-server llamacpp/llama-server
find /tmp/llamacpp-src/build \( -name '*.so' -o -name '*.so.*' \) \
  -exec cp {} llamacpp/ \; 2>/dev/null || true
chmod +x llamacpp/llama-server
echo "   بُني llama-server ($(ls llamacpp | wc -l) ملفاً في llamacpp/)"

echo "== [4/5] cloudflared (نفق HTTPS) =="
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o /tmp/cloudflared
  $SUDO install -m 0755 /tmp/cloudflared /usr/local/bin/cloudflared
fi
echo "   $(cloudflared --version 2>&1 | head -1)"

echo "== [5/5] خدمتا systemd =="
$SUDO tee /etc/systemd/system/sadeed-api.service >/dev/null <<EOF
[Unit]
Description=Sadeed API (FastAPI + llama.cpp)
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$ROOT
Environment=PYTHONIOENCODING=utf-8
Environment=LAWMIND_TOP_K=1
Environment=LAWMIND_THREADS=2
Environment=LAWMIND_NP=1
Environment=LAWMIND_CTX=4096
Environment=LD_LIBRARY_PATH=$ROOT/llamacpp
Environment=SADEED_CORS_ORIGINS=$VERCEL_ORIGIN,http://localhost:3000
ExecStart=$ROOT/.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5
TimeoutStartSec=180
[Install]
WantedBy=multi-user.target
EOF

$SUDO tee /etc/systemd/system/sadeed-tunnel.service >/dev/null <<EOF
[Unit]
Description=Sadeed Cloudflare Tunnel
After=sadeed-api.service
[Service]
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:8000
Restart=always
RestartSec=5
User=$RUN_USER
[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable sadeed-api sadeed-tunnel >/dev/null 2>&1 || true

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " تمّ الإعداد. بقيت خطوتان:"
echo ""
echo " 1) من جهازك (PowerShell)، انسخ النموذجين إلى الخادم:"
echo "      scp -r C:\\Users\\haltw\\Desktop\\Lawmind\\models $RUN_USER@<VPS_IP>:$ROOT/"
echo ""
echo " 2) بعد اكتمال النسخ، شغّل الخدمات هنا:"
echo "      $SUDO systemctl start sadeed-api sadeed-tunnel"
echo "      # انتظر ~20ث، ثم اعرف رابط النفق:"
echo "      journalctl -u sadeed-tunnel | grep -o 'https://[^ ]*trycloudflare.com' | tail -1"
echo "════════════════════════════════════════════════════════════════"
