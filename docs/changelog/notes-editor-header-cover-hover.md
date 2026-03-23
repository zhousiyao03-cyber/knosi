# 2026-03-23 - Notes Editor Header Cover Hover

## Task / Goal

继续收口笔记编辑页的 Notion 化细节，解决两类反馈：

- `Page Properties` 区太大，抢了标题区的视觉焦点
- 左侧悬浮块操作离正文太近，hover 时会压到文字

## Key Changes

- 把原来的大卡片式 `Page Properties` 改成更轻量的 metadata 行：
  - 保留类型切换和标签编辑
  - 去掉大标题、说明文案和大面积卡片容器
  - 位置调整到 title 上方，整体更接近 Notion 的页头节奏
- 将头部封面能力改成真正的 header 区：
  - 新增整行 header 容器
  - hover 时只展示一个 `插入图片 / 更换图片` 入口
  - 支持上传真实图片作为头图，并覆盖整个 header 区域
  - 已有封面时额外提供 `移除封面` 动作
  - 兼容之前的渐变 cover 数据，避免已有内容直接失效
- 把左侧悬浮 `+ / ⋮⋮` 胶囊继续向外让位，确保不会再压住正文首列文字
- 放宽 `notes.cover` 的后端校验与 schema 定义，让封面字段可以保存真实图片数据，而不是只接受预设枚举

## Files Touched

- `README.md`
- `docs/changelog/notes-editor-header-cover-hover.md`
- `e2e/phase2.spec.ts`
- `src/app/notes/[id]/page.tsx`
- `src/components/editor/tiptap-editor.tsx`
- `src/server/db/schema.ts`
- `src/server/routers/notes.ts`

## Verification Commands And Results

- `export PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" && pnpm lint`
  - 通过
  - 仅剩 `src/app/notes/[id]/page.tsx` 的 `<img>` warning，不影响运行
- `export PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" && pnpm build`
  - 通过
  - 保留 1 条已有的 Turbopack NFT tracing warning
- `PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" /Users/bytedance/.nvm/versions/node/v22.16.0/bin/node /Users/bytedance/.nvm/versions/node/v22.16.0/lib/node_modules/pnpm/bin/pnpm.cjs dev --webpack --port 3307`
  - 在隔离副本 `/tmp/second-brain-cover-verify` 中成功启动独立 Next.js 服务，避免与用户本地 `3000` 端口和 `.next/dev/lock` 冲突
- `PATH="/Users/bytedance/.nvm/versions/node/v22.16.0/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" /Users/bytedance/.nvm/versions/node/v22.16.0/bin/node - <<'NODE' ...`
  - 通过，基于 `@playwright/test` 在 `http://127.0.0.1:3307/notes` 实际完成 `新建笔记 -> 上传封面 -> 移除封面 -> 删除临时笔记`
  - 输出结果中 `uploadedCover: true`
  - 输出结果中 `removedCover: true`
  - 输出结果中 `deletedTempNote: true`
  - 额外生成 `/tmp/notes-cover-added.png` 和 `/tmp/notes-cover-removed.png`，已人工确认封面插入后占满 header、移除后回到空 header 状态

## Remaining Risks / Follow-up

- 当前 header 已支持插入 / 更换 / 移除图片，但仍然只有本地上传，没有 URL、图库或 reposition 等更完整的封面能力。
- 这次为了对齐产品反馈，把原来的 icon 入口从主界面拿掉了；如果后续仍然需要 icon，可考虑放回更轻的 title 附近操作，而不是回到大卡片属性区。
- 默认 Playwright `webServer` 在本机容易和现有 `next dev` / Node 版本打架；这次改用隔离副本 + 手动 Node 22 服务做验证，后续如果频繁遇到同样情况，可以补一套官方的复用本地服务配置。
