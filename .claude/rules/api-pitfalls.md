# 技术备忘（已踩坑记录）

以下是开发中遇到的与训练数据不一致的 API 差异，compact 后恢复时务必参考：

## Vercel AI SDK v6 (ai@^5 / @ai-sdk/react@^3)
- `ai/react` 模块不存在，React hooks 在独立包 `@ai-sdk/react` 中
- `useChat` 不再有 `api`/`input`/`handleInputChange`/`handleSubmit`/`isLoading` 属性
- `useChat` 现在需要 `transport` 参数：`new TextStreamChatTransport({ api: "/api/chat" })` from `ai`
- `useChat` 返回 `sendMessage({ text: string })`（不是 `content`），`status`（不是 `isLoading`）
- `streamText()` 的结果用 `.toTextStreamResponse()`（不是 `toDataStreamResponse`）
- `message.parts` 数组替代了 `message.content`，用 `part.type === "text"` 渲染

## React 19
- `useRef` 必须传初始值：`useRef<T>(undefined)`
- Next.js 15 页面 params 是 `Promise`，需要 `use(params)` 解包

## Tiptap
- SSR 环境必须设置 `immediatelyRender: false` 避免 hydration 错误

## E2E 测试
- 测试数据用 `uid()` 随机名避免冲突（共享 SQLite DB）
- `h1` 选择器用 `page.locator("main h1")` 避免 sidebar 标题冲突
- group hover 按钮需要先 hover 再点击，或用 `{ force: true }`

## 必须避免的常见错误
- 不要用 `ai/react`，用 `@ai-sdk/react`
- 不要用 `useChat` 的 `api`/`input`/`handleInputChange`/`handleSubmit`/`isLoading`，这些属性已移除
- 不要用 `useRef<T>()` 不传参，React 19 要求 `useRef<T>(undefined)`
- 不要用 `toDataStreamResponse()`，用 `toTextStreamResponse()`
- 不要忘记 Tiptap 的 `immediatelyRender: false`
- 不要提交 `data/*.db`、`.next/`、`node_modules/`
