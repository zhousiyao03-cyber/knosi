# De-Vercelize Knosi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining Vercel runtime dependencies by switching image uploads to an S3-compatible backend, replacing the notes list Vercel cache with Redis, and removing Vercel-only analytics and OTel helpers.

**Architecture:** Add one thin server-side storage adapter that returns a public URL for uploaded objects, keep the upload route contract unchanged, and wire it to an S3-compatible backend. Reuse the existing `RedisCache` for notes list caching by adding scoped invalidation, then delete the Vercel runtime cache wrapper and strip out Vercel-only packages from the app shell and instrumentation bootstrap.

**Tech Stack:** Next.js 16 App Router, React 19, Node 22, AWS SDK v3 S3 client, Redis, Langfuse OTel, pnpm, Docker Compose on Hetzner.

---

## File Structure

### Existing files to modify

- `package.json`
  - remove Vercel runtime packages and add AWS SDK packages for S3-compatible storage
- `src/app/api/upload/image/route.ts`
  - replace direct `@vercel/blob` writes with the new storage module
- `src/app/layout.tsx`
  - remove `Analytics` and `SpeedInsights`
- `src/instrumentation.ts`
  - replace `@vercel/otel` bootstrap with standard OpenTelemetry registration or a safe no-op
- `src/server/cache/instances.ts`
  - move `notesListCache` to `RedisCache`
- `src/server/redis-cache.ts`
  - add a scoped invalidation helper for user-specific notes list keys
- `src/server/routers/notes.ts`
  - switch the notes list read path off Vercel tag expiry semantics
- `.env.example`
  - document S3-compatible upload configuration
- `.env.production.example`
  - document the production S3-compatible upload configuration
- `README.md`
  - update self-hosting notes and remove Vercel-dependent runtime guidance

### New files to create

- `src/server/storage/object-storage.ts`
  - provider-neutral storage facade and S3-compatible implementation
- `src/server/storage/object-storage.test.mjs`
  - test URL generation and config validation for storage
- `src/server/cache/redis-cache.test.mjs`
  - test the new scoped invalidation behavior
- `docs/changelog/2026-04-15-devercelize-knosi.md`
  - implementation log for the Vercel removal work

### Files to remove

- `src/server/vercel-cache.ts`

---

### Task 1: Add S3-Compatible Object Storage For Image Uploads

**Files:**
- Create: `src/server/storage/object-storage.ts`
- Create: `src/server/storage/object-storage.test.mjs`
- Modify: `src/app/api/upload/image/route.ts`
- Modify: `.env.example`
- Modify: `.env.production.example`

- [ ] **Step 1: Write the failing storage tests**

Create `src/server/storage/object-storage.test.mjs` with:

```javascript
import test from "node:test";
import assert from "node:assert/strict";

import storageModule from "./object-storage.ts";

const {
  buildPublicObjectUrl,
  createS3ObjectStorage,
} = storageModule;

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

test("createS3ObjectStorage rejects missing required config", async () => {
  await assert.rejects(
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
```

- [ ] **Step 2: Run the storage test file and confirm it fails**

Run:

```bash
cd /Users/bytedance/second-brain/.worktrees/codex-hetzner-self-host
node --test src/server/storage/object-storage.test.mjs
```

Expected: FAIL with missing module or missing export errors for `object-storage.ts`.

- [ ] **Step 3: Implement the storage facade and S3-compatible uploader**

Create `src/server/storage/object-storage.ts` with a minimal shape like:

```typescript
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function buildPublicObjectUrl(...) { ... }

export function createS3ObjectStorage(config) {
  const client = new S3Client({ ... });
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

      return { url: buildPublicObjectUrl({ ...config, key }) };
    },
  };
}

export function getObjectStorageFromEnv() { ... }
```

- [ ] **Step 4: Re-run the storage tests and confirm they pass**

Run:

