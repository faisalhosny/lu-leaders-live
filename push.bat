@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   رفع "اكاديمية القادة - النسخة الحية" الى GitHub
echo ============================================================
echo.
echo  الخطوة 1 (مرة واحدة): افتحي github.com وانشئي مستودعا جديدا فارغا
echo  (Public او Private) بدون اضافة README، ثم انسخي رابطه، مثال:
echo     https://github.com/USERNAME/lu-leaders-live.git
echo.
set /p REPO=الصقي رابط المستودع هنا ثم اضغطي Enter:
if "%REPO%"=="" ( echo لم يتم ادخال رابط. & pause & exit /b )

where git >nul 2>nul || ( echo Git غير مثبت. حمليه من https://git-scm.com ثم اعيدي المحاولة. & pause & exit /b )

if not exist .git ( git init & git branch -M main )
git add -A
git -c user.name="Iman Al-Husni" -c user.email="faisalhosny@hotmail.com" commit -m "LU Leaders Live" 2>nul
git remote remove origin 2>nul
git remote add origin %REPO%
git push -u origin main
echo.
echo تم الرفع. (قد يفتح المتصفح لتسجيل الدخول الى GitHub اول مرة)
echo التالي: render.com -> New -> Web Service -> اختاري هذا المستودع.
pause
