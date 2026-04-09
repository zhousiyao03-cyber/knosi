import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readRepoFile(relativePath) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const CRITICAL_ROUTE_FILES = [
  "src/app/(app)/page.tsx",
  "src/app/(app)/notes/page.tsx",
  "src/app/(app)/notes/[id]/page.tsx",
  "src/app/(app)/ask/page.tsx",
];

const AUTH_BYPASS_AWARE_ENTRYPOINTS = [
  "src/app/(app)/layout.tsx",
  "src/app/(app)/page.tsx",
  "src/app/(app)/notes/page.tsx",
  "src/app/(app)/notes/[id]/page.tsx",
  "src/app/login/page.tsx",
  "src/app/register/page.tsx",
];

for (const filePath of CRITICAL_ROUTE_FILES) {
  test(`${filePath} stays a server entrypoint`, () => {
    const source = readRepoFile(filePath).trimStart();

    assert.equal(
      source.startsWith('"use client"') || source.startsWith("'use client'"),
      false,
      `${filePath} should stay a Server Component entrypoint so heavy client logic can be pushed below the route boundary`
    );
  });
}

test("Ask AI mode is resolved without a client-side config fetch", () => {
  const source = readRepoFile("src/app/(app)/ask/page.tsx");

  assert.doesNotMatch(
    source,
    /fetch\(["']\/api\/config["']/,
    "Ask AI should resolve daemon vs stream mode before the client shell mounts"
  );
});

for (const filePath of AUTH_BYPASS_AWARE_ENTRYPOINTS) {
  test(`${filePath} resolves auth through the shared request-session helper`, () => {
    const source = readRepoFile(filePath);

    assert.match(
      source,
      /getRequestSession/,
      `${filePath} should use the shared auth helper so AUTH_BYPASS works consistently in server entrypoints`
    );

    assert.doesNotMatch(
      source,
      /const session = await auth\(\)/,
      `${filePath} should avoid calling auth() directly so Playwright bypasses do not regress back to /login`
    );
  });
}
