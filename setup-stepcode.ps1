# Step Code Setup Script for mindsync Project
# Run this in PowerShell

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Step Code Setup for mindsync Project" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "[1/4] Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green

# Install Step Code
Write-Host ""
Write-Host "[2/4] Installing Step Code CLI..." -ForegroundColor Yellow
npm install -g @stepfun-ai/cli
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Step Code" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Step Code installed" -ForegroundColor Green

# Verify installation
Write-Host ""
Write-Host "[3/4] Verifying installation..." -ForegroundColor Yellow
$stepVersion = stepfun --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Step Code not found in PATH" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Step Code version: $stepVersion" -ForegroundColor Green

# Fix steppage MCP server (idempotent — see tools/steppage-mcp-fix/README.md)
Write-Host ""
Write-Host "[4/5] Checking StepCode MCP (steppage)..." -ForegroundColor Yellow
& "$PSScriptRoot\tools\steppage-mcp-fix\fix-steppage-mcp.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  steppage MCP fix reported an issue - see tools/steppage-mcp-fix/README.md" -ForegroundColor Yellow
} else {
    Write-Host "✅ Steppage MCP OK" -ForegroundColor Green
}

# Configuration summary
Write-Host ""
Write-Host "[5/5] Configuration files created:" -ForegroundColor Yellow
Write-Host "   - .vscode/tasks.json (VSCodium tasks)"
Write-Host "   - .stepcode.json (Step Code config)"
Write-Host "   - STEPCODE_SETUP.md (setup guide)"
Write-Host "   - setup-stepcode.bat / .ps1 (this script)"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "   1. Set your API key:" -ForegroundColor White
Write-Host "      `$env:STEP_API_KEY = 'your-key-here'" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Open VSCodium:" -ForegroundColor White
Write-Host "      code C:\Users\mela\.aiprojects_2\mindsync" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Start Step Code in terminal:" -ForegroundColor White
Write-Host "      stepfun" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Or use Ctrl+Shift+B → 'Step Code: Agent Mode'" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