```bash
cd /Users/bytedance/second-brain/.worktrees/codex-hetzner-self-host
node --test src/server/storage/object-storage.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Switch the upload route to the new storage module**

Update `src/app/api/upload/image/route.ts` so the upload path still validates auth, mime type, and size, but replaces:

```typescript
const blob = await put(pathname, file, { ... });
return NextResponse.json({ url: blob.url });
```

with:

```typescript
const storage = getObjectStorageFromEnv();
const uploaded = await storage.uploadPublicObject({
  key: pathname,
  body: Buffer.from(await file.arrayBuffer()),
  contentType: file.type,
});

return NextResponse.json({ url: uploaded.url });
```

and maps provider errors to:

```typescript
return NextResponse.json({ error: "upload failed" }, { status: 500 });
```

- [ ] **Step 6: Document the S3 environment variables**

Update `.env.example` and `.env.production.example` to include:

```bash
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
# S3_FORCE_PATH_STYLE=true
```

---

### Task 2: Replace The Notes List Vercel Cache With Redis

**Files:**
- Create: `src/server/cache/redis-cache.test.mjs`
- Modify: `src/server/redis-cache.ts`
- Modify: `src/server/cache/instances.ts`
- Modify: `src/server/routers/notes.ts`
- Delete: `src/server/vercel-cache.ts`

- [ ] **Step 1: Write the failing Redis cache invalidation test**

Create `src/server/cache/redis-cache.test.mjs` with:

```javascript
import test from "node:test";
import assert from "node:assert/strict";

import redisCacheModule from "../redis-cache.ts";

const { RedisCache } = redisCacheModule;

test("RedisCache.invalidateWhere deletes every key under a raw-key prefix", async () => {
  const deletedKeys = [];
  const cache = new RedisCache({ name: "notes.list", ttlSeconds: 60 });

  cache.__setTestClientForUnitTest({
    scan: async (cursor, options) => {
      assert.equal(options.MATCH, "sb:notes.list:user-1:*");
      return {
        cursor: "0",
        keys: ["sb:notes.list:user-1:*:30:0", "sb:notes.list:user-1:folder-a:30:0"],
      };
    },
    del: async (keys) => {
      deletedKeys.push(...keys);
      return keys.length;
    },
  });

  await cache.invalidateWhere("user-1:");

  assert.deepEqual(deletedKeys, [
    "sb:notes.list:user-1:*:30:0",
    "sb:notes.list:user-1:folder-a:30:0",
  ]);
});
```

- [ ] **Step 2: Run the Redis cache test and confirm it fails**

Run:

```bash
cd /Users/bytedance/second-brain/.worktrees/codex-hetzner-self-host
node --test src/server/cache/redis-cache.test.mjs
```

Expected: FAIL because `invalidateWhere` and the unit-test hook do not exist yet.

- [ ] **Step 3: Extend `RedisCache` with scoped invalidation**

Update `src/server/redis-cache.ts` to add:

```typescript
async invalidateWhere(rawKeyPrefix: string) {
  const client = await this.getClient();
  if (!client) return;

  const pattern = `${this.key(rawKeyPrefix)}*`;
  ...
}
```

and add a small test-only injection point instead of mutating global Redis state.

- [ ] **Step 4: Re-run the Redis cache test and confirm it passes**

Run:

```bash
cd /Users/bytedance/second-brain/.worktrees/codex-hetzner-self-host
node --test src/server/cache/redis-cache.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Move `notesListCache` to Redis and remove Vercel cache semantics**

Update `src/server/cache/instances.ts` from:

```typescript
import { VercelRuntimeCache } from "../vercel-cache";
...
export const notesListCache = new VercelRuntimeCache<any>({ ... });
```

to:

```typescript
export const notesListCache = new RedisCache<any>({
  name: "notes.list",
  ttlSeconds: 60,
});
```

and change invalidation to:

```typescript
export function invalidateNotesListForUser(userId: string) {
  void notesListCache.invalidateWhere(`${userId}:`).catch(() => undefined);
}
```

- [ ] **Step 6: Remove the tag argument from the notes list read path**

Update `src/server/routers/notes.ts` from:

```typescript
return notesListCache.getOrLoad(cacheKey, async () => { ... }, [
  notesListTagForUser(ctx.userId),
]);
```

to:

