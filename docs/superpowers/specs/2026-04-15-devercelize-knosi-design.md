# De-Vercelize Knosi Design

**Date:** 2026-04-15

**Goal:** Remove the remaining runtime dependency on Vercel services so `www.knosi.xyz` can run entirely from the Hetzner deployment without relying on Vercel-hosted analytics, blob storage, runtime cache, or Vercel-specific OTel helpers.

## Scope

This design covers four runtime areas that still depend on Vercel:

1. Image uploads via `@vercel/blob`
2. Web analytics and speed insights components
3. `@vercel/otel` instrumentation bootstrap
4. `VercelRuntimeCache` usage in the notes list cache

Out of scope for this phase:

- changing the Hetzner deployment topology
- moving the database away from Turso
- replacing Langfuse itself
- adding a new analytics vendor
- retroactively migrating existing image objects between storage vendors

## Recommended Approach

Introduce a small provider-neutral storage layer for image uploads, switch uploads to an S3-compatible backend, replace the Vercel runtime cache with the existing Redis cache abstraction, and remove the Vercel-only analytics and OTel bootstrap code.

This keeps the implementation focused on actual runtime dependencies instead of building a broad provider framework. The result is a self-hosted deployment that still supports image uploads and tracing, but no longer needs a live Vercel project to function.

## Design

### 1. Image Uploads

Current behavior:

- `POST /api/upload/image` accepts an authenticated image file
- validates mime type and file size
- uploads the file to Vercel Blob
- returns `{ url }`

New behavior:

- keep the request and response contract exactly the same
- route the upload through a new server-side storage module
- implement the first storage backend with an S3-compatible client

Storage interface:

- `uploadPublicObject({ key, body, contentType }): Promise<{ url: string }>`

S3 configuration:

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`
- optional `S3_FORCE_PATH_STYLE`

URL behavior:

- if `S3_PUBLIC_BASE_URL` is configured, returned URLs are built from it
- otherwise, the implementation should derive a URL from endpoint + bucket using the same host style the client writes to

Operational assumption:

- the bucket is configured to allow public reads for uploaded note images
- this phase does not attempt to migrate historical Vercel Blob assets; old URLs may continue to exist until the user decides to remove them

### 2. Analytics And Speed Insights

Current behavior:

- `src/app/layout.tsx` always renders `Analytics` and `SpeedInsights`

New behavior:

- remove both components entirely
- do not replace them in this phase

Reasoning:

- they provide no core product behavior
- removing them is the cleanest way to eliminate Vercel runtime coupling
- a future analytics choice can be added independently without blocking this migration

### 3. Instrumentation

Current behavior:

- `src/instrumentation.ts` uses `@vercel/otel` to register tracing with Langfuse

New behavior:

- remove the Vercel-specific helper
- register tracing with standard OpenTelemetry SDK primitives only when Langfuse-related environment variables are present
- otherwise no-op cleanly so the app starts without tracing configuration

Expected runtime behavior:

- deployments without Langfuse config remain healthy
- deployments with Langfuse config continue to emit traces without using `@vercel/otel`

### 4. Notes List Cache

Current behavior:

- `dashboardStatsCache` already uses `RedisCache`
- `notesListCache` uses `VercelRuntimeCache`
- invalidation uses tag expiry by user

New behavior:

- move `notesListCache` to `RedisCache`
- encode the user dimension directly into the Redis namespace so invalidation can still wipe all note list keys for a user

Recommended key strategy:

- cache name: `notes.list`
- raw key still includes folder, limit, and offset
- invalidation uses `clearByPrefix(userId)` or equivalent namespace-aware clear on Redis

Implementation note:

- if the current `RedisCache` is missing a user-scoped clear operation, extend it with a prefix-based invalidation helper instead of introducing a second cache abstraction
- once `notesListCache` is moved, delete `src/server/vercel-cache.ts`

## File Plan

Expected file changes:

- modify `src/app/api/upload/image/route.ts`
- add a storage module under `src/server/storage/`
- modify `src/app/layout.tsx`
- modify `src/instrumentation.ts`
- modify `src/server/cache/instances.ts`
- modify `src/server/redis-cache.ts`
- remove `src/server/vercel-cache.ts`
- update `package.json`
- update `.env.example`
- update `.env.production.example`
- update `README.md`
- append a changelog entry in `docs/changelog/`

## Error Handling

Uploads:

- keep existing `401`, `400`, `413`, and `415` behavior
- map storage failures to a `500` JSON error response without leaking provider internals

Tracing:

- tracing registration failures must not prevent app startup

Caching:

- Redis failures should continue to degrade to the loader path, matching current `RedisCache` behavior

## Verification Strategy

Minimum verification required:

1. `pnpm lint`
2. `pnpm build`
3. image upload route test with a real authenticated request path or the closest executable server-side check
4. cache verification covering notes list read-through and invalidation behavior
5. containerized deploy verification on Hetzner after environment variables are updated

Manual production checks after rollout:

1. upload an image in the note editor and confirm it renders
2. create or update a note, then verify notes list changes are visible without stale cache behavior
3. confirm `www.knosi.xyz/login` still returns `200`

## Risks And Follow-Up

- S3-compatible storage requires bucket provisioning and public-read configuration before rollout
- historical Vercel Blob URLs will not be migrated in this phase
- removing Vercel analytics means losing those dashboards immediately
- standard OTel wiring may need one iteration if Langfuse expects exporter-specific environment variables not currently documented in the repo

## Success Criteria

The phase is successful when:

- the deployed app no longer requires a Vercel project to serve production traffic
- image uploads succeed against an S3-compatible backend
- notes list caching works through Redis
- `package.json` no longer depends on the Vercel runtime packages used for blob, analytics, speed insights, runtime cache, and OTel bootstrap
