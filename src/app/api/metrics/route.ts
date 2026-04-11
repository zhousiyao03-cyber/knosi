/**
 * GET /api/metrics
 *
 * 返回当前进程内 tRPC procedure 调用的统计信息（总次数 / 错误率 / p50/p95/p99）。
 *
 * 这是一个纯本地观察工具 — 进程重启就清零，也不做认证之外的保护。
 * 仅对登录用户开放，避免 path 枚举信息泄漏。
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { snapshotMetrics } from "@/server/metrics";

export async function GET() {
  if (process.env.AUTH_BYPASS !== "true") {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.json(snapshotMetrics());
}
