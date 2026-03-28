# 2026-03-23 - Notes Editor Hover Gutter Hit Area

## Task / Goal

修复笔记编辑器左侧悬浮块操作区的 hover 命中面过窄问题，避免鼠标从正文移向 `+ / ⋮⋮` 浮层时中途丢失 hover。

## Key Changes

- 在正文与左侧浮层之间新增一条 invisible hover bridge：
  - 视觉布局不变，不额外挤压正文
  - 鼠标从正文移向 `+ / ⋮⋮` 时，会先进入这条 bridge，而不是立刻触发 `mouseLeave`
  - 左侧浮层继续保持原有的视觉位置，不再为了 hit area 去改版式
- 抽出块操作区 gutter 常量，统一用于 hover 命中判断，避免后续再出现“视觉位置改了，但 hit area 还停留在旧值”的偏差
- 新增一条 e2e 回归用例，专门验证“从正文横向移动到左侧插入按钮时，浮层不会消失，且仍可点击打开插入菜单”

## Files Touched

- `docs/changelog/notes-editor-hover-gutter-hit-area.md`
- `e2e/phase2.spec.ts`
- `src/components/editor/tiptap-editor.tsx`

## Verification Commands And Results

- `cd /tmp/second-brain-hover-fix-99657 && PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" /Users/bytedance/.nvm/versions/node/v22.16.0/bin/node /Users/bytedance/.nvm/versions/node/v22.16.0/lib/node_modules/pnpm/bin/pnpm.cjs dev --webpack --port 3308`
  - 通过，在隔离副本中成功启动独立服务，避免与本机现有开发服务冲突
- `cd /tmp/second-brain-hover-fix-99657 && PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" /Users/bytedance/.nvm/versions/node/v22.16.0/bin/node /Users/bytedance/.nvm/versions/node/v22.16.0/lib/node_modules/pnpm/bin/pnpm.cjs exec playwright test e2e/phase2.spec.ts --grep '从正文移到左侧悬浮区时不会丢失 hover' --config=playwright.hover.config.ts`
  - 通过，`1 passed (7.6s)`
- `export PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" && pnpm lint`
  - 通过
  - 仅剩 `src/app/notes/[id]/page.tsx` 的 `<img>` warning
- `export PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" && pnpm build`
  - 通过
  - 保留 1 条已有的 Turbopack NFT tracing warning

## Remaining Risks / Follow-up

- 左侧块操作区的 hit area 现在更稳，但块排序仍然是菜单式“上移/下移”，还没有做成 Notion 那种直接拖拽。
- `page.tsx` 里封面依然使用原生 `<img>`，lint 会持续提示；如果后续要继续收口性能和 LCP，可以再评估是否迁到 `next/image`。
