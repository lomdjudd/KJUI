@echo off
cd /d "%~dp0"
where py >nul 2>nul && (set PY=py) || (set PY=python)
if not exist "%USERPROFILE%\.kjui\brain.db" %PY% -m kjui demo
%PY% -m kjui gui
pause
