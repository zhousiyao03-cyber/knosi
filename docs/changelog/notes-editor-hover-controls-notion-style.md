# 2026-03-23 - Notes Editor Hover Controls Notion Style

## Task / Goal

把笔记编辑器左侧悬浮块操作区收成更接近 Notion 的样式，去掉外层胶囊、边框和阴影，同时修正图标与正文行的视觉居中。

## Key Changes

- 将左侧悬浮块操作区改为两枚裸图标：
  - 去掉外层白底胶囊容器
  - 去掉按钮边框和默认背景
  - 保留很轻的 hover 背景，避免完全失去可点击反馈
- 重新定义悬浮控件尺寸和偏移：
  - 按新的 `24px` 控件尺寸重算垂直居中
  - 调整左侧偏移量，让 `+` 和块菜单更贴近 Notion 的相对位置
- 保持前一轮 invisible hover bridge 逻辑不变，确保改完样式后仍然可以稳定把鼠标从正文移到左侧控件

## Files Touched

- `docs/changelog/notes-editor-hover-controls-notion-style.md`
- `src/components/editor/tiptap-editor.tsx`

## Verification Commands And Results

- `cd /tmp/second-brain-hover-fix-99657 && PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" /Users/bytedance/.nvm/versions/node/v22.16.0/bin/node /Users/bytedance/.nvm/versions/node/v22.16.0/lib/node_modules/pnpm/bin/pnpm.cjs exec playwright test e2e/phase2.spec.ts --grep '从正文移到左侧悬浮区时不会丢失 hover' --config=playwright.hover.config.ts`
  - 通过，`1 passed (7.1s)`
- `cd /tmp/second-brain-hover-fix-99657 && PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" /Users/bytedance/.nvm/versions/node/v22.16.0/bin/node - <<'NODE' ...`
  - 通过，实际打开 `http://127.0.0.1:3308/notes` 创建临时笔记并 hover 首个正文块
  - 输出截图 `/tmp/notes-hover-controls-notion-style.png`
  - 已人工确认左侧控件为无边框裸图标样式
- `export PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" && pnpm lint`
  - 通过
  - 仅剩 `src/app/notes/[id]/page.tsx` 的 `<img>` warning
- `export PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" && pnpm build`
  - 通过
  - 保留 1 条已有的 Turbopack NFT tracing warning

## Remaining Risks / Follow-up

- 这次只收了视觉样式和居中感，块排序本身仍然是菜单式交互，不是 Notion 的直接拖拽。
- 如果后续还想继续贴近 Notion，下一步可以再微调图标与正文之间的水平距离，以及不同 block 高度下的对齐策略。
