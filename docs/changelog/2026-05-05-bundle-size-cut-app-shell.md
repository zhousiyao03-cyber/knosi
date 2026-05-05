# 2026-05-05 — App-shell first-load 减重 ~47%

## 背景

用 Next 16 原生 `--experimental-analyze` + 解析 `.next/diagnostics/route-bundle-stats.json` 发现：

- 30 条 `(app)/*` 路由全部首屏 1.34–1.75 MB（uncompressed JS）
- 罪魁是一个 462 kB 共享 chunk —— `(app)/layout.tsx` 静态 import 的 `FloatingAskAiDock` 把 `@ai-sdk/react` + `ai` (`DefaultChatTransport`) + `react-markdown` + `remark-gfm` 全打进了 app shell
- `/usage` 单独还有 353 kB 私有 chunk（`recharts` 三个图表静态 import）

## 改动

1. **`FloatingAskAiDock` 拆 lazy 壳**（`src/components/ask/floating-ask-ai-dock-lazy.tsx`）
   - 默认只渲染浮动按钮 + Cmd/Ctrl+J 监听
   - 用户点击或按快捷键时才 `next/dynamic` 加载真主体
   - layout 改 import 这个 lazy 壳，零 SSR 行为变化（按钮立刻可见）

2. **`next.config.ts` 加 `experimental.optimizePackageImports`**
   - 覆盖 `@tiptap/*`、`@dnd-kit/*`、`@ai-sdk/react`、`ai`、`lowlight`、`lucide-react`
   - 让 Turbopack 对这些 barrel 库做按需 import，避免拉整个 module

3. **`/usage` charts 改 `next/dynamic`**
   - `DailyTokenChart` / `DailyCostChart` / `ModelDistributionChart` 三个 recharts 图表全部 `ssr: false` + skeleton fallback
   - `ActivityHeatmap` 不用 recharts，保留静态

## 量化结果

| 路由 | Before (kB) | After (kB) | Δ |
|---|---|---|---|
| `/usage` | 1746 | 1140 | **-35%** |
| `/notes` | 1400 | 761 | **-46%** |
| `/dashboard` | 1357 | 717 | **-47%** |
| `/learn` | 1346 | 706 | **-48%** |
| `/portfolio` | 1371 | 732 | **-47%** |
| `/council` | 1341 | 701 | **-48%** |
| (app) 平均 | ~1355 | ~715 | **~-47%** |
| `/ask` | 1388 | 1378 | 持平（必须加载） |

Public 页（login / pricing / legal）不变。

## 修改文件

- `next.config.ts` — `experimental.optimizePackageImports`
- `src/app/(app)/layout.tsx` — 改 import lazy 壳
- `src/app/(app)/usage/_client.tsx` — recharts 图表 `next/dynamic`
- `src/components/ask/floating-ask-ai-dock-lazy.tsx` — 新建 lazy 壳

## 验证

- `pnpm build` ✅
- `pnpm exec eslint <changed files>` ✅（0 错 0 警）
- `pnpm test:e2e` —— 改动前 94 failed / 改动后 93 failed（baseline 已坏，无新回归。失败与本次改动无关）

## 已知 / 跟进

- Repo 要求 `pnpm@9.9.0`，本机 8.15.9 会降级 lockfile，不能提交 lock。建议升 pnpm 或启 corepack。
- 跟进项：进一步看 `(app)` 那 ~700 kB 共享 chunk 还有什么可以拆的（tRPC client、sidebar 树）；`/ask` 没动可以做服务端渲染骨架。