```typescript
return notesListCache.getOrLoad(cacheKey, async () => {
  ...
});
```

and delete `notesListTagForUser` plus `src/server/vercel-cache.ts`.

---

### Task 3: Remove Vercel Analytics And OTel Runtime Helpers

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/instrumentation.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing instrumentation test**

Create `src/server/instrumentation.test.mjs` with:

```javascript
import test from "node:test";
import assert from "node:assert/strict";

import instrumentationModule from "../instrumentation.ts";

test("register returns early when Langfuse config is absent", async () => {
  await assert.doesNotReject(async () => {
    await instrumentationModule.register({
      env: {},
      installNodeTracerProvider: async () => {
        throw new Error("should not install without config");
      },
    });
  });
});
```

- [ ] **Step 2: Run the instrumentation test and confirm it fails**

Run:

```bash
cd /Users/bytedance/second-brain/.worktrees/codex-hetzner-self-host
node --test src/server/instrumentation.test.mjs
```

Expected: FAIL because the current `register()` shape is Vercel-specific.

- [ ] **Step 3: Remove Vercel app-shell analytics and replace instrumentation bootstrap**

Update `src/app/layout.tsx` to remove:

```tsx
<Analytics />
<SpeedInsights />
```

Then replace `src/instrumentation.ts` with a standard, env-gated bootstrap shape:

```typescript
export async function register(deps = defaultDeps) {
  if (!hasLangfuseConfig(deps.env)) return;
  await deps.installNodeTracerProvider();
}
```

where the default implementation uses standard OpenTelemetry + Langfuse packages and no `@vercel/otel`.

- [ ] **Step 4: Re-run the instrumentation test**

Run:

```bash
cd /Users/bytedance/second-brain/.worktrees/codex-hetzner-self-host
node --test src/server/instrumentation.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Remove the Vercel runtime dependencies from `package.json`**

Remove:

```json
"@vercel/analytics"
"@vercel/blob"
"@vercel/functions"
"@vercel/otel"
"@vercel/speed-insights"
```

Add the AWS SDK package(s) needed by Task 1.

Then run:

```bash
cd /Users/bytedance/second-brain/.worktrees/codex-hetzner-self-host
pnpm install
```

Expected: lockfile updates cleanly.

---

### Task 4: Update Docs And Verify The Full De-Vercelized Build

**Files:**
- Modify: `README.md`
- Create: `docs/changelog/2026-04-15-devercelize-knosi.md`

- [ ] **Step 1: Update self-hosting docs**

Revise `README.md` so it:

- documents S3-compatible image upload variables
- stops describing Vercel as a required runtime dependency
- updates any "hosted Vercel deployment" wording that is now misleading

- [ ] **Step 2: Write the implementation changelog entry**

Create `docs/changelog/2026-04-15-devercelize-knosi.md` with:

- date
- task / goal
- key changes
- files touched
- verification commands and results
- remaining risks or follow-up items

- [ ] **Step 3: Run local verification**

Run:

```bash
cd /Users/bytedance/second-brain/.worktrees/codex-hetzner-self-host
pnpm lint
pnpm build
node --test src/server/storage/object-storage.test.mjs
node --test src/server/cache/redis-cache.test.mjs
node --test src/server/instrumentation.test.mjs
```

Expected: all commands pass, with only pre-existing lint warnings if still present elsewhere.

- [ ] **Step 4: Sync to Hetzner and verify runtime health**

Run:

```bash
rsync -az --delete \
  --exclude-from=ops/hetzner/rsync-excludes.txt \
  -e "ssh -i $HOME/.ssh/knosi_github_actions" \
  /Users/bytedance/second-brain/.worktrees/codex-hetzner-self-host/ \
  root@195.201.117.172:/srv/knosi/

ssh -i "$HOME/.ssh/knosi_github_actions" root@195.201.117.172 \
  'APP_DIR=/srv/knosi /srv/knosi/ops/hetzner/deploy.sh'

curl -I -sS https://www.knosi.xyz/login
```

Expected: deploy succeeds and `https://www.knosi.xyz/login` returns `200`.
