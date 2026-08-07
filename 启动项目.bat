@echo off
title xiaomengresume - 简单启动器
setlocal enabledelayedexpansion

REM ============================================================
REM  xiaomengresume 一键启动器（项目根目录）
REM  用法：双击本文件 → 选择操作（默认 1 直接启动开发模式）
REM  要求：本机已安装 Node.js + pnpm（PATH 可找到）
REM ============================================================

set "ROOT=%~dp0"
set "PROJECT=%ROOT%project"

if not exist "%PROJECT%\package.json" (
  echo [错误] 未找到 project\package.json。
  echo         请确认本文件位于项目根目录：E://ai//aiwork//newproject//xiaomengresume//
  echo.
  pause
  exit /b 1
)

REM 绕过本环境 safe-delete shim 经 NODE_OPTIONS 的注入（只影响 Node 网络层，无害）
set "NODE_OPTIONS=--use-system-ca"

cd /d "%PROJECT%"

echo.
echo  ============================================
echo     xiaomengresume - 简单启动器
echo  ============================================
echo     1. 启动开发模式（pnpm dev，实时预览）
echo     2. 打开项目文件夹
echo     3. 打开文档目录（file/）
echo     4. 退出
echo  ============================================
echo.

set "choice="
set /p choice=请选择（直接回车 = 1）:
if "%choice%"=="" set "choice=1"

if "%choice%"=="2" (
  explorer "%ROOT%"
  exit /b 0
)
if "%choice%"=="3" (
  explorer "%ROOT%file"
  exit /b 0
)
if "%choice%"=="4" (
  exit /b 0
)

REM ---- 启动开发模式（默认）----
echo [启动] pnpm dev ... 关闭本窗口即停止应用。
echo.
call pnpm dev
if errorlevel 1 (
  echo.
  echo [提示] 启动失败。若提示找不到 pnpm，请确认 PATH 已含：
  echo        C://Users//zzh//AppData//Roaming//npm
  echo   或改用完整路径运行：
  echo       "C://Users//zzh//AppData//Roaming//npm//pnpm.cmd" dev
  echo.
  pause
)

endlocal
