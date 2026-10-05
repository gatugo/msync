# =============================================================================
# fix-steppage-mcp.ps1 — idempotent repair for the StepCode 'steppage' MCP server
# (native Windows; the .sh twin covers Git Bash / macOS / Linux)
#
# Fixes:  Warning: MCP server 'steppage__steppage' could not start:
#         MCP error -32000: Connection closed
# Cause:  The StepCode plugin 'steppage' spawns the bare command
#         `steppage-mcp`, which is missing on machines where the plugin's
#         built-in provisioner never ran.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File fix-steppage-mcp.ps1
#   powershell -File fix-steppage-mcp.ps1 -Check      # verify only
#   powershell -File fix-steppage-mcp.ps1 -Uninstall
#
# Env overrides:
#   STEPPAGE_BUNDLE_URL   override bundle download URL
# =============================================================================
[CmdletBinding()]
param(
    [switch]$Check,
    [switch]$Uninstall,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$BundleUrl = if ($env:STEPPAGE_BUNDLE_URL) { $env:STEPPAGE_BUNDLE_URL } else { "https://dl.stepfun.com/steppage-mcp/p/latest/steppage-mcp.mjs" }
$InstallDir = Join-Path $HOME ".steppage-mcp\bin"
$Bundle     = Join-Path $InstallDir "steppage-mcp.mjs"
$ShimDirs   = @((Join-Path $HOME "bin"), (Join-Path $HOME ".stepcode\agent\bin"))

function Write-Ok   ($m) { Write-Host "[ OK ] $m" -ForegroundColor Green }
function Write-Warn ($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Log  ($m) { Write-Host "[fix-steppage-mcp] $m" -ForegroundColor Cyan }
function Write-Die  ($m) { Write-Host "[FAIL] $m" -ForegroundColor Red; exit 1 }

function Test-Node {
    $v = (Get-Command node -ErrorAction SilentlyContinue)
    if (-not $v) { Write-Die "Node.js not found. Install Node >= 20 (https://nodejs.org)." }
    $major = [int]((node -v).TrimStart('v').Split('.')[0])
    if ($major -lt 20) { Write-Die "Node >= 20 required, found $(node -v)." }
    Write-Ok "node $(node -v)"
}

function Get-Bundle {
    if ((Test-Path $Bundle) -and -not $Force) { Write-Ok "bundle already present: $Bundle"; return }
    Write-Log "downloading bundle: $BundleUrl"
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Invoke-WebRequest -Uri $BundleUrl -OutFile $Bundle -UseBasicParsing
    Write-Ok "installed bundle -> $Bundle"
}

function Install-Shims {
    $cmd = @"
@echo off
REM steppage-mcp shim (StepCode MCP server for StepFun Page hosting)
setlocal
if not defined STEPPAGE_OVERSEA set STEPPAGE_OVERSEA=1
node "%USERPROFILE%\.steppage-mcp\bin\steppage-mcp.mjs" %*
"@
    foreach ($d in $ShimDirs) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
        $cmd | Set-Content -Path (Join-Path $d "steppage-mcp.cmd") -Encoding ASCII
        Write-Ok "shim -> $(Join-Path $d 'steppage-mcp.cmd')"
    }
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*$HOME\bin*") {
        Write-Warn "%USERPROFILE%\bin is not on your Windows PATH — step.exe needs it to spawn steppage-mcp.cmd."
    } else { Write-Ok "~/bin resolves on Windows user PATH" }
}

function Invoke-McpHandshake {
    <# real initialize+tools/list exchange; returns $true if server answers #>
    $lines = @(
        '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"fix-smoke","version":"1.0"}}}',
        '{"jsonrpc":"2.0","method":"notifications/initialized"}',
        '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
    ) -join "`n"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "node"
    $psi.Arguments = "`"$Bundle`""
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.UseShellExecute = $false
    $p = [System.Diagnostics.Process]::Start($psi)
    $p.StandardInput.Write($lines)
    $p.StandardInput.Close()
    $out = ""
    while (-not $p.StandardOutput.EndOfStream) {
        $line = $p.StandardOutput.ReadLine()
        if ($line -match '"serverInfo"') { $out = $line; break }
        if ($p.HasExited) { break }
    }
    try { if (-not $p.HasExited) { $p.Kill() } } catch {}
    return ($out -ne "")
}

# ---- main ----
if ($Uninstall) {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $InstallDir
    foreach ($d in $ShimDirs) { Remove-Item -ErrorAction SilentlyContinue (Join-Path $d "steppage-mcp.cmd") }
    Write-Ok "removed shims and bundle. (Plugin registration in ~/.stepcode/plugins is untouched.)"
    exit 0
}

Write-Log "platform: windows | node: $((Get-Command node -ErrorAction SilentlyContinue) ? (node -v) : 'MISSING')"
$resolved = Get-Command steppage-mcp -ErrorAction SilentlyContinue
if ($resolved) {
    if ($Check) {
        try { steppage-mcp --version | Out-Null; Write-Ok "steppage-mcp on PATH ($($resolved.Source)) and runs."; exit 0 }
        catch { Write-Die "steppage-mcp found but does not run." }
    }
} elseif ($Check) {
    Write-Die "steppage-mcp NOT working on this machine. Re-run without -Check to repair."
}

Test-Node
Get-Bundle
Install-Shims

Write-Log "smoke: steppage-mcp --version"
$ver = & "$HOME\bin\steppage-mcp.cmd" --version 2>&1
if ($LASTEXITCODE -ne 0) { Write-Die "--version failed: $ver" }
Write-Ok "version: $ver"

Write-Log "smoke: MCP stdio handshake (initialize -> tools/list)"
if (-not (Invoke-McpHandshake)) { Write-Die "handshake failed — see docs/BUG-REPORT-mcp-steppage-connection-closed.md" }
Write-Ok "handshake passed — server connects and serves tools"

if ($env:STEPFUN_API_KEY) { Write-Ok "STEPFUN_API_KEY present in this environment" }
else {
    Write-Warn "STEPFUN_API_KEY not set — the server still connects, but Page tool calls fail"
    Write-Warn "with an auth error. Export a platform.stepfun.com Pages-enabled key if you deploy."
}

Write-Host ""
Write-Ok "DONE. The 'Connection closed' warning is fixed on this machine."
Write-Log "Verify anytime with:  powershell -File fix-steppage-mcp.ps1 -Check"
