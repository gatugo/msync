@echo off
chcp 65001 >nul
echo ==========================================
echo Step Code Setup for mindsync Project
echo ==========================================
echo.

echo [1/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js first.
    pause
    exit /b 1
) else (
    echo ✅ Node.js found
)

echo.
echo [2/4] Installing Step Code CLI...
npm install -g @stepfun-ai/cli
if errorlevel 1 (
    echo ❌ Failed to install Step Code
    pause
    exit /b 1
) else (
    echo ✅ Step Code installed
)

echo.
echo [3/4] Verifying installation...
stepfun --version
if errorlevel 1 (
    echo ❌ Step Code not found in PATH
    pause
    exit /b 1
) else (
    echo ✅ Step Code is available
)

echo.
echo [4/5] Checking StepCode MCP (steppage)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\steppage-mcp-fix\fix-steppage-mcp.ps1"
if errorlevel 1 echo ⚠️  steppage MCP fix reported an issue - see tools\steppage-mcp-fix\README.md

echo.
echo [5/5] Configuration files created:
echo   - .vscode/tasks.json (VSCodium tasks)
echo   - .stepcode.json (Step Code config)
echo   - STEPCODE_SETUP.md (this guide)
echo.

echo ==========================================
echo Setup Complete!
echo ==========================================
echo.
echo Next steps:
echo   1. Set your API key:
echo      $env:STEP_API_KEY = "your-key-here"
echo.
echo   2. Open VSCodium:
echo      code C:\Users\mela\.aiprojects_2\mindsync
echo.
echo   3. Start Step Code in terminal:
echo      stepfun
echo.
echo   4. Or use Ctrl+Shift+B → "Step Code: Agent Mode"
echo.
pause
