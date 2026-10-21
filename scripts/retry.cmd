@echo off
rem Panier - continue this week's crawls that stopped early (rate limit, bot check, PC off...).
rem Only stores whose crawl for the current flyer week is incomplete are touched, and each one
rem resumes at the next page it hadn't saved (checkpoints in data/prices.db). Safe to run anytime.
setlocal
if not defined PY set "PY=python"
set "DIR=%~dp0.."
set "PYTHONIOENCODING=utf-8"
cd /d "%DIR%"
"%PY%" crawl.py --retry >> "%DIR%\data\crawl-task.log" 2>&1
endlocal
