import test from "node:test";
import assert from "node:assert/strict";

import storageModule from "./object-storage.ts";

const { buildPublicObjectUrl, createS3ObjectStorage } = storageModule;

test("buildPublicObjectUrl prefers S3_PUBLIC_BASE_URL when present", () => {
  const url = buildPublicObjectUrl({
    key: "notes/user-1/example.png",
    publicBaseUrl: "https://assets.knosi.xyz",
  });

  assert.equal(url, "https://assets.knosi.xyz/notes/user-1/example.png");
});

test("buildPublicObjectUrl falls back to endpoint and bucket", () => {
  const url = buildPublicObjectUrl({
    key: "notes/user-1/example.png",
    endpoint: "https://s3.example.com",
    bucket: "knosi-assets",
    forcePathStyle: true,
  });

  assert.equal(
    url,
    "https://s3.example.com/knosi-assets/notes/user-1/example.png"
  );
});

test("createS3ObjectStorage rejects missing required config", () => {
  assert.throws(
    () =>
      createS3ObjectStorage({
        endpoint: "",
        region: "auto",
        bucket: "knosi-assets",
        accessKeyId: "abc",
        secretAccessKey: "def",
      }),
    /S3/
  );
});
