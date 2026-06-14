@echo off
chcp 65001 >nul
title اكاديمية القادة - النسخة الحية
cd /d "%~dp0"

echo ============================================================
echo    اكاديمية القادة - النسخة الحية ^| جامعة لوسيل
echo    اعداد: ايمان الحصني
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js غير مثبت على هذا الجهاز.
  echo     حمليه مجانا من:  https://nodejs.org  ^(اختاري LTS^)
  echo     ثم اعيدي تشغيل هذا الملف.
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo [1/3] تجهيز اول مرة ^(قد ياخذ دقيقة^)...
  call npm install --omit=dev
  echo.
)

echo [2/3] تشغيل الخادم...
start "LU Live Server" cmd /c "node server.js"
timeout /t 3 >nul

echo [3/3] انشاء الرابط العام للطلاب...
if not exist cloudflared.exe (
  echo      تنزيل اداة الرابط العام لاول مرة...
  powershell -Command "try{Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'}catch{Write-Host 'تعذر التنزيل - تحققي من الانترنت'}"
)
echo.
echo ------------------------------------------------------------
echo  افتحي شاشة المحاضرة محليا على:  http://localhost:3000
echo  وسيظهر بالاسفل رابط عام ينتهي بـ trycloudflare.com
echo  انسخي ذلك الرابط والصقيه في خانة "الرابط العام" داخل اللعبة
echo  لتحديث رمز QR ليصل اليه الطلاب من اي مكان.
echo ------------------------------------------------------------
echo.
start http://localhost:3000

if exist cloudflared.exe (
  cloudflared.exe tunnel --url http://localhost:3000
) else (
  echo [!] لم تتوفر الاداة - يمكنك اللعب على الشبكة المحلية فقط الان.
)
echo.
echo (اغلقي هذه النافذة لايقاف اللعبة)
pause
