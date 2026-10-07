@echo off
setlocal
set "SCRIPT_DIR=%~dp0"

where pythonw >nul 2>nul
if %ERRORLEVEL%==0 (
    start "" pythonw "%SCRIPT_DIR%burner.py"
) else (
    start "" python "%SCRIPT_DIR%burner.py"
)

endlocal
