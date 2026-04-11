/**
 * 全局 cache 实例注册表。
 *
 * 所有 cache 实例集中在这里声明，方便：
 *   1. 写操作触发失效时，可以直接 import 对应的实例
 *   2. /api/metrics 端点遍历所有 cache 的大小
 *   3. 统一管理 TTL / max 等参数，避免分散在各个 router 里
 *
 * 命名约定：cache 名字用 domain.resource 的格式，和 tRPC procedure 的
 * path 保持一致，便于在日志里关联。
 */

import { NamedCache } from "../cache";

/**
 * dashboard.stats 的缓存。
 * key = userId
 * TTL = 30 秒（短到用户感知不到，长到能吸收 dashboard 频繁的 refetch）
 *
 * 使用 `any` 作为存储类型，让 `getOrLoad<T>(key, loader)` 从 loader
 * 的返回类型推断出 T，调用方无需手动标注。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dashboardStatsCache = new NamedCache<any>({
  name: "dashboard.stats",
  max: 1000,
  ttlMs: 30_000,
});

/**
 * 统一失效入口：当 notes/todos 发生写操作时，失效该用户的 dashboard 缓存。
 * 调用方不需要知道 dashboard.stats 的存在，只管"我改了 user X 的 notes"。
 */
export function invalidateDashboardForUser(userId: string) {
  dashboardStatsCache.invalidate(userId);
}
