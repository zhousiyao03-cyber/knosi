/**
 * 结构化日志封装（基于 pino）
 *
 * 使用方式：
 *   import { logger } from "@/server/logger";
 *   logger.info({ userId, action: "note.create" }, "note created");
 *   logger.error({ err, route: "/api/chat" }, "chat failed");
 *
 * 设计要点：
 * - 默认输出 JSON 到 stdout；dev 模式下使用 pino-pretty 不是必须的，
 *   Next.js 的终端对 JSON 也能读
 * - 所有日志事件必须有 `event` 字段作为类型标识（便于后续过滤 / 聚合）
 * - 请求相关的日志额外携带 `requestId`，串起一次请求的完整链路
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  base: {
    service: "second-brain",
    env: process.env.NODE_ENV ?? "development",
  },
  // timestamps in ISO8601 — easier to read than epoch ms
  timestamp: pino.stdTimeFunctions.isoTime,
  // 对错误对象做结构化序列化
  serializers: {
    err: pino.stdSerializers.err,
  },
});

/**
 * 为一次请求创建一个带 requestId 的子 logger。
 * 所有后续日志自动携带这个 id，方便在日志里串起整条链路。
 */
export function createRequestLogger(requestId: string, extras: Record<string, unknown> = {}) {
  return logger.child({ requestId, ...extras });
}

/** 生成一个短 requestId（8 字符 base36），仅用于本地/单进程追踪 */
export function newRequestId() {
  return Math.random().toString(36).slice(2, 10);
}
