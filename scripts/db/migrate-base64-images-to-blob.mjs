/**
 * Migrate note-like rich-text image sources to S3-compatible object storage.
 *
 * Covers three cases:
 * - inlined `data:image/...;base64,...` sources
 * - legacy `*.blob.vercel-storage.com` sources
 * - legacy `*.vercel-storage.com` sources
 *
 * Tables:
 * - notes
 * - learning_notes
 * - os_project_notes
 *
 * Usage (dry run):
 *   node --env-file=.env.local scripts/db/migrate-base64-images-to-blob.mjs --dry
 *
 * Usage (apply):
 *   node --env-file=.env.local scripts/db/migrate-base64-images-to-blob.mjs
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
 *   TURSO_AUTH_TOKEN
 *   S3_PUBLIC_BASE_URL
 *   S3_FORCE_PATH_STYLE=true
 */
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const CONTENT_TABLES = ["notes", "learning_notes", "os_project_notes"];
const VERCEL_HOST_PATTERN = /(^|\.)(blob\.)?vercel-storage\.com$/i;
const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlash(value) {
  return value.replace(/^\/+/, "");
}

function buildPublicObjectUrl({
  key,
  publicBaseUrl,
  endpoint,
  bucket,
  forcePathStyle,
}) {
  const normalizedKey = trimLeadingSlash(key);

  if (publicBaseUrl) {
    return `${trimTrailingSlash(publicBaseUrl)}/${normalizedKey}`;
  }

  if (!endpoint || !bucket) {
    throw new Error("S3 public URL requires either S3_PUBLIC_BASE_URL or endpoint + bucket");
  }

  const normalizedEndpoint = trimTrailingSlash(endpoint);
  if (forcePathStyle) {
    return `${normalizedEndpoint}/${bucket}/${normalizedKey}`;
  }

  const endpointUrl = new URL(normalizedEndpoint);
  endpointUrl.hostname = `${bucket}.${endpointUrl.hostname}`;
  endpointUrl.pathname = `/${normalizedKey}`;
  return endpointUrl.toString();
}

function createStorageFromEnv(env) {
  const config = {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  };

  const required = ["endpoint", "region", "bucket", "accessKeyId", "secretAccessKey"];
  for (const field of required) {
    if (!config[field]) {
      throw new Error(`Missing ${field} for S3 migration storage`);
    }
  }

  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async uploadPublicObject({ key, body, contentType }) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );

      return {
        url: buildPublicObjectUrl({
          key,
          publicBaseUrl: config.publicBaseUrl,
          endpoint: config.endpoint,
          bucket: config.bucket,
          forcePathStyle: config.forcePathStyle,
        }),
      };
    },
  };
}

