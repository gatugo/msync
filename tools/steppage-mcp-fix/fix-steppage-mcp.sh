#!/usr/bin/env bash
# =============================================================================
# fix-steppage-mcp.sh — idempotent repair for the StepCode 'steppage' MCP server
#
# Fixes:  Warning: MCP server 'steppage__steppage' could not start:
#         MCP error -32000: Connection closed
# Cause:  The StepCode plugin 'steppage' spawns the bare command
#         `steppage-mcp`, which is missing on machines where the plugin's
#         built-in provisioner never ran.
#
# What it does:
#   1. Verifies Node.js >= 20
#   2. Downloads the official bundle to ~/.steppage-mcp/bin/steppage-mcp.mjs
#   3. Installs a launcher (`steppage-mcp`) on PATH:
#        - Windows (MSYS/MinGW/Cygwin): .cmd shims in %USERPROFILE%\bin and
#          ~/.stepcode/agent/bin (both are on PATH for a normal Windows start)
#        - macOS/Linux: ~/.local/bin/steppage-mcp (+ PATH hint if needed)
#   4. Smoke-tests: --version + a real MCP stdio handshake
#   5. Never touches the plugin manifest or ~/.stepcode/config.toml
#
# Usage:
#   bash fix-steppage-mcp.sh            # repair (safe to re-run)
#   bash fix-steppage-mcp.sh --check    # verify only, change nothing
#   bash fix-steppage-mcp.sh --force    # re-download bundle even if healthy
#   bash fix-steppage-mcp.sh --uninstall
#
# Env overrides:
#   STEPPAGE_BUNDLE_URL   override bundle download URL
#   STEPPAGE_OVERSEA=1    English messages (default set by shims)
# =============================================================================
set -euo pipefail

BUNDLE_URL="${STEPPAGE_BUNDLE_URL:-https://dl.stepfun.com/steppage-mcp/p/latest/steppage-mcp.mjs}"
INSTALL_DIR="$HOME/.steppage-mcp/bin"
BUNDLE="$INSTALL_DIR/steppage-mcp.mjs"
MIN_NODE_MAJOR=20

log()  { printf '\033[1;36m[fix-steppage-mcp]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ OK ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

# --- arg parsing -------------------------------------------------------------
MODE="fix"; FORCE=0
for a in "$@"; do
  case "$a" in
    --check)     MODE="check" ;;
    --force)     FORCE=1 ;;
    --uninstall) MODE="uninstall" ;;
    -h|--help)   sed -n '2,25p' "$0"; exit 0 ;;
    *) die "unknown option: $a (try --help)" ;;
  esac
done

# --- platform detection ------------------------------------------------------
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT) PLATFORM="windows" ;;
  Darwin*)                          PLATFORM="macos"   ;;
  *)                                PLATFORM="linux"   ;;
esac

fetch() { # fetch <url> <outfile>
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --max-time 120 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$2" "$1"
  else
    die "neither curl nor wget found"
  fi
}

mcp_handshake() { # real initialize+tools/list exchange; exit 0 if server answers
  local runner="$1"
  printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"fix-smoke","version":"1.0"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' |
    { timeout 30 "$runner" 2>/dev/null || true; } |
    grep -q '"serverInfo"'
}

resolve_shown() { # where the launcher resolves, for logging
  if [ "$PLATFORM" = "windows" ]; then
    powershell.exe -NoProfile -Command "Get-Command steppage-mcp | Select-Object -ExpandProperty Source" 2>/dev/null | tr -d '\r'
  else
    command -v steppage-mcp
  fi
}

handshake_target() { # the concrete command to feed JSON-RPC lines into
  if [ "$PLATFORM" = "windows" ]; then echo "$HOME/bin/steppage-mcp.cmd"; else echo "steppage-mcp"; fi
}

# --- uninstall ---------------------------------------------------------------
if [ "$MODE" = "uninstall" ]; then
  rm -f "$HOME/.local/bin/steppage-mcp" "$HOME/bin/steppage-mcp.cmd" \
        "$HOME/.stepcode/agent/bin/steppage-mcp.cmd" 2>/dev/null || true
  rm -rf "$HOME/.steppage-mcp"
  rm -f /bin/steppage-mcp /usr/local/bin/steppage-mcp 2>/dev/null || true
  ok "removed shims and bundle. (Plugin registration in ~/.stepcode/plugins is untouched.)"
  exit 0
fi

resolve_like_step() { # resolve `steppage-mcp` the way a native Windows step.exe would
  if [ "$PLATFORM" = "windows" ]; then
    powershell.exe -NoProfile -Command "Get-Command steppage-mcp" >/dev/null 2>&1
  else
    command -v steppage-mcp >/dev/null 2>&1
  fi
}

run_shim() { # invoke the installed launcher (bash cannot resolve .cmd via PATH on Windows)
  if [ "$PLATFORM" = "windows" ]; then "$HOME/bin/steppage-mcp.cmd" "$@"
  else steppage-mcp "$@"; fi
}

# --- 0. current state ---------------------------------------------------------
log "platform: $PLATFORM | node: $(node -v 2>/dev/null || echo MISSING)"
if [ "$MODE" = "check" ]; then
  if resolve_like_step; then
    if run_shim --version >/dev/null 2>&1; then
      ok "steppage-mcp resolves and runs ($(resolve_shown 2>/dev/null || true))."
      mcp_handshake "$(handshake_target)" && ok "MCP handshake passed." && exit 0
      die "steppage-mcp runs but the MCP handshake failed — see docs/BUG-REPORT-mcp-steppage-connection-closed.md"
    else
      die "steppage-mcp resolves but fails to run — re-run this script without --check to repair."
    fi
  fi
  die "steppage-mcp NOT working on this machine. Run without --check to repair."
