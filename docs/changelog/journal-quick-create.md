# 2026-03-23 日记快捷创建

## task / goal

- 在笔记列表页新增“新建日记”入口。
- 点击后自动创建 `journal` 类型笔记，标题预填当天日期，并生成带 Todo List 的日记模版。

## key changes

- 新增 `src/lib/note-templates.ts`，集中生成日记标题和默认 Tiptap JSON 模版。
- 更新 `src/app/notes/page.tsx`，在“新建笔记”旁加入“新建日记”按钮，并在创建时写入标题、类型、内容和 `plainText`。
- 更新 `next.config.ts`，允许 `127.0.0.1` 请求开发态资源，修复 Next.js 16 下 Playwright 本地验证时客户端无法正常 hydrate 的问题。
- 更新 `e2e/phase2.spec.ts`，覆盖新建日记后的标题、模版和待办列表验证。
- 更新 `README.md` 功能说明，补充一键新建日记模版能力。

## files touched

- `src/lib/note-templates.ts`
- `src/app/notes/page.tsx`
- `next.config.ts`
- `e2e/phase2.spec.ts`
- `README.md`
- `docs/changelog/journal-quick-create.md`

## verification commands and results

- `pnpm lint` -> ✅ 通过。
- `pnpm exec playwright test e2e/phase2.spec.ts` -> ✅ `18 passed (11.2s)`，包含新增“创建新日记会带入当天标题和默认模版”用例。

## remaining risks or follow-up items

- Playwright 验证使用当前本地 SQLite 数据库，测试过程中会新增测试笔记；如需保持演示数据干净，后续可以补一套独立测试库或测试后清理策略。
