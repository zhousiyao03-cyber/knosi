# 2026-03-30 Focus tracker panel z-order fix

## task / goal

- 修复桌面端 tray panel 打开时可能被其他应用窗口盖住的问题。
- 让 menubar panel 在 macOS 上更接近系统状态栏弹层的前置层级，而不是普通 floating window。

## key changes

- 修改 `focus-tracker/src-tauri/src/lib.rs`
  - 新增 macOS 专用的 `panel_window_level()` helper。
  - 在显示主窗时，除了继续调用 `show / unminimize / set_focus`，还会显式重申 `always_on_top` 并把原生 `NSWindow` 提升到 `NSStatusWindowLevel`。
  - 新增单测，确保 panel 使用的层级高于默认 floating level。
- 修改 `focus-tracker/src-tauri/Cargo.toml`
  - 新增 macOS 条件依赖 `objc2-app-kit`，用于访问 `NSWindow` 和 `NSStatusWindowLevel`。

## files touched

- `focus-tracker/src-tauri/src/lib.rs`
- `focus-tracker/src-tauri/Cargo.toml`
- `docs/changelog/2026-03-30-focus-tracker-panel-z-order-fix.md`

## verification commands and results

- `cd /Users/bytedance/second-brain/focus-tracker/src-tauri && cargo test panel_window_level_uses_status_level_instead_of_floating_level`
  - ✅ 1 passed
- `cd /Users/bytedance/second-brain/focus-tracker/src-tauri && cargo test`
  - ✅ 35 passed
- `cd /Users/bytedance/second-brain/focus-tracker/src-tauri && cargo build`
  - ✅ build succeeded

## remaining risks or follow-up items

- 这次验证覆盖了 Rust 单测和构建，但还没有完成一次真实桌面手点验证来确认所有第三方应用前景下的显示效果。
- 当前实现是 macOS 专用层级提升；如果后续要在其他平台获得一致的 popover 体验，需要分别补平台特定策略。
