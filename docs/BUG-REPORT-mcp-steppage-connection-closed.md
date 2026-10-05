# Bug Report — MCP server `steppage__steppage` failed to start ("Connection closed")

| Field | Value |
|---|---|
| Component | StepCode CLI (`step.exe`) plugin system / MCP layer |
| Symptom | `Warning: MCP server 'steppage__steppage' could not start: MCP error -32000: Connection closed` |
| Status | ✅ Fixed (server connects, 13 tools loaded). One unrelated account-scope issue remains — see §7 |
| Fixed on | 2026-09-28 |
| Reporter | user (session) |

---

## 1. Environment

| Item | Value |
|---|---|
| OS | Windows (Git Bash / MSYS shell; also relevant for native Windows) |
| StepCode CLI | `step.exe` v0.1.1 (Bun-compiled binary) |
| Node | v24.19.0 (npm 11.17.0) |
| Plugin involved | `steppage` ("StepPage") v1.0.0 — ships as a builtin marketplace plugin, preinstalled |
| Plugin manifest | `~/.stepcode/plugins/steppage/step.plugin.json` (+ marker `~/.stepcode/plugins/.stepcode-preinstalled`) |
| Plugin declares | `mcpServers.steppage.command = "steppage-mcp"`; `provision.requiresEnv = ["STEPFUN_API_KEY"]` |

## 2. Symptom

On every StepCode session start the preinstalled `steppage` plugin tried to launch its MCP
server. The spawned process never produced a working stdio MCP connection, so the MCP client
aborted with JSON-RPC error `-32000: Connection closed` and printed the warning. The StepPage
tools (`page_deploy`, `page_list_sites`, …) were unavailable to the model.

## 3. Root cause

**The MCP server executable `steppage-mcp` was missing from the machine.**

The plugin manifest spawns the bare command `steppage-mcp` from `PATH`, but the binary had
never been provisioned here:

1. `command -v steppage-mcp` → **not on PATH**.
2. Global npm had no `steppage-mcp` package (only `@anthropic-ai/claude-code`, `@openai/codex`); and the package is not published on npmjs under `steppage-mcp` / `@stepfun/steppage-mcp` (registry 404).
3. `~/.steppage-mcp/` (the bundle install directory) did not exist.
4. Neither PATH directory StepCode users get on Windows contained a shim: the Windows user PATH
   (`C:\Users\user\bin`, …) and the agent-session PATH (`C:\Users\user\.stepcode\agent\bin`,
   which holds agent-managed tools like `fd.exe`) both lacked `steppage-mcp`.

When the plugin spawns a command that does not exist, the child process dies immediately, the
stdio transport is closed, and the MCP client reports `-32000: Connection closed`. A missing
binary and a crashed server produce the same generic message — which is why the error text gave
no direct hint.

The plugin ships a built-in provisioning hook (`provision.installer = "steppageInstaller"`), and
`step.exe` embeds the installer URL
`STEPPAGE_INSTALLER_URL = "https://dl.stepfun.com/steppage-mcp/p/install.sh"` (overridable via
`STEPCODE_STEPPAGE_INSTALLER_URL`). That provisioning step simply never ran on this machine (the
plugin was preinstalled on 2026-09-27 but no installer was executed afterwards). A health check
confirmed the rest of the stack was fine: `step auth check --provider step` → `ready`, the model
auth profile was intact, and the built-in web-search MCP worked.

## 4. Why the official `install.sh` alone does *not* fix it on Windows

The upstream installer (`dl.stepfun.com/steppage-mcp/p/install.sh`):

- downloads the Node bundle to `~/.steppage-mcp/bin/steppage-mcp.mjs` (this machine satisfies its
  Node ≥ 20 requirement),
- writes a POSIX **sh wrapper** to `~/.local/bin/steppage-mcp`, and
- prints a "not on your PATH" note when `~/.local/bin` is absent from PATH.

On this Windows setup `~/.local/bin` is **not** on PATH (neither the Windows user PATH nor the
agent-session PATH includes it), and an extensionless `#!/bin/sh` script is not a spawnable
executable for Node's `child_process.spawn` on Windows. So running the raw installer would
install the bundle but the plugin's spawn would still fail — same warning.

## 5. Fix applied

Followed the official installation layout, adapted for Windows:

1. **Installed the bundle** (mirrors the official installer exactly):

    ```bash
    curl -fsSL https://dl.stepfun.com/steppage-mcp/p/latest/steppage-mcp.mjs \
      -o C:/Users/user/.steppage-mcp/bin/steppage-mcp.mjs     # version 1.0.0
    ```

2. **Created Windows-spawnable command shims** (`steppage-mcp.cmd`) in *both* PATH directories
   StepCode can use, so the plugin's `command: "steppage-mcp"` resolves regardless of how the
   CLI was launched (plain Windows shell vs. agent session):

   - `C:\Users\user\bin\steppage-mcp.cmd` — resolves for any normally-started `step.exe`
   - `C:\Users\user\.stepcode\agent\bin\steppage-mcp.cmd` — resolves for agent-managed sessions

   Each shim:

    ```bat
    @echo off
    REM steppage-mcp shim (MCP server for StepFun Page hosting)
    setlocal
    if not defined STEPPAGE_OVERSEA set STEPPAGE_OVERSEA=1
    node "%USERPROFILE%\.steppage-mcp\bin\steppage-mcp.mjs" %*
    ```

   (`STEPPAGE_OVERSEA=1` only selects English message strings; it does not affect endpoints.
   `STEPFUN_API_KEY` is a permanent Windows *user* environment variable, so it is inherited by
   the spawned server automatically — verified via `registry` query on `HKCU\Environment`.)

