# steppage MCP — permanent fix kit

Recurring kit for the StepCode MCP warning:

```
Warning: MCP server 'steppage__steppage' could not start: MCP error -32000: Connection closed
```

This happens on **every machine** where StepCode is installed (it is a machine-scoped bug,
not a project bug — see [Root cause](#2-root-cause)). Run the script **once per machine** and
it never comes back. Full post-mortem: [`docs/BUG-REPORT-mcp-steppage-connection-closed.md`](../../docs/BUG-REPORT-mcp-steppage-connection-closed.md).

## 1. Quick start

```bash
# Git Bash / macOS / Linux
bash tools/steppage-mcp-fix/fix-steppage-mcp.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File tools/steppage-mcp-fix/fix-steppage-mcp.ps1

# verify only (changes nothing, exits non-zero if broken)
bash tools/steppage-mcp-fix/fix-steppage-mcp.sh --check
powershell -File tools/steppage-mcp-fix/fix-steppage-mcp.ps1 -Check
```

The script is **idempotent** — safe to re-run anytime, on any machine, after any `step update`.

## 2. Root cause

StepCode ships a preinstalled plugin, `steppage` (StepFun Page hosting, manifest at
`~/.stepcode/plugins/steppage/step.plugin.json`). The plugin declares its MCP server as the
bare command:

```json
"mcpServers": { "steppage": { "command": "steppage-mcp" } }
```

That executable is provisioned by a built-in installer (`STEPPAGE_INSTALLER_URL =
https://dl.stepfun.com/steppage-mcp/p/install.sh`), which runs only during specific install
flows. On most machines it simply **never runs**, so the MCP server binary is missing. The
spawned process dies instantly → stdio transport closes → the MCP client reports the generic
`-32000: Connection closed`.

The official installer also fails to make it work on Windows: it drops a POSIX sh wrapper in
`~/.local/bin`, which is not on Windows PATH and is not spawnable by `spawn()` on Windows.

## 3. What the fix does

1. Verifies Node.js ≥ 20.
2. Downloads the **official** bundle to `~/.steppage-mcp/bin/steppage-mcp.mjs`
   (same location and URL the upstream installer uses).
3. Creates an npm-style launcher `steppage-mcp` on PATH:
   - Windows: `steppage-mcp.cmd` shims in `%USERPROFILE%\bin` **and** `~/.stepcode/agent/bin`
     (the two PATH locations a `step.exe` process can have), plus a Git Bash wrapper in
     `~/.local/bin`.
   - macOS/Linux: wrapper in `~/.local/bin` (+ PATH hint if missing).
4. Smoke-tests with a **real MCP handshake** (`initialize` → `tools/list`), not just
   `--version`.
5. **Never** touches the plugin manifest or `~/.stepcode/config.toml`.

Expected healthy output (13 tools load):

```
[ OK ] steppage-mcp resolves and runs (C:\Users\mela\bin\steppage-mcp.cmd)
[ OK ] MCP handshake passed.
```

Quick machine-level proof: `step -p "list tools starting with steppage__"` → 13 tools, no warning.

## 4. When to run it

- Right after `npm install -g @stepfun-ai/cli` on a new machine/profile (add it to your
  bootstrap/dotfiles or `setup-stepcode.bat` / `setup-stepcode.ps1` flow).
- Whenever the `Connection closed` warning appears.
- After wiping/reinstalling the StepCode CLI, or on ephemeral machines, dev containers, CI.

It is **not** per-project: `~/.stepcode`, the plugin registry and PATH are user-scoped. One run
per machine covers all projects.

## 5. Options & uninstall

| Command | Effect |
|---|---|
| `fix-steppage-mcp.sh` / `.ps1` | Repair (default; safe to re-run) |
| `--check` / `-Check` | Verify only — non-zero exit if broken |
| `--force` / `-Force` | Re-download the bundle even if healthy |
| `--uninstall` / `-Uninstall` | Remove shims + bundle (plugin registration untouched) |

Env overrides: `STEPPAGE_BUNDLE_URL` (bundle URL), `STEPPAGE_OVERSEA=1` (English messages,
set by the shims).

## 6. Known limitation — tool calls vs. keys

The fix makes the server **connect** (the reported bug). Actual Page tool calls need a key for
the **domestic** platform (`platform.stepfun.com`) with the Pages product enabled:

| Key used | Result |
|---|---|
| Domestic console key with Pages enabled | ✅ deploy/list/promote work |
| Step Plan model key (e.g. `step_plan_oversea` / USA keys) | `[unauthenticated] API Key 无效或已失效…` on the domestic API; `404 [unimplemented]` on `platform.stepfun.ai` |

A USA/oversea Step Plan key therefore cannot use the Page tools no matter what — the Page API
is domestic-only. The shims pass the environment through, so exporting a Pages-enabled
`STEPFUN_API_KEY` before launching `step.exe` is enough; no reconfiguration needed.

## 7. Troubleshooting

| Symptom | Meaning / action |
|---|---|
| `--check` fails | Run the script without `--check` |
| `Node >= 20 required` | Install Node 20+ |
| Download fails / hangs | Network/country egress — set `STEPPAGE_BUNDLE_URL` to a mirror |
| Handshake fails but `--version` works | Ensure `node` from a ≥20 install is first on PATH for the spawned process |
| Warning persists after fix | Restart the terminal so PATH refreshes; then run `--check` |
| `~/bin may not be on your Windows PATH` | Add `%USERPROFILE%\bin` to the user PATH and restart the terminal |
| Warning gone but tools error with auth | See §6 — key/region issue, unrelated to this fix |

## 8. Official documentation

- Static Hosting CLI & MCP (official install of the MCP server, key requirements, full tool
  reference): https://platform.stepfun.ai/docs/en/guides/developer/static-hosting-cli-mcp
  — validates this kit: bundle in `~/.steppage-mcp/bin/`, `steppage-mcp` wrapper,
  `STEPFUN_API_KEY` as the only auth field. Also documents the companion **CLI**
  (`curl -fsSL https://dl.stepfun.com/steppage-cli/p/install.sh | bash`) for CI/manual use.
- StepCode MCP configuration: https://platform.stepfun.ai/docs/en/step-code/customization/mcp

## 9. Files

```
tools/steppage-mcp-fix/
├── fix-steppage-mcp.sh      # POSIX: Git Bash / macOS / Linux (idempotent)
├── fix-steppage-mcp.ps1     # native Windows PowerShell (same behavior)
└── README.md                # this file
```
