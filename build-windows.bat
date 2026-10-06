@echo off
rem MdNote Windows 빌드 스크립트 - 더블클릭해서 실행하세요.
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo ===== MdNote 빌드 =====
echo.

echo [1/3] 최신 코드를 받는 중...
git pull
if errorlevel 1 goto :error

echo.
echo [2/3] 필요한 부품을 설치하는 중...
call npm install
if errorlevel 1 goto :error

echo.
echo [3/3] 설치 파일을 만드는 중... (처음에는 10분 이상 걸릴 수 있습니다)
call npm run tauri build
if errorlevel 1 goto :error

echo.
echo ===== 완료! =====
echo 설치 파일: src-tauri\target\release\bundle\nsis\MdNote_*_x64-setup.exe
echo 설치 파일이 있는 폴더를 엽니다.
start "" "%~dp0src-tauri\target\release\bundle\nsis"
echo.
pause
exit /b 0

:error
echo.
echo ===== 오류가 발생했습니다 =====
echo 위에 나온 error 부분을 복사해서 보내 주세요.
echo.
pause
exit /b 1
