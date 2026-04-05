# Analysis Daemon — 源码分析任务离线执行

## 背景

当前源码分析（Add & Analyse）和追问（askFollowup）都在 Next.js server 进程内通过 `child_process.spawn` 调用 Claude CLI 执行。部署到 Vercel serverless 环境后无法运行（超时、无 CLI、无持久文件系统）。

需要改造为 daemon 轮询模式：线上只负责入队，本地 daemon 负责执行并回传结果。

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 覆盖范围 | 分析 + 追问都走 daemon | 两者都依赖 clone 仓库 + spawn Claude，架构一致 |
| daemon 载体 | 合并到现有 `usage:daemon` | 减少用户需要管理的进程数，共享 SERVER_URL 配置 |
| 认证方式 | 无认证 | 个人项目，与 /api/usage 保持一致 |
| 并发控制 | 仅 daemon 端信号量（max 3） | server 端不限制，不需要防刷 |
| 任务存储 | 新建 analysis_tasks 表 | 与 osProjects 解耦，支持同一项目多次排队 |
| 轮询间隔 | 10 秒 | 个人项目分析任务不频繁，10 秒足够 |

## 架构

```
Web UI → tRPC mutation → INSERT analysis_tasks (status: "queued") → 立即返回
                                        ↓
本地 daemon (每 10s) → POST /api/analysis/claim → 认领任务
                                        ↓
                    clone 仓库 → spawn Claude CLI → 分析完成
                                        ↓
                    POST /api/analysis/complete → 写入 osProjectNotes + 更新状态
                                        ↓
前端轮询 analysisStatus → 检测到 completed → 刷新笔记列表
```

## 数据模型

### 新表 `analysis_tasks`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| project_id | TEXT FK → os_projects | 所属项目 |
| user_id | TEXT FK → users | 所属用户 |
| task_type | TEXT | "analysis" \| "followup" |
| status | TEXT | "queued" \| "running" \| "completed" \| "failed" |
| repo_url | TEXT | 仓库地址 |
| question | TEXT | followup 时的问题 |
| original_analysis | TEXT | followup 时的原始分析内容 |
| result | TEXT | daemon 回传的分析结果 |
| error | TEXT | 失败原因 |
| created_at | TIMESTAMP | 创建时间 |
| started_at | TIMESTAMP | daemon claim 时设置 |
| completed_at | TIMESTAMP | 完成时间 |

`osProjects.analysisStatus` 和 `analysisError` 保留，作为前端展示用的缓存状态，由 API 在任务状态变更时同步更新。

## API

### `POST /api/analysis/claim`（无认证）

Daemon 调用，原子认领最早一条 queued 任务。

响应：
- 有任务：`{ task: { id, projectId, userId, repoUrl, taskType, question?, originalAnalysis? } }`
- 无任务：`{ task: null }`

### `POST /api/analysis/complete`（无认证）

Daemon 回传结果。

入参：`{ taskId, result?, error? }`

行为：
- 有 result → 插入 osProjectNotes + 更新 analysis_tasks status="completed" + 更新 osProjects.analysisStatus="completed"
- 有 error → 更新 analysis_tasks status="failed" + 更新 osProjects.analysisStatus="failed"

## tRPC mutation 变更

### `startAnalysis`

简化为：创建 osProject（如新）→ 插入 analysis_tasks（type: "analysis", status: "queued"）→ 更新 osProjects.analysisStatus 为 "queued" → 返回 projectId

### `askFollowup`

简化为：查出原始分析内容 → 插入 analysis_tasks（type: "followup", status: "queued"）→ 返回

## Daemon 改造

在 `tools/usage-reporter/report.mjs` 中新增分析任务轮询循环：

- 每 10 秒 POST `/api/analysis/claim`
- 拿到任务后：clone 仓库 → spawn `claude` CLI → POST `/api/analysis/complete`
- 并发上限 3（进程内信号量）
- clone 逻辑和 prompt 从 `analyzer.ts` 搬过来

两个循环独立运行：
- 循环 1：每 5 分钟 usage 上报（现有）
- 循环 2：每 10 秒分析任务轮询（新增）

## 前端改动

最小改动：
- `analysisStatus` 值从 `pending | analyzing` 统一为 `queued | running`
- 前端轮询条件和 banner 文案对应更新
- 其余逻辑（轮询 → 完成 → 刷新笔记）不变

## 清理

- 删除 `analyzer.ts` 中的 `startAnalysis()`、`runAnalysis()`、`spawnClaude()`、`cloneRepo()`、`processPendingQueue()` 等 server 端执行逻辑
- `prompt.ts` 保留供参考，prompt 内容内联到 daemon 脚本中
- 删除 `analyzer.ts` 整个文件（所有逻辑迁移到 daemon）
