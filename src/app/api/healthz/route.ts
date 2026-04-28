import { NextResponse } from "next/server";

// Liveness/readiness probe target. Intentionally has no DB/Redis/external
// dependency: this endpoint only reflects whether the Node process is up
// and the HTTP server is accepting connections. A slow Turso query should
// not trigger kubelet to kill the pod.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
