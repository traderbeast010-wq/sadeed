# نشر سديد — الواجهة على Vercel، والخادم على VPS

## المعمارية
```
[المستخدمون] → واجهة Next.js على Vercel  ──HTTPS──►  الـ VPS (يعمل 24/7):
                                                       FastAPI + Qwen + bge + SQLite
```
- **Vercel**: الواجهة فقط.
- **VPS**: الخادم + النموذجان + قاعدة البيانات. يعمل دائماً، فلا حاجة لجهازك.
- الربط: متغيّر `NEXT_PUBLIC_API_URL` في Vercel = رابط الـ VPS العامّ (HTTPS).

> الشرط الوحيد: الـ VPS يحتاج **≥ 6 جيجا رام** (النموذجان ~5.3 جيجا). خذ خطّة 8 جيجا.

---

## ① رفع الكود على GitHub (من جهازك)
```bash
cd C:\Users\haltw\Desktop\Lawmind
git init
git add .
git commit -m "Sadeed — initial"
git branch -M main
git remote add origin https://github.com/<username>/sadeed.git
git push -u origin main
```
`.gitignore` يستثني النماذج وقاعدة البيانات والأسرار تلقائياً.

---

## ② الخادم على الـ VPS

### أ. أنشئ VPS
Ubuntu 24.04، ≥ 8 جيجا رام (Hetzner CPX21 / Contabo / DigitalOcean). خذ الـ IP.

### ب. ادخل وثبّت
```bash
ssh ubuntu@<VPS_IP>
git clone https://github.com/<username>/sadeed.git Lawmind
cd Lawmind
bash deploy/vps-setup.sh          # يثبّت بايثون + llama.cpp
```

### ج. انقل النموذجين من جهازك (لا يُرفعان على GitHub)
من **جهازك** (نافذة أخرى):
```bash
scp -r C:\Users\haltw\Desktop\Lawmind\models ubuntu@<VPS_IP>:/home/ubuntu/Lawmind/
```
(3.2 جيجا — قد يأخذ وقتاً. بديل: نزّلهما على الـ VPS من نفس مصدرهما على HuggingFace.)

### د. جرّب التشغيل يدوياً
```bash
cd ~/Lawmind
LD_LIBRARY_PATH=$PWD/llamacpp .venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
# في نافذة أخرى:  curl http://127.0.0.1:8000/health   → يجب أن يردّ 200
```

### هـ. اجعله خدمة دائمة (systemd)
```bash
sudo cp deploy/sadeed-api.service /etc/systemd/system/
sudo nano /etc/systemd/system/sadeed-api.service   # عدّل المسار والمستخدم ونطاق Vercel
sudo systemctl daemon-reload
sudo systemctl enable --now sadeed-api
journalctl -u sadeed-api -f        # تابع الإقلاع (~15ث لتحميل النموذج)
```

---

## ③ كشف الخادم للإنترنت عبر HTTPS (نفق Cloudflare)

Vercel يعمل بـHTTPS، فالخادم لازم يكون HTTPS أيضاً. أسهل طريق بلا شهادات ولا نطاق:

```bash
# ثبّت cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/

# نفق سريع — يعطي رابط HTTPS فوراً
cloudflared tunnel --url http://localhost:8000
```
سيطبع رابطاً مثل: `https://xxxx-yy.trycloudflare.com` — **انسخه**.

> الرابط السريع يبقى ثابتاً ما دام cloudflared شغّالاً، ويتغيّر لو أُعيد تشغيله.
> **لرابط ثابت دائم**: أنشئ Named Tunnel بحساب Cloudflare + نطاقك (خطّة مجانية)،
> أو استخدم Caddy + نطاق DuckDNS مجانيّ. اطلب منّي التفاصيل إن أردت.

لجعل النفق خدمة دائمة أيضاً:
```bash
sudo tee /etc/systemd/system/sadeed-tunnel.service >/dev/null <<'EOF'
[Unit]
Description=Sadeed Cloudflare Tunnel
After=sadeed-api.service
[Service]
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:8000
Restart=always
User=ubuntu
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable --now sadeed-tunnel
journalctl -u sadeed-tunnel | grep trycloudflare   # لرؤية الرابط
```

---

## ④ الواجهة على Vercel

1. ادخل vercel.com بحساب GitHub، واختر مستودع `sadeed`.
2. **Root Directory** = `web`  (مهمّ — الواجهة داخل مجلد web).
3. Framework = Next.js (يُكتشَف تلقائياً).
4. **Environment Variables** → أضف:
   ```
   NEXT_PUBLIC_API_URL = https://xxxx-yy.trycloudflare.com
   ```
   (رابط النفق من الخطوة ③، بلا شرطة مائلة في النهاية.)
5. Deploy. ستحصل على رابط `https://sadeed-xxx.vercel.app`.

6. **أعِد ضبط CORS**: على الـ VPS، ضع نطاق Vercel في الخدمة:
   ```bash
   sudo nano /etc/systemd/system/sadeed-api.service
   # SADEED_CORS_ORIGINS=https://sadeed-xxx.vercel.app
   sudo systemctl daemon-reload && sudo systemctl restart sadeed-api
   ```

---

## ⑤ التجربة
افتح رابط Vercel → صفحة الهبوط → «الدخول» → أنشئ حساباً → ارفع عقداً.
أوّل تدقيق على VPS بلا كرت رسوميّ **أبطأ** من جهازك (دقائق للعقد الطويل).

## ملاحظات
- **الخصوصية**: بيانات المستخدمين (كلمات المرور مُعمّاة، العقود) تصير على الـ VPS لا جهازك. أخبر أصدقاءك ألّا يرفعوا عقوداً سرّية حقيقية أثناء التجربة.
- **إن تغيّر رابط النفق**: حدّث `NEXT_PUBLIC_API_URL` في Vercel وأعِد النشر (Redeploy)، لأنه يُدمج وقت البناء.
- **أي خطأ في الإعداد**: انسخ لي رسالة الخطأ من `journalctl -u sadeed-api -f` وأصلحه لك.
