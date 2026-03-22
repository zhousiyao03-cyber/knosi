# 2026-03-22 - Ask AI Usability Pass

Task / goal:
- 优化 `Ask AI` 模块的可用性，并参考 Notion AI 的 UI / 交互方式，解决中文自然提问几乎命不中知识库、聊天页体感差、以及来源注释污染正文等问题。

Key changes:
- 重写 `src/server/ai/rag.ts` 的检索逻辑：
  - 为中文问句增加 CJK 词段与 2-4 字切片匹配，兼容英文/连字符关键词。
  - 增加标题命中、内容命中、类型偏好（笔记/收藏）和最近更新时间加权。
  - 对“总结最近的笔记/收藏”这类高频问法增加 recent fallback，在缺少显式关键词时回退到最近内容，而不是直接退化成普通闲聊。
- 新增 `src/lib/ask-ai.ts`，统一处理 assistant 回复尾部的 `<!-- sources:... -->` 元数据：
  - 前端展示时会隐藏完整或流式中的来源标记。
  - 服务端在多轮对话时会先清理历史 assistant 消息中的来源标记，避免这些隐藏注释再次进入模型上下文。
- 优化 `src/app/ask/page.tsx` 的聊天体验：
  - 输入框支持中文输入法组合态，避免按 Enter 选词时误发送。
  - 消息区自动滚动到最新位置。
  - 增加快捷提问、停止生成、清空对话。
  - 错误提示改为解析 API 返回的真实错误文本，而不是直接显示 JSON 字符串。
  - 来源卡片切换为 Next.js `Link`，保持站内跳转体验一致。
- 参考 Notion AI 的工作台式交互，对 `src/app/ask/page.tsx` 做了第二轮重构：
  - 顶部新增显式来源范围切换：`全部来源 / 只看笔记 / 只看收藏 / 直接回答`。
  - 页面改为“左侧对话 + 右侧来源/操作面板”的双栏结构，回答来源单独展示，不再只依赖消息气泡下方的小标签。
  - 增加“按当前范围重答”和“切换思路重答”，允许同一问题快速在不同来源范围之间切换。
  - 增加“保存为笔记”，把当前问答直接沉淀为 `summary` 类型笔记，类似 Notion AI 的 `Save as page`。
- 补充 Ask AI 回归测试，覆盖来源注释隐藏场景，并同步更新现有 placeholder / 空状态断言。

Files touched:
- `src/server/ai/rag.ts`
- `src/lib/ask-ai.ts`
- `src/app/api/chat/route.ts`
- `src/app/ask/page.tsx`
- `e2e/phase4.spec.ts`
- `e2e/v1-core-paths.spec.ts`
- `docs/changelog/ask-ai-usability.md`

Verification commands and results:
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm lint` -> ✅ 通过。
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm build` -> ✅ 通过，Next.js 16 生产构建完成。
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm exec playwright test e2e/phase4.spec.ts --reporter=line` -> ✅ `10 passed`，包括来源隐藏、来源面板和“保存为笔记”闭环。
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm exec playwright test e2e/v1-core-paths.spec.ts --reporter=line` -> ✅ `7 passed`。
- `curl -sS --max-time 20 http://127.0.0.1:3000/api/chat ... "帮我总结一下为什么要离开"` -> ✅ 返回知识库回答，并附带 `为什么要离开` 笔记来源。
- `curl -sS --max-time 40 http://127.0.0.1:3000/api/chat ... "帮我总结一下最近的笔记"` -> ✅ 不再退化成普通闲聊，返回最近笔记总结并附带来源列表。
- `curl -sS --max-time 30 http://127.0.0.1:3000/api/chat ... "sourceScope":"notes"` -> ✅ 新来源范围参数生效，只从笔记中组织回答并返回笔记来源。
- `curl -sS --max-time 30 http://127.0.0.1:3000/api/chat ... "sourceScope":"direct"` -> ✅ 直接回答模式生效，不检索知识库，也不返回来源标记。

Remaining risks / follow-up:
- 当前检索仍是启发式匹配，不是真正的向量检索；当知识库继续变大时，相关性上限会受限。
- “最近内容”回退会优先暴露最新的真实数据质量；如果最近笔记本身是测试数据或空内容，AI 也会据此作答，后续可考虑在检索阶段过滤明显无效条目。
