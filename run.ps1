# سديد (Sadeed) — تشغيل النظام
#
#   .\run.ps1              وضع التطوير  (next dev)
#   .\run.ps1 -Demo        وضع العرض    (بناء إنتاجي + تحرير ذاكرة + إحماء)
#
# وضع العرض يوفّر ~1.5 جيجا ذاكرة ويحمّل النموذج مسبقاً، فلا ينتظر
# الحكّام تحميلاً باردًا.

param(
  [switch]$Demo,
  [string]$Backend = "vulkan",   # vulkan أسرع 2× — استخدم cpu إن أردت أقصى استقرار
  [int]$TopK = 2
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Say($m) { Write-Host "  $m" -ForegroundColor DarkGray }

Write-Host "`nسديد" -ForegroundColor Green
Write-Host "──────────────────────────────────────────" -ForegroundColor DarkGray

# ── فحص المتطلّبات ────────────────────────────────────────────────────────
$missing = @()
foreach ($p in @(
    "models\Qwen3.5-4B-Q4_K_M.gguf",
    "models\bge-m3-q8_0.gguf",
    "corpus\articles.json",
    "corpus\embeddings.npy")) {
  if (-not (Test-Path $p)) { $missing += $p }
}
if ($missing) {
  Write-Host "ملفات ناقصة:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}
$bin = if ($Backend -eq "vulkan") { "llamacpp-vulkan" } else { "llamacpp" }
if (-not (Test-Path "$bin\llama-server.exe")) {
  Write-Host "لم أجد $bin\llama-server.exe" -ForegroundColor Red; exit 1
}
Say "المتطلّبات مكتملة  ·  الواجهة الخلفية: $Backend  ·  top_k=$TopK"

# ── تنظيف العمليات المعلّقة ───────────────────────────────────────────────
Get-Process llama-server -ErrorAction SilentlyContinue | Stop-Process -Force
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

# ── وضع العرض: حرّر الذاكرة ───────────────────────────────────────────────
if ($Demo) {
  $freed = 0
  foreach ($n in @("Dropbox", "Notion", "WhatsApp", "WhatsApp.Root",
                   "msedgewebview2", "drawio", "Teams", "Slack")) {
    $p = Get-Process $n -ErrorAction SilentlyContinue
    if ($p) {
      $freed += [math]::Round((($p | Measure-Object WorkingSet64 -Sum).Sum) / 1MB, 0)
      $p | Stop-Process -Force -ErrorAction SilentlyContinue
    }
  }
  if ($freed) { Say "حُرّر ~$freed ميجابايت" }

  $chrome = Get-Process chrome -ErrorAction SilentlyContinue
  if ($chrome) {
    $mb = [math]::Round((($chrome | Measure-Object WorkingSet64 -Sum).Sum) / 1MB, 0)
    Write-Host "  تنبيه: Chrome يستهلك $mb ميجابايت — أغلق التبويبات غير اللازمة" -ForegroundColor Yellow
  }
}

$free = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 1)
Say "الذاكرة الحرّة: $free جيجابايت"
if ($free -lt 5.5) {
  Write-Host "  تحذير: أقلّ من 5.5 جيجا — قد يبطّئ التبديل على القرص الأداء" -ForegroundColor Yellow
}

# ── الواجهة الخلفية ───────────────────────────────────────────────────────
$env:PYTHONIOENCODING = "utf-8"
$env:LAWMIND_BACKEND = $Backend
$env:LAWMIND_TOP_K = "$TopK"

Say "تشغيل الـAPI (تحميل النموذجين ~15 ثانية)…"
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "`$env:PYTHONIOENCODING='utf-8'; `$env:LAWMIND_BACKEND='$Backend'; " +
  "`$env:LAWMIND_TOP_K='$TopK'; Set-Location '$PSScriptRoot'; " +
  "python -m uvicorn api.main:app --host 127.0.0.1 --port 8000"
)

$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 2
  try {
    $h = Invoke-RestMethod "http://127.0.0.1:8000/health" -TimeoutSec 3
    Say "الـAPI جاهز  ·  $($h.law.name) ($($h.law.decree_no)) — $($h.law.articles) مادة"
    $ok = $true; break
  } catch { }
}
if (-not $ok) { Write-Host "  فشل إقلاع الـAPI" -ForegroundColor Red; exit 1 }

# ── الواجهة ───────────────────────────────────────────────────────────────
Set-Location "$PSScriptRoot\web"
if ($Demo) {
  Say "بناء الواجهة للإنتاج (أخفّ من وضع التطوير بـ~500 ميجا)…"
  npm run build | Out-Null
  Say "تشغيل الواجهة…"
  Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command", "Set-Location '$PSScriptRoot\web'; npm run start")
} else {
  Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command", "Set-Location '$PSScriptRoot\web'; npm run dev")
}
Set-Location $PSScriptRoot

Write-Host "──────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  الواجهة   http://localhost:3000" -ForegroundColor Green
Write-Host "  الـAPI     http://127.0.0.1:8000/docs" -ForegroundColor Green
if ($Demo) {
  Write-Host "`n  خطة B: fixtures\demo_analysis.json" -ForegroundColor DarkYellow
}
Write-Host ""
