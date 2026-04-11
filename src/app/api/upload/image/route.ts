import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

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

  const extension = EXTENSION_BY_MIME[file.type] ?? "bin";
  const pathname = `notes/${session.user.id}/${Date.now()}.${extension}`;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