No changes were made to the plugin manifest or to `~/.stepcode/config.toml` — the preinstalled
plugin registration is untouched.

## 6. Verification (before → after)

| Test | Before | After |
|---|---|---|
| `steppage-mcp --version` (via shim) | not found | `1.0.0` |
| MCP stdio handshake: `initialize` → `notifications/initialized` → `tools/list` → `ping` | connection died; `-32000` | server responds, protocol `2024-11-05`, lists all tools, connection stays open |
| Real session probe (`step -p "say ok"`) | `Warning: MCP server 'steppage__steppage' could not start` | no warnings |
| Tool registration probe (`step -p "list tools starting with steppage__"`) | 0 tools | **13 tools** registered, e.g. `steppage__steppage__page_deploy`, `steppage__steppage__page_list_sites`, `steppage__steppage__page_list_versions`, `steppage__steppage__page_inspect`, `steppage__steppage__page_promote`, `steppage__steppage__page_get_site`, `steppage__steppage__page_update_site`, `steppage__steppage__page_delete_site`, … |

Sample handshake result (trimmed):

```json
{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},
 "serverInfo":{"name":"steppage","version":"0.0.1"}},"jsonrpc":"2.0","id":1}
{"result":{"tools":[{"name":"page_deploy", ...},{"name":"page_list_sites", ...},
 {"name":"page_list_versions", ...},{"name":"page_inspect", ...},{"name":"page_promote", ...}],
 "jsonrpc":"2.0","id":2}
```

## 7. Remaining (separate) issue — tool *calls* fail with key/auth error

The MCP connection itself is healthy now, but actual page tool calls return auth errors with the
currently-configured key:

| Endpoint tried | Result |
|---|---|
| `https://platform.stepfun.com` (default/domestic) | `[unauthenticated] API Key 无效或已失效，请在开放平台控制台获取 Pages 部署所用的 API Key` |
| `https://platform.stepfun.ai` (oversea) | `[unimplemented] HTTP 404` — the Page hosting API is not implemented on the oversea platform |

**Analysis.** The StepPage API exists only on the domestic open platform (`platform.stepfun.com`).
The key on this machine is an oversea/USA **Step Plan** key (auth profile `step_plan_oversea`,
same key as in `~/.claude/settings.json` and the app-7f3a9b2c `.env.local` conventions), which is
rejected by the domestic Pages API. A Step Plan (model-usage) key also appears to be a different
credential than a Pages-enabled platform key.

**To fully use the tools:** create an API key in the domestic StepFun open-platform console
(`https://platform.stepfun.com`) with the Pages product enabled, and provide it to the MCP server
(both shims already pass through the environment, so exporting `STEPFUN_API_KEY=<pages-key>`
before launching `step.exe` is sufficient). Until then the server connects and loads tools, but
each call will return the auth error — expected behavior, **not** a regression of this fix.

## 8. Regression notes

- If a future `step update` or reinstall wipes `C:\Users\user\.stepcode\agent\bin`, the shim must be recreated there. The `C:\Users\user\bin` shim is the durable copy.
- The underlying CLI bug worth reporting upstream: the preinstalled `steppage` plugin never
  auto-provisions its binary on Windows, and the raw installer's sh layout doesn't work there.
- Debugging side note: `step install <marketplace-plugin-dir>` temporarily registered the
  manifest-only plugin directory as a package, which then failed to load as a JS module
  (`Cannot find module ... from step.exe`). It was removed with
  `step remove <path>` and `~/.stepcode/config.toml` is back to `packages = []`. Do **not**
  `step install` marketplace directories again.

## 9. Security note (unrelated, found during triage)

`~/.claude/settings.json` stores a plaintext `ANTHROPIC_AUTH_TOKEN`. It is the **same key** as
`STEPFUN_API_KEY` (the one the MCP server now consumes). Recommend rotating this key soon, even
though it was pre-existing and unrelated to this bug.

## 10. References

- Official guide — Static Hosting CLI & MCP (official install of the MCP server, key requirements,
  tool reference): https://platform.stepfun.ai/docs/en/guides/developer/static-hosting-cli-mcp
  Confirms this fix's layout (bundle in `~/.steppage-mcp/bin/`, `steppage-mcp` wrapper,
  `STEPFUN_API_KEY` as the only auth field) and documents the companion `steppage` CLI
  (`curl -fsSL https://dl.stepfun.com/steppage-cli/p/install.sh | bash`).
- StepCode MCP configuration: https://platform.stepfun.ai/docs/en/step-code/customization/mcp
- StepCode repo: https://github.com/stepfun-ai/Step-Code
