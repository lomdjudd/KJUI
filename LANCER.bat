@echo off
cd /d "%~dp0"
where py >nul 2>nul && (py KJUI.py & goto :fin)
where python >nul 2>nul && (python KJUI.py & goto :fin)
echo.
echo Python n'est pas installe. Je t'ouvre la page de telechargement.
echo Installe-le (coche "Add Python to PATH"), puis relance ce fichier.
start https://www.python.org/downloads/
:fin
pause
