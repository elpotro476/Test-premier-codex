@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Installez Python depuis python.org puis relancez ce fichier.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  if errorlevel 1 goto erreur
)
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto erreur
".venv\Scripts\python.exe" app.py --open-browser
if errorlevel 1 goto erreur
exit /b 0
:erreur
echo Le lancement a echoue. Consultez le message ci-dessus et le README.
pause
exit /b 1
