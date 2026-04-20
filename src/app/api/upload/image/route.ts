import { randomUUID } from "node:crypto";
import { eq, sum } from "drizzle-orm";
import { NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { noteImages } from "@/server/db/schema";
import { getEntitlements } from "@/server/billing/entitlements";
import { assertQuota } from "@/server/billing/quota";
import { getObjectStorageFromEnv } from "@/server/storage/object-storage";

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "unsupported media type" },
      { status: 415 }
    );
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  // Storage quota — read-only sum over note_images rows for this user.
  // Authoritative source is S3 but we deliberately mirror usage into SQLite
  // so we don't incur a LIST/HEAD per upload.
  const entitlements = await getEntitlements(userId);
  const [usage] = await db
    .select({ bytes: sum(noteImages.sizeBytes) })
    .from(noteImages)
    .where(eq(noteImages.userId, userId));
  const currentMB = Math.ceil(Number(usage?.bytes ?? 0) / (1024 * 1024));
  const incomingMB = Math.ceil(file.size / (1024 * 1024));
  try {
    assertQuota(entitlements, "storageMB", currentMB, incomingMB);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: "quota exceeded", details: err.message },
        { status: 403 }
      );
    }
    throw err;
  }

  const extension = EXTENSION_BY_MIME[file.type] ?? "bin";
  const pathname = `notes/${userId}/${Date.now()}-${randomUUID()}.${extension}`;

  try {
    const storage = getObjectStorageFromEnv();
    const uploaded = await storage.uploadPublicObject({
      key: pathname,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    });

    // Record the upload for future quota checks. Failures here should not
    // break the user-facing upload — worst case we slightly undercount
    // until the next successful insert.
    await db
      .insert(noteImages)
      .values({
        id: randomUUID(),
        userId,
        storageKey: pathname,
        sizeBytes: file.size,
        contentType: file.type,
      })
      .catch(() => undefined);

    return NextResponse.json({ url: uploaded.url });
  } catch {
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
