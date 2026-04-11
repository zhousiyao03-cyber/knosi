/**
 * Vercel Runtime Cache 封装,接口对齐 RedisCache。
 *
 * ── 和 RedisCache 的关键差异 ──
 *
 * 1. **tag 失效**
 *    Runtime Cache 原生支持 `expireTag`,比 Redis SCAN+DEL 更顺。
 *    适合"某个 user 的某一类数据"这种批量失效场景。
 *
 * 2. **按区域隔离**
 *    每个 Vercel region 有独立缓存,跨 region 的命中率不如 Redis。
 *    对 Second Brain 这种单地域个人项目影响不大。
 *
 * 3. **本地 dev 有内存 fallback**
 *    `getCache()` 在 `next dev` 下会返回进程内存实现,不会抛错,
 *    E2E 测试可以直接跑,不需要额外 mock。
 *
 * 4. **不可用时降级**
 *    用 try/catch 包住所有操作,出错就走 loader,保证可用性。
 */

import { getCache } from "@vercel/functions";
import { logger } from "./logger";
import { recordCacheEvent } from "./metrics";

export type VercelCacheOptions = {
  /** 命名空间,同时作为 key 前缀 */
  name: string;
  /** 条目存活时间(秒)。默认 60 秒。 */
  ttlSeconds?: number;
};

export class VercelRuntimeCache<T> {
  readonly name: string;
  private readonly ttlSeconds: number;

  constructor({ name, ttlSeconds = 60 }: VercelCacheOptions) {
    this.name = name;
    this.ttlSeconds = ttlSeconds;
  }

  private key(rawKey: string) {
    return `sb:${this.name}:${rawKey}`;
  }

  /**
   * 读缓存,未命中时调用 loader 并回填。
   * tags 参数用于 `expireTag` 批量失效,通常传 [`${name}:${userId}`]。
   */
  async getOrLoad<R extends T>(
    rawKey: string,
    loader: () => Promise<R>,
    tags?: string[]
  ): Promise<R> {
    const fullKey = this.key(rawKey);

    try {
      const cache = getCache();
      const cached = (await cache.get(fullKey)) as R | undefined;
      if (cached !== undefined) {
        recordCacheEvent({ name: this.name, event: "hit" });
        logger.debug(
          { event: "cache.hit", cache: this.name, key: rawKey },
          "vercel cache hit"
        );
        return cached;
      }

      recordCacheEvent({ name: this.name, event: "miss" });
      logger.debug(
        { event: "cache.miss", cache: this.name, key: rawKey },
        "vercel cache miss"
      );

      const value = await loader();
      await cache.set(fullKey, value, {
        ttl: this.ttlSeconds,
        tags: tags ?? [this.name],
        name: this.name,
      });
      return value;
    } catch (err) {
      logger.error(
        { event: "cache.error", cache: this.name, key: rawKey, err },
        "vercel cache failed, falling back to loader"
      );
      return loader();
    }
  }

  /** 失效单个 key */
  async invalidate(rawKey: string) {
    try {
      await getCache().delete(this.key(rawKey));
      recordCacheEvent({ name: this.name, event: "invalidate" });
      logger.debug(
        { event: "cache.invalidate", cache: this.name, key: rawKey },
        "vercel cache invalidated"
      );
    } catch (err) {
      logger.error(
        { event: "cache.invalidate_error", cache: this.name, key: rawKey, err },
        "vercel cache invalidate failed"
      );
    }
  }

  /** 按 tag 批量失效 —— 推荐优先使用,比逐 key delete 便宜 */
  async expireTag(tag: string | string[]) {
    try {
      await getCache().expireTag(tag);
      recordCacheEvent({ name: this.name, event: "clear" });
      logger.debug(
        { event: "cache.expire_tag", cache: this.name, tag },
        "vercel cache tag expired"
      );
    } catch (err) {
      logger.error(
        { event: "cache.expire_tag_error", cache: this.name, tag, err },
        "vercel cache expireTag failed"
      );
    }
  }
}
