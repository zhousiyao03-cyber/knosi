import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { daemonHeartbeats } from "@/server/db/schema";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    version?: string;
  };

  const kind = body.kind?.trim() || "chat";
  const version = body.version?.trim() || null;
  const now = new Date();

  const existing = await db
    .select({ kind: daemonHeartbeats.kind })
    .from(daemonHeartbeats)
    .where(eq(daemonHeartbeats.kind, kind));

  if (existing.length === 0) {
    await db.insert(daemonHeartbeats).values({ kind, lastSeenAt: now, version });
  } else {
    await db
      .update(daemonHeartbeats)
      .set({ lastSeenAt: now, version })
      .where(eq(daemonHeartbeats.kind, kind));
  }

  return NextResponse.json({ status: "ok" });
}
