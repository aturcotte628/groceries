@echo off
rem Panier - nightly catalogue crawl. Run it from Task Scheduler (see install_crawl_task.ps1).
rem crawl.py only crawls the stores whose new flyer/rebate week has started since their last
rem crawl (Giant Tiger: Wednesday, the others: Thursday), or that are 7+ days old.
setlocal
if not defined PY set "PY=python"
set "DIR=%~dp0.."
set "PYTHONIOENCODING=utf-8"
cd /d "%DIR%"
"%PY%" crawl.py >> "%DIR%\data\crawl-task.log" 2>&1
endlocal
