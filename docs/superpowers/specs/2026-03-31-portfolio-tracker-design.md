# Portfolio Tracker — 设计文档

**日期**：2026-03-31
**状态**：已审批

---

## 概述

在 Second Brain 项目中新增投资组合追踪模块（`/portfolio`），支持美股和加密货币持仓管理、实时价格拉取、盈亏计算，以及每日 AI 新闻聚合。

---

## 1. 数据库 Schema

### `portfolio_holdings` — 持仓记录

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | `crypto.randomUUID()` |
| `userId` | text FK | 关联 `users.id`，cascade delete |
| `symbol` | text | 标的代码，如 `AAPL`、`BTC` |
| `name` | text | 显示名，如 `Apple Inc.`、`Bitcoin` |
| `assetType` | text enum | `stock` \| `crypto` |
| `quantity` | real | 持仓数量 |
| `costPrice` | real | 成本价（USD） |
| `createdAt` | integer timestamp | |
| `updatedAt` | integer timestamp | |

### `portfolio_news` — AI 聚合新闻缓存

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | `crypto.randomUUID()` |
| `userId` | text FK | 关联 `users.id`，cascade delete |
| `symbol` | text | 对应标的代码 |
| `summary` | text | GPT 生成的新闻摘要（Markdown） |
| `sentiment` | text enum | `bullish` \| `bearish` \| `neutral` |
| `generatedAt` | integer timestamp | 生成时间，用于防抖判断 |

**价格数据不持久化**，每次访问页面时实时拉取，存在 React state 中。

---

## 2. 数据流与 API 集成

### 价格数据（实时，不存库）

- **美股**：Yahoo Finance 非官方 API（`query1.finance.yahoo.com`），免费无需 key
- **加密货币**：CoinGecko 公开 API（`api.coingecko.com/api/v3/simple/price`），免费无需 key
- 通过 tRPC 服务端拉取，避免浏览器 CORS 限制
- 返回：当前价、日涨跌幅、结合成本价计算盈亏金额和百分比

### 新闻聚合（定时 + 按需）

- **Vercel Cron**：每天 00:00 UTC（北京时间 08:00）触发 `/api/cron/portfolio-news`
- 对每个用户的每个持仓标的，调用 `generateStructuredData` 让 GPT 搜索并总结最新新闻
- 结果写入 `portfolio_news` 表（覆盖同一用户同一标的的旧数据）
- **手动刷新**：页面提供"立即刷新"按钮，触发相同逻辑，防抖：同一标的 1 小时内不重复调用（检查 `generatedAt`）

### tRPC Router — `portfolio`

| Procedure | 说明 |
|-----------|------|
| `getHoldings` | 读取当前用户持仓列表 |
| `addHolding` | 新增持仓 |
| `updateHolding` | 修改持仓（数量、成本价） |
| `deleteHolding` | 删除持仓 |
| `getPrices` | 服务端批量拉取价格，返回当前价 + 盈亏 |
| `getNews` | 读取缓存新闻列表 |
| `refreshNews` | 手动触发 GPT 聚合（含防抖检查） |

---

## 3. 页面 UI 布局

**路由**：`/portfolio`，侧边栏新增入口

**桌面端（左右两栏）**：

```
┌─────────────────────┬──────────────────────────┐
│   持仓概览（左栏）    │   新闻资讯（右栏）         │
│                     │                          │
│  总资产：$12,340     │  [AAPL] ▼ 点击切换标的    │
│  总盈亏：+$1,200     │                          │
│  涨跌幅：+10.8%      │  情绪：看涨 📈            │
│                     │  生成时间：今天 08:00      │
│  ┌─────────────────┐│  [刷新]                   │
│  │ AAPL  $182.50  ││                          │
│  │ 10股  +5.2%    ││  摘要内容（Markdown）...   │
│  │ 盈亏 +$340     ││                          │
│  ├─────────────────┤│                          │
│  │ BTC   $67,000  ││                          │
│  │ 0.5个 -2.1%   ││                          │
│  │ 盈亏 -$200     ││                          │
│  └─────────────────┘│                          │
│  [+ 添加持仓]        │                          │
└─────────────────────┴──────────────────────────┘
```

**交互细节**：
- 左栏点击某个标的 → 右栏切换显示该标的新闻
- 添加持仓弹出 Modal：填写 symbol、名称、资产类型、数量、成本价
- 价格数据加载时显示骨架屏，失败时显示"-"不崩溃
- 移动端：两栏改为上下堆叠

---

## 4. 错误处理与边界情况

### 价格 API 失败
- 请求失败时，价格显示"-"，盈亏不计算，不阻塞页面渲染
- 失败原因记录在服务端 console，不暴露给用户

### GPT 新闻聚合失败
- Cron 失败时，保留上次成功的缓存数据，页面显示"上次更新：X 天前"
- 手动刷新失败时，Toast 提示错误，不清空已有数据

### 防抖保护
- 手动刷新：同一标的 1 小时内不重复调用 GPT（检查 `generatedAt`）
- Vercel Cron 每天只触发一次

### 空状态
- 无持仓：显示引导"添加你的第一个持仓标的开始追踪"
- 有持仓但无新闻缓存：显示"新闻将在今日 08:00 自动生成，或点击立即刷新"

### Vercel Cron 鉴权
- Cron endpoint 验证 `Authorization: Bearer ${CRON_SECRET}` header
- `CRON_SECRET` 存入 Vercel 环境变量，防止外部随意触发

---

## 5. 关键文件清单（预期）

```
src/
├── app/(app)/portfolio/
│   ├── page.tsx               # 页面入口（server component）
│   └── _client.tsx            # 客户端交互逻辑
├── app/api/cron/
│   └── portfolio-news/
│       └── route.ts           # Vercel Cron handler
├── server/
│   ├── db/schema.ts           # 新增两张表
│   └── routers/
│       └── portfolio.ts       # tRPC router
└── components/portfolio/
    ├── HoldingsList.tsx        # 左栏持仓列表
    ├── AddHoldingModal.tsx     # 添加持仓弹窗
    └── NewsPanel.tsx          # 右栏新闻面板
```

---

## 6. 依赖与环境变量

**无需新增 npm 包**（Yahoo Finance 和 CoinGecko 均为 HTTP API，直接 fetch）

**新增环境变量**：
- `CRON_SECRET` — Vercel Cron 鉴权密钥

**Vercel Cron 配置**（`vercel.json`）：
```json
{
  "crons": [{
    "path": "/api/cron/portfolio-news",
    "schedule": "0 0 * * *"
  }]
}
```
