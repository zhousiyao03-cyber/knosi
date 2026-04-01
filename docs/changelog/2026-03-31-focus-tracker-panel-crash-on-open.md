# 2026-03-31 Focus Tracker Panel Crash On Open

## date

- 2026-03-31

## task / goal

- 修复桌面端 `focus-tracker` 打包后点击菜单栏 icon 打开 panel 就闪退的问题。

## key changes

- 回退了 `focus-tracker/src-tauri/src/lib.rs` 中那组直接操作 macOS `NSWindow` 的 tray panel z-order 提升逻辑。
  - 移除了 `set_visible_on_all_workspaces(true)`、原生 `NSWindow` `setCollectionBehavior(...)`、`setLevel(...)`、`orderFrontRegardless()` 这条 unsafe 路径。
  - `show_main_window()` 恢复为稳定的 `show / unminimize / set_focus` 组合。
- 移除了 `focus-tracker/src-tauri/Cargo.toml` 中为该实验引入的 `objc2-app-kit` 条件依赖。

## files touched

- `focus-tracker/src-tauri/src/lib.rs`
- `focus-tracker/src-tauri/Cargo.toml`
- `focus-tracker/src-tauri/Cargo.lock`
- `docs/changelog/2026-03-31-focus-tracker-panel-crash-on-open.md`

## verification commands and results

- `cd /Users/bytedance/second-brain/focus-tracker/src-tauri && cargo test`
  - ✅ 34 passed
- `cd /Users/bytedance/second-brain/focus-tracker && pnpm tauri build`
  - ✅ produced `.app` and `.dmg`
- `cd /Users/bytedance/second-brain/focus-tracker/src-tauri/target/release && FOCUS_TRACKER_START_VISIBLE=true ./focus-tracker`
  - 修复前：立即 abort，报 `panic in a function that cannot unwind` / `Rust cannot catch foreign exceptions`
  - 修复后：进程持续存活，`ps -ax | rg '[f]ocus-tracker'` 能看到运行中的 `./focus-tracker`

## remaining risks or follow-up items

- 这次直接撤掉了高风险的原生窗口层级提升逻辑，所以 panel 可能会重新回到“偶尔被其他窗口盖住”的旧行为。
- 如果后续还要做 macOS menubar popover 的层级优化，需要先找到不抛 Objective-C exception 的安全实现，再重新引入。