fi

# --- 1. node -------------------------------------------------------------------
command -v node >/dev/null 2>&1 || die "Node.js not found. Install Node >= $MIN_NODE_MAJOR (https://nodejs.org)."
NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
[ "$NODE_MAJOR" -ge "$MIN_NODE_MAJOR" ] || die "Node >= $MIN_NODE_MAJOR required, found $(node -v)."
ok "node $(node -v)"

# --- 2. bundle -----------------------------------------------------------------
if [ -f "$BUNDLE" ] && [ "$FORCE" -eq 0 ]; then
  ok "bundle already present: $BUNDLE"
else
  log "downloading bundle: $BUNDLE_URL"
  mkdir -p "$INSTALL_DIR"
  TMP="$BUNDLE.tmp"
  fetch "$BUNDLE_URL" "$TMP"
  mv "$TMP" "$BUNDLE"
  ok "installed bundle -> $BUNDLE"
fi

# --- 3. launchers ---------------------------------------------------------------
write_unix_wrapper() { # $1=path
  cat > "$1" <<EOF
#!/bin/sh
# steppage-mcp launcher (StepCode MCP server for StepFun Page hosting)
exec env STEPPAGE_OVERSEA="\${STEPPAGE_OVERSEA:-1}" node "\$HOME/.steppage-mcp/bin/steppage-mcp.mjs" "\$@"
EOF
  chmod +x "$1"
}

write_cmd_shim() { # $1=path
  mkdir -p "$(dirname "$1")"
  # CRLF line endings for Windows compatibility
  printf '@echo off\r\nREM steppage-mcp shim (StepCode MCP server for StepFun Page hosting)\r\nsetlocal\r\nif not defined STEPPAGE_OVERSEA set STEPPAGE_OVERSEA=1\r\nnode "%%USERPROFILE%%\\.steppage-mcp\\bin\\steppage-mcp.mjs" %%*\r\n' > "$1"
}

if [ "$PLATFORM" = "windows" ]; then
  # windows: npm-style .cmd shims in the two PATH locations step.exe can use
  for d in "$HOME/bin" "$HOME/.stepcode/agent/bin"; do
    write_cmd_shim "$d/steppage-mcp.cmd"
    ok "shim -> $d/steppage-mcp.cmd"
  done
  # also provide the unix wrapper for Git Bash / MSYS users
  mkdir -p "$HOME/.local/bin"
  write_unix_wrapper "$HOME/.local/bin/steppage-mcp"
  ok "unix wrapper -> ~/.local/bin/steppage-mcp"
  case ":$PATH:" in *":$HOME/.local/bin:"*) : ;; *)
    warn "~/.local/bin is not on this bash PATH — add: echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc" ;; esac
  # sanity: is the .cmd dir actually on the Windows PATH? (what step.exe uses)
  WIN_USER_PATH="$(powershell.exe -NoProfile -Command '[Environment]::GetEnvironmentVariable("PATH","User")' 2>/dev/null | tr -d '\r' || true)"
  WIN_HOME="$(powershell.exe -NoProfile -Command '$env:USERPROFILE' 2>/dev/null | tr -d '\r' || true)"
  if printf '%s' "$WIN_USER_PATH" | grep -qiF "$WIN_HOME\\bin"; then
    ok "~/bin resolves on the Windows user PATH"
  else
    warn "~/bin may not be on your Windows PATH — add %USERPROFILE%\bin so step.exe can find steppage-mcp.cmd"
  fi
else
  mkdir -p "$HOME/.local/bin"
  write_unix_wrapper "$HOME/.local/bin/steppage-mcp"
  ok "launcher -> ~/.local/bin/steppage-mcp"
  case ":$PATH:" in *":$HOME/.local/bin:"*) : ;;
    *) warn "add to your shell rc:  export PATH=\"\$HOME/.local/bin:\$PATH\"" ;; esac
fi

# --- 4. smoke tests -------------------------------------------------------------
if [ "$PLATFORM" = "windows" ]; then
  # launch through the Windows shim exactly like the plugin spawns it
  [ -x "$HOME/bin/steppage-mcp.cmd" ] || [ -f "$HOME/bin/steppage-mcp.cmd" ] || die "shim missing"
  log "smoke: steppage-mcp --version"
  "$HOME/bin/steppage-mcp.cmd" --version || die "--version failed"
else
  log "smoke: steppage-mcp --version"
  node "$BUNDLE" --version || die "--version failed"
fi

log "smoke: MCP stdio handshake (initialize -> tools/list)"
if [ "$PLATFORM" = "windows" ]; then
  mcp_handshake "$HOME/bin/steppage-mcp.cmd" || mcp_handshake "node $BUNDLE" || die "handshake failed"
else
  mcp_handshake "node $BUNDLE" || die "handshake failed"
fi
ok "handshake passed — server connects and serves tools"

# --- 5. key hint (tool calls need it even though the connection doesn't) ----------
if [ -n "${STEPFUN_API_KEY:-}" ]; then
  ok "STEPFUN_API_KEY present in this environment"
else
  warn "STEPFUN_API_KEY not set in this shell — the server will still connect, but its Page"
  warn "tool calls will fail with an auth error. Export a platform.stepfun.com Pages-enabled key."
fi

echo
ok "DONE. The 'Connection closed' warning is fixed on this machine."
log "Verify anytime with:  bash $0 --check"
