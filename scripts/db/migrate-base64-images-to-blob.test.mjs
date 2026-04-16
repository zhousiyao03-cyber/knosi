import test from "node:test";
import assert from "node:assert/strict";
import {
  isLegacyVercelBlobUrl,
  migrateContentDocument,
  parseDataUrl,
} from "./migrate-base64-images-to-blob.mjs";

test("isLegacyVercelBlobUrl matches legacy blob hosts", () => {
  assert.equal(
    isLegacyVercelBlobUrl("https://krsis2ht20qxd6xq.public.blob.vercel-storage.com/notes/foo.png"),
    true
  );
  assert.equal(
    isLegacyVercelBlobUrl("https://foo.vercel-storage.com/bar.png"),
    true
  );
  assert.equal(isLegacyVercelBlobUrl("https://assets.knosi.xyz/notes/foo.png"), false);
});

test("parseDataUrl decodes image payload", () => {
  const parsed = parseDataUrl("data:image/png;base64,aGVsbG8=");
  assert.equal(parsed?.mime, "image/png");
  assert.equal(parsed?.buffer.toString("utf8"), "hello");
});

test("migrateContentDocument rewrites matching image nodes", async () => {
  const stats = {
    found: 0,
    foundDataUrl: 0,
    foundLegacyBlob: 0,
    uploaded: 0,
    failed: 0,
  };
  const nextDoc = await migrateContentDocument(
    {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "https://foo.blob.vercel-storage.com/old.png" },
        },
      ],
    },
    {
      table: "notes",
      recordId: "n1",
      dryRun: false,
      uploadCounter: 0,
      stats,
      fetchImpl: async () =>
        new Response(Buffer.from("hello"), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      storage: {
        async uploadPublicObject() {
          return { url: "https://assets.knosi.xyz/notes/new.png" };
        },
      },
    }
  );

  assert.equal(nextDoc.content[0].attrs.src, "https://assets.knosi.xyz/notes/new.png");
  assert.equal(stats.foundLegacyBlob, 1);
  assert.equal(stats.uploaded, 1);
});
