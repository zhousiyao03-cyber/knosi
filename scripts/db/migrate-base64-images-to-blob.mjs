/**
 * Migrate inlined base64 images in notes.content (Tiptap JSON) to
 * S3-compatible object storage.
 *
 * Scans every note, finds image nodes whose src is a `data:image/...;base64,...`
 * URL, uploads each object, then rewrites the src to the returned URL.
 * Also covers `imageRowBlock` nodes whose `images` attribute is a JSON-encoded
 * array of `{ src }` entries.
 *
 * Usage (local dev DB):
 *   node --env-file=.env.local scripts/db/migrate-base64-images-to-blob.mjs
 *
 * Usage (production Turso):
 *   set -a && source .env.turso-prod.local && source .env.local && set +a \
 *     && node scripts/db/migrate-base64-images-to-blob.mjs
 *
 * Required env:
 *   TURSO_DATABASE_URL
 *   S3_ENDPOINT
 *   S3_REGION
 *   S3_BUCKET
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *
 * Optional env:
 *   S3_PUBLIC_BASE_URL
 *   S3_FORCE_PATH_STYLE=true
 *
 * Flags:
 *   --dry   Only report what would change, do not upload or write.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const DRY_RUN = process.argv.includes("--dry");

const dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;
const s3Endpoint = process.env.S3_ENDPOINT;
const s3Region = process.env.S3_REGION;
const s3Bucket = process.env.S3_BUCKET;
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID;
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const s3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
const s3ForcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

if (!dbUrl) {
  console.error("Missing TURSO_DATABASE_URL");
  process.exit(1);
}
if (
  !s3Endpoint ||
  !s3Region ||
  !s3Bucket ||
  !s3AccessKeyId ||
  !s3SecretAccessKey
) {
  console.error("Missing one or more required S3_* variables");
  process.exit(1);
}

const client = createClient({ url: dbUrl, authToken: dbToken });
const storage = new S3Client({
  endpoint: s3Endpoint,
  region: s3Region,
  forcePathStyle: s3ForcePathStyle,
  credentials: {
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
  },
});

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  return { mime, buffer: Buffer.from(base64, "base64") };
}

function buildPublicObjectUrl(key) {
  const normalizedKey = key.replace(/^\/+/, "");

  if (s3PublicBaseUrl) {
    return `${s3PublicBaseUrl.replace(/\/+$/, "")}/${normalizedKey}`;
  }

  if (s3ForcePathStyle) {
    return `${s3Endpoint.replace(/\/+$/, "")}/${s3Bucket}/${normalizedKey}`;
  }

  const endpointUrl = new URL(s3Endpoint.replace(/\/+$/, ""));
  endpointUrl.hostname = `${s3Bucket}.${endpointUrl.hostname}`;
  endpointUrl.pathname = `/${normalizedKey}`;
  return endpointUrl.toString();
}

async function uploadBase64(dataUrl, noteId) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const ext = EXT_BY_MIME[parsed.mime] ?? "bin";
  const key = `notes/migrated/${noteId}-${Date.now()}-${randomUUID()}.${ext}`;

  await storage.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: parsed.buffer,
      ContentType: parsed.mime,
    })
  );

  return buildPublicObjectUrl(key);
}

async function transformNode(node, noteId, stats) {
  if (!node || typeof node !== "object") return node;

  if (node.type === "image" && typeof node.attrs?.src === "string") {
    if (node.attrs.src.startsWith("data:image/")) {
      stats.found += 1;
      if (DRY_RUN) return node;
      const url = await uploadBase64(node.attrs.src, noteId);
      if (url) {
        stats.uploaded += 1;
        return { ...node, attrs: { ...node.attrs, src: url } };
      }
      stats.failed += 1;
    }
  }

  if (node.type === "imageRowBlock" && typeof node.attrs?.images === "string") {
    try {
      const parsed = JSON.parse(node.attrs.images);
      if (Array.isArray(parsed)) {
        let changed = false;
        const next = [];
        for (const entry of parsed) {
          if (
            entry &&
            typeof entry.src === "string" &&
            entry.src.startsWith("data:image/")
          ) {
            stats.found += 1;
            if (DRY_RUN) {
              next.push(entry);
              continue;
            }
            const url = await uploadBase64(entry.src, noteId);
            if (url) {
              stats.uploaded += 1;
              changed = true;
              next.push({ ...entry, src: url });
            } else {
              stats.failed += 1;
              next.push(entry);
            }
          } else {
            next.push(entry);
          }
        }
        if (changed) {
          return {
            ...node,
            attrs: { ...node.attrs, images: JSON.stringify(next) },
          };
        }
      }
    } catch {
      // leave as-is
    }
  }

  if (Array.isArray(node.content)) {
    const newContent = [];
    let changed = false;
    for (const child of node.content) {
      const transformed = await transformNode(child, noteId, stats);
      if (transformed !== child) changed = true;
      newContent.push(transformed);
    }
    if (changed) {
      return { ...node, content: newContent };
    }
  }

  return node;
}

async function main() {
  console.log(`Migration starting${DRY_RUN ? " (DRY RUN)" : ""}...`);

  const { rows } = await client.execute(
    "SELECT id, content FROM notes WHERE content IS NOT NULL"
  );

  let totalNotes = 0;
  let mutatedNotes = 0;
  const stats = { found: 0, uploaded: 0, failed: 0 };

  for (const row of rows) {
    totalNotes += 1;
    const id = String(row.id);
    const raw = row.content;
    if (typeof raw !== "string" || !raw.includes("data:image/")) continue;

    let doc;
    try {
      doc = JSON.parse(raw);
    } catch {
      console.warn(`[skip] note ${id} has invalid JSON content`);
      continue;
    }

    const before = stats.uploaded;
    const nextDoc = await transformNode(doc, id, stats);
    if (nextDoc !== doc && stats.uploaded > before) {
      mutatedNotes += 1;
      if (!DRY_RUN) {
        await client.execute({
          sql: "UPDATE notes SET content = ? WHERE id = ?",
          args: [JSON.stringify(nextDoc), id],
        });
        console.log(`[ok] note ${id} updated`);
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Notes scanned:   ${totalNotes}`);
  console.log(`Notes mutated:   ${mutatedNotes}`);
  console.log(`Images found:    ${stats.found}`);
  console.log(`Images uploaded: ${stats.uploaded}`);
  console.log(`Images failed:   ${stats.failed}`);
  if (DRY_RUN) console.log("(dry run — no DB writes, no uploads)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
