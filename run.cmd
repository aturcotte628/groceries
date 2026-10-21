@echo off
rem Start Panier and open it in the browser.
cd /d "%~dp0"
start "" http://127.0.0.1:5055
python app.py %*
