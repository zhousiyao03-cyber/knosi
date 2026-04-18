# 2026-04-18 · Suppress Windows console-window flash when the CLI daemon spawns Claude

## Task / Goal

On Windows, every AskAI request (inline editor popover, background daemon, daily Claude ping) briefly flashed a black console window on the desktop. The same pattern affected `knosi login` — just less noticeably because `cmd /c start` exits in milliseconds.

## Root Cause

`packages/cli/src/spawn-claude.mjs`, `packages/cli/src/daemon.mjs`, and `packages/cli/src/commands/auth-login.mjs` all call `child_process.spawn` to invoke either `claude` or `cmd`. On Windows:

1. `claude` resolves to `claude.cmd` (an npm-installed batch-file shim). Node spawns `.cmd` files via `cmd.exe /c <script>`.
2. `cmd.exe` is a console-subsystem executable. Windows allocates a console window for it unless explicitly told not to.
3. `detached: true` made it more visible: it adds `DETACHED_PROCESS`, so Windows also detaches from the parent console and tends to allocate a fresh one for the child.
4. `detached: true` without `windowsHide: true` therefore produces a visible flashing console window every time AskAI, daily ping, or login runs on Windows.

This is Windows-specific: POSIX has no console-window concept, so macOS and Linux never flashed.

## Key Changes

### CLI (`@knosi/cli` 0.2.2 → 0.2.3)

- `packages/cli/src/spawn-claude.mjs` — added `windowsHide: true` to both `spawn` calls (`spawnClaudeForChat` used by AskAI streaming, `spawnClaudeForStructured` used by inline structured generation).
- `packages/cli/src/daemon.mjs` — added `windowsHide: true` to the daily Claude ping spawn.
- `packages/cli/src/commands/auth-login.mjs` — added `windowsHide: true` to the `cmd /c start "" <url>` browser-opener spawn for consistency.
- `packages/cli/package.json` — bumped to `0.2.3`.

`windowsHide: true` maps to the Win32 `CREATE_NO_WINDOW` process-creation flag (Node.js `child_process` docs), which prevents Windows from allocating a console for the child process at all. `detached: true` is preserved on the chat/structured spawns because it serves an independent purpose (Ctrl-C signal isolation on the daemon's process group).

## Files Touched

- `packages/cli/src/spawn-claude.mjs`
- `packages/cli/src/daemon.mjs`
- `packages/cli/src/commands/auth-login.mjs`
- `packages/cli/package.json`
- `docs/changelog/2026-04-18-cli-windows-hide-console-flash.md`

## Verification

- `node --test packages/cli/src/commands/auth-login.test.mjs packages/cli/src/commands/save-ai-note.test.mjs packages/cli/src/daily-ping-scheduler.test.mjs packages/cli/src/daemon-notifications.test.mjs` → 10/10 pass.
- Spawned `cmd /c ping -n 1 127.0.0.1` on the real Win11 host with and without `windowsHide: true`; both children exited with code 0 in ~900ms, confirming the flag does not disrupt child execution. The visible "no flash on desktop" aspect is not programmatically observable — it relies on the documented `CREATE_NO_WINDOW` contract and will be confirmed on the next AskAI run after the user upgrades.
- macOS and Linux branches are unaffected: `windowsHide` is a no-op on POSIX platforms (it only gates a Windows `CreateProcessW` flag).

## Remaining Risks / Follow-up

- None on macOS/Linux — the option is ignored there.
- On Windows, if some future debugging session needs to see console output from the spawned `claude.cmd` process directly, the flag will hide it. Logs will still be captured through `stdio: [, "pipe", "pipe"]` and surfaced through the daemon's own log stream, so this is not a practical regression — just noting it in case someone later tries to attach a debugger to the child.
- No npm publish CI yet — a new `@knosi/cli@0.2.3` needs to be published manually (`npm publish` from `packages/cli/`). After publish, users upgrade with `npm install -g @knosi/cli@latest`.
