#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# سديد (Sadeed) — إعداد خادم بايثون على VPS بنظام Ubuntu 22.04/24.04 (x86_64)
#
# يُشغَّل مرّة واحدة من داخل مجلد المشروع بعد استنساخه:
#   git clone <repo> Lawmind && cd Lawmind && bash deploy/vps-setup.sh
#
# ما يفعله: يثبّت تبعيات بايثون، ويُنزّل ثنائيّ llama.cpp للينكس.
# النموذجان (models/) لا يُنزَّلان هنا — انسخهما من جهازك (انظر DEPLOY.md).
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
echo "== مجلد المشروع: $ROOT =="

echo "== تثبيت حزم النظام =="
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3-pip unzip curl libgomp1

echo "== بيئة بايثون الافتراضية + التبعيات =="
python3 -m venv .venv
# shellcheck disable=SC1091
. .venv/bin/activate
pip install -U pip
pip install -r requirements.txt

echo "== تنزيل ثنائيّ llama.cpp (Linux x64) =="
mkdir -p llamacpp
ASSET="$(curl -fsSL https://api.github.com/repos/ggml-org/llama.cpp/releases/latest \
  | grep -oE 'https://[^"]*ubuntu-x64[^"]*\.zip' | head -1)"
if [ -z "$ASSET" ]; then
  echo "!! لم أجد أصل ubuntu-x64 في آخر إصدار. حمّله يدوياً من:"
  echo "   https://github.com/ggml-org/llama.cpp/releases"
  exit 1
fi
echo "   $ASSET"
curl -fL "$ASSET" -o /tmp/llama.zip
rm -rf /tmp/llama && unzip -oq /tmp/llama.zip -d /tmp/llama
# انسخ الخادم وكل المكتبات المشتركة (libggml*, libllama*) بجانبه
find /tmp/llama -name 'llama-server' -exec cp {} llamacpp/llama-server \;
find /tmp/llama \( -name '*.so' -o -name '*.so.*' \) -exec cp {} llamacpp/ \;
chmod +x llamacpp/llama-server
echo "   ثُبّت في llamacpp/ ($(ls llamacpp | wc -l) ملفاً)"

echo ""
echo "== تمّ الإعداد الأساسيّ. الخطوات المتبقّية (انظر deploy/DEPLOY.md): =="
echo "  1) انسخ مجلد models/ (Qwen + bge) من جهازك إلى $ROOT/models/"
echo "  2) جرّب التشغيل:"
echo "       LD_LIBRARY_PATH=$ROOT/llamacpp .venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000"
echo "  3) ثبّت خدمة systemd + نفق Cloudflare (DEPLOY.md)"
