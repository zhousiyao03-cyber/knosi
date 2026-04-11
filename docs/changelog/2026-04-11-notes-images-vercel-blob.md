# 2026-04-11 — Notes 图片存储迁移到 Vercel Blob

## 目标

把 Notes 编辑器里插入的图片从 base64 data URL（直接塞进 Tiptap JSON / notes.content）换成上传到 Vercel Blob，笔记里只存公开 CDN URL。

## 关键变更

1. 新增 API route `src/app/api/upload/image/route.ts`
   - `POST /api/upload/image`，`multipart/form-data` 的 `file` 字段
   - 先走 `auth()`，未登录返回 401
   - mime 白名单（png / jpeg / webp / gif）、5MB 上限
   - 成功后 `put('notes/<userId>/<ts>.<ext>', file, { access: 'public', addRandomSuffix: true })`，返回 `{ url }`

2. `src/components/editor/editor-utils.ts`
   - 新增 `uploadImageFile(file)`，用 fetch 调上面的 API，401/413/415 映射到中文错误
   - 删除 `readFileAsDataUrl`（已无引用）

3. `src/components/editor/tiptap-editor.tsx`
   - paste、drop、image input change 三个入口全部改走 `uploadImageFile`
   - error handling 改成透传 upload 层抛出的具体错误

4. `src/components/editor/image-row-block.tsx`
   - 并排图片块内的 `addImages()` 也走 `uploadImageFile`
   - 删除该文件内重复定义的本地 `readFileAsDataUrl`

5. 新增历史数据迁移脚本 `scripts/db/migrate-base64-images-to-blob.mjs`
   - 扫 `notes.content`，递归找到 `image` 节点和 `imageRowBlock`
   - 把 `data:image/...;base64,...` 上传到 Blob 后替换 src
   - 支持 `--dry` 预览；写回 `UPDATE notes SET content = ?`

6. 依赖：`pnpm add @vercel/blob`

7. 环境变量：`BLOB_READ_WRITE_TOKEN` 已由 Vercel Blob store `second-brain-blob` 生成，并追加到本地 `.env.local`

## 涉及文件

- src/app/api/upload/image/route.ts（新）
- src/components/editor/editor-utils.ts
- src/components/editor/tiptap-editor.tsx
- src/components/editor/image-row-block.tsx
- scripts/db/migrate-base64-images-to-blob.mjs（新）
- e2e/editor.spec.ts（test 23 加 `page.route` mock）
- package.json / pnpm-lock.yaml

## 验证

- `pnpm build`：通过，`/api/upload/image` 出现在路由清单里
- `npx eslint` 本次改动的 5 个文件：0 errors，image-row-block.tsx 有一条 pre-existing 的 `<img>` warning（本次未新增）
- `pnpm test:e2e editor.spec.ts -g "粘贴图片"`：**失败**，但 `git stash` 到 main 上跑同一条用例同样失败
  - 具体原因：`createNote()` helper 里点击 "New note" 按钮后 URL 不跳转，停在 `/notes`
  - 这是 main 分支上的 pre-existing 回归，猜测是 `81bdda5 refactor(focus,portfolio): Notion-style minimal UI` / `7b53c11 refactor(home): Notion-style minimal UI` 改动 notes 页面时按钮结构变了
  - **不是本次迁移引入的问题**，但在这个回归修好之前没法用 E2E 验证 Notes 上传流程

## 还没做的事

1. **历史数据迁移脚本没跑**
   - 脚本写好了但还没在本地和生产跑
   - 需要先本地 `node --env-file=.env.local scripts/db/migrate-base64-images-to-blob.mjs --dry` 看一下体量
   - 再去掉 `--dry` 跑本地
   - 最后 `set -a && source .env.turso-prod.local && source .env.local && set +a && node scripts/db/migrate-base64-images-to-blob.mjs` 走生产 Turso
   - **schema 没变**，只是数据迁移；不需要 drizzle 生成新的 migration

2. **E2E 端到端**
   - `createNote` helper 的 pre-existing 回归修好后，需要真跑 test 23 确认 mock 路径走通
   - 如果未来想真连 Blob 测，需要 Playwright 带登录 storageState + 有 `BLOB_READ_WRITE_TOKEN`

3. **观察 dev server 人工验证**
   - 需要 `pnpm dev` → 登录 → 新建笔记 → 粘贴/拖拽一张图片 → 确认笔记 JSON 里存的是 `https://...blob.vercel-storage.com/...` 而非 `data:image/...`
   - 这一步必须手动做一次

## 风险和待办

- Vercel Blob 默认 `access: 'public'`，URL 一旦泄露就可以被任何人拿到 —— 这里存的是笔记图片，用户自己是 owner，可接受
- 5MB 上限和之前一致
- 上传不走 CDN 压缩/裁剪；如果后面要做 image optimization，再接 `next/image` 或 Vercel Image Optimization
- API route 没加 rate limit；当前只给登录用户用，单机自用场景下问题不大，但如果后面多用户要注意刷流量
