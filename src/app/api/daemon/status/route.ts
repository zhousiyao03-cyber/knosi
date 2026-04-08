import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { daemonHeartbeats } from "@/server/db/schema";

const ONLINE_THRESHOLD_MS = 90 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? "chat";

  const [row] = await db
    .select()
    .from(daemonHeartbeats)
    .where(eq(daemonHeartbeats.kind, kind));

  if (!row) {
    return NextResponse.json({
      online: false,
      lastSeenAt: null,
      secondsSince: null,
    });
  }

  const lastSeenMs = row.lastSeenAt.getTime();
  const ageMs = Date.now() - lastSeenMs;

  return NextResponse.json({
    online: ageMs < ONLINE_THRESHOLD_MS,
    lastSeenAt: row.lastSeenAt.toISOString(),
    secondsSince: Math.floor(ageMs / 1000),
  });
}
