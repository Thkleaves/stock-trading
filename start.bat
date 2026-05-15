@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================================
::  股票模拟交易系统 · 一键环境检查 & 启动脚本
::  启动顺序: backend → realtime → frontend
:: ============================================================

cd /d "%~dp0"

echo.
echo  =============================================
echo   股票模拟交易系统 - 环境检查 ^& 服务启动
echo  =============================================
echo.

:: ----------------------------------------------------------
::  1. 环境检查
:: ----------------------------------------------------------
echo  [1/5] 检查运行环境...
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [错误] 未检测到 Node.js，请先安装 Node.js ^(https://nodejs.org^)
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo    Node.js : %%v

:: 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [错误] 未检测到 npm
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm -v') do echo    npm     : v%%v

:: 检查 Python（可选）
set PYTHON_OK=0
where python >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo    Python  : %%v
    set PYTHON_OK=1
) else (
    where python3 >nul 2>&1
    if %errorlevel% equ 0 (
        for /f "tokens=*" %%v in ('python3 --version 2^>^&1') do echo    Python  : %%v
        set PYTHON_OK=1
    ) else (
        echo    Python  : [未检测到 - 数据生成脚本需要 Python]
    )
)

echo    OK 环境检查通过
echo.

:: ----------------------------------------------------------
::  2. 安装依赖（按需）
:: ----------------------------------------------------------
echo  [2/5] 检查并安装依赖...

set "PROJECTS=stock-trading-backend stock-trading-realtime stock-trading-frontend"

for %%p in (%PROJECTS%) do (
    if not exist "%%p\node_modules" (
        echo    %%p: node_modules 不存在，正在 npm install ...
        cd /d "%~dp0%%p"
        call npm install --silent
        if %errorlevel% neq 0 (
            echo    [错误] %%p npm install 失败
            cd /d "%~dp0"
            pause
            exit /b 1
        )
        echo    %%p: 依赖安装完成
        cd /d "%~dp0"
    ) else (
        echo    %%p: 依赖已就绪
    )
)
echo.

:: ----------------------------------------------------------
::  3. 启动后端服务 (port 3000)
:: ----------------------------------------------------------
echo  [3/5] 启动 stock-trading-backend ^(端口 3000^) ...
start "Backend :3000" cmd /c "cd /d "%~dp0stock-trading-backend" && echo 后端服务启动中... http://localhost:3000 && npm run dev"
echo    已在独立窗口启动，等待就绪...
:: 等待后端先起来
timeout /t 3 /nobreak >nul
echo.

:: ----------------------------------------------------------
::  4. 启动实时服务 (port 3001)
:: ----------------------------------------------------------
echo  [4/5] 启动 stock-trading-realtime ^(端口 3001^) ...
start "Realtime :3001" cmd /c "cd /d "%~dp0stock-trading-realtime" && echo 实时服务启动中... ws://localhost:3001 && npm run dev"
echo    已在独立窗口启动，等待就绪...
timeout /t 2 /nobreak >nul
echo.

:: ----------------------------------------------------------
::  5. 启动前端 (port 5173)
:: ----------------------------------------------------------
echo  [5/5] 启动 stock-trading-frontend ^(端口 5173^) ...
start "Frontend :5173" cmd /c "cd /d "%~dp0stock-trading-frontend" && echo 前端启动中... http://localhost:5173 && npm run dev"
echo    已在独立窗口启动
echo.

:: ----------------------------------------------------------
::  完成
:: ----------------------------------------------------------
echo  =============================================
echo   全部服务已启动！请稍候等待各窗口就绪。
echo  =============================================
echo.
echo    后端 API   : http://localhost:3000
echo    实时 WebSocket : ws://localhost:3001
echo    前端界面   : http://localhost:5173
echo.
echo    关闭本窗口不影响已启动的服务。
echo    各服务窗口可独立关闭。
echo  =============================================
echo.

timeout /t 5 /nobreak >nul