export function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return {
    kind: "data-url",
    mime: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

export function isLegacyVercelBlobUrl(value) {
  try {
    const url = new URL(value);
    return VERCEL_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

function guessExtension(url, mime) {
  if (mime && EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];

  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase();
    if (ext && ext.length <= 5) return ext;
  } catch {
    // ignore
  }

  return "bin";
}

async function fetchLegacyBlob(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch legacy blob: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  return {
    kind: "legacy-blob",
    mime: contentType,
    buffer: Buffer.from(arrayBuffer),
  };
}

async function resolveImageSource(src, fetchImpl) {
  const parsed = parseDataUrl(src);
  if (parsed) return parsed;
  if (isLegacyVercelBlobUrl(src)) return fetchLegacyBlob(src, fetchImpl);
  return null;
}

async function uploadImageSource({ src, table, recordId, uploadCounter, storage, fetchImpl }) {
  const resolved = await resolveImageSource(src, fetchImpl);
  if (!resolved) return null;

  const ext = guessExtension(src, resolved.mime);
  const key = `${table}/migrated/${recordId}-${Date.now()}-${uploadCounter}-${randomUUID()}.${ext}`;
  const { url } = await storage.uploadPublicObject({
    key,
    body: resolved.buffer,
    contentType: resolved.mime,
  });

  return url;
}

async function transformNode(node, ctx) {
  if (!node || typeof node !== "object") return node;

  if (node.type === "image" && typeof node.attrs?.src === "string") {
    const nextSrc = await maybeMigrateSrc(node.attrs.src, ctx);
    if (nextSrc) {
      return { ...node, attrs: { ...node.attrs, src: nextSrc } };
    }
  }

  if (node.type === "imageRowBlock" && typeof node.attrs?.images === "string") {
    try {
      const parsed = JSON.parse(node.attrs.images);
      if (Array.isArray(parsed)) {
        let changed = false;
        const nextImages = [];
        for (const entry of parsed) {
          if (entry && typeof entry.src === "string") {
          const nextSrc = await maybeMigrateSrc(entry.src, ctx);
            if (nextSrc) {
              changed = true;
              nextImages.push({ ...entry, src: nextSrc });
              continue;
            }
          }
          nextImages.push(entry);
        }

        if (changed) {
          return {
            ...node,
            attrs: { ...node.attrs, images: JSON.stringify(nextImages) },
          };
        }
      }
    } catch {
      // leave malformed rows as-is
    }
  }

  if (Array.isArray(node.content)) {
    let changed = false;
    const nextContent = [];
    for (const child of node.content) {
      const nextChild = await transformNode(child, ctx);
      if (nextChild !== child) changed = true;
      nextContent.push(nextChild);
    }
    if (changed) {
      return { ...node, content: nextContent };
    }
  }

  return node;
}

async function maybeMigrateSrc(src, ctx) {
  const matchesDataUrl = src.startsWith("data:image/");
  const matchesLegacyBlob = isLegacyVercelBlobUrl(src);
  if (!matchesDataUrl && !matchesLegacyBlob) {
    return null;
  }

  ctx.stats.found += 1;
  if (matchesDataUrl) ctx.stats.foundDataUrl += 1;
  if (matchesLegacyBlob) ctx.stats.foundLegacyBlob += 1;

  if (ctx.dryRun) return src;

  try {
    ctx.uploadCounter += 1;
    const migratedUrl = await uploadImageSource({
      src,
      table: ctx.table,
      recordId: ctx.recordId,
      uploadCounter: ctx.uploadCounter,
      storage: ctx.storage,
      fetchImpl: ctx.fetchImpl,
    });

    if (migratedUrl) {
      ctx.stats.uploaded += 1;
      return migratedUrl;
    }
  } catch (error) {
    ctx.stats.failed += 1;
    console.warn(`[warn] failed to migrate image for ${ctx.table}:${ctx.recordId}:`, error);
  }

  return null;
}

export async function migrateContentDocument(doc, ctx) {
  return transformNode(doc, ctx);
}

async function migrateTable(client, table, storage, dryRun) {
  const stats = {
    table,
    scanned: 0,
    mutated: 0,
    found: 0,
    foundDataUrl: 0,
    foundLegacyBlob: 0,
    uploaded: 0,
    failed: 0,
  };

  const { rows } = await client.execute(
    `SELECT id, content FROM ${table} WHERE content IS NOT NULL`
  );

  for (const row of rows) {
    stats.scanned += 1;
    const recordId = String(row.id);
    const raw = row.content;
    if (typeof raw !== "string") continue;
    if (!raw.includes("data:image/") && !raw.includes("vercel-storage.com")) continue;

    let doc;
    try {
      doc = JSON.parse(raw);
    } catch {
      console.warn(`[skip] ${table}:${recordId} has invalid JSON content`);
      continue;
    }

    const ctx = {
      table,
      recordId,
      storage,
      dryRun,
      uploadCounter: 0,
      stats,
    };

    const nextDoc = await migrateContentDocument(doc, ctx);
    if (nextDoc !== doc) {
      stats.mutated += 1;
      if (!dryRun) {
        await client.execute({
          sql: `UPDATE ${table} SET content = ? WHERE id = ?`,
          args: [JSON.stringify(nextDoc), recordId],
        });
        console.log(`[ok] ${table}:${recordId} updated`);
      }
    }
  }

  return stats;
}

export async function runMigration({ dryRun = false, env = process.env } = {}) {
  if (!env.TURSO_DATABASE_URL) {
    throw new Error("Missing TURSO_DATABASE_URL");
  }

  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const storage = createStorageFromEnv(env);

  const tableStats = [];
  for (const table of CONTENT_TABLES) {
    tableStats.push(await migrateTable(client, table, storage, dryRun));
  }

  await client.close();
  return tableStats;
}

function printSummary(tableStats, dryRun) {
  console.log(`Migration finished${dryRun ? " (DRY RUN)" : ""}.`);
  console.log("");
  for (const stats of tableStats) {
    console.log(`=== ${stats.table} ===`);
    console.log(`Scanned:          ${stats.scanned}`);
    console.log(`Mutated:          ${stats.mutated}`);
    console.log(`Images found:     ${stats.found}`);
    console.log(`  data URLs:      ${stats.foundDataUrl}`);
    console.log(`  legacy blobs:   ${stats.foundLegacyBlob}`);
    console.log(`Uploaded:         ${stats.uploaded}`);
    console.log(`Failed:           ${stats.failed}`);
    console.log("");
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  const tableStats = await runMigration({ dryRun });
  printSummary(tableStats, dryRun);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1] &&
  !process.execArgv.includes("--test")
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
