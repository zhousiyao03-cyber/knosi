import path from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { users } from "@/server/db/schema/auth";
import { aiProviders, aiRoleAssignments } from "@/server/db/schema/ai-providers";
import { TRANSFORMERS_DEFAULT_MODEL } from "./presets";
import { ensureDefaultEmbeddingProvider } from "./seed";

const USER = "seed-test-user";

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
  await db
    .insert(users)
    .values({ id: USER, email: "seed@test.local" })
    .onConflictDoNothing();
});

beforeEach(async () => {
  await db.delete(aiRoleAssignments).where(eq(aiRoleAssignments.userId, USER));
  await db.delete(aiProviders).where(eq(aiProviders.userId, USER));
});

describe("ensureDefaultEmbeddingProvider", () => {
  it("seeds a transformers provider + embedding assignment when none exists", async () => {
    await ensureDefaultEmbeddingProvider(USER);

    const providers = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.userId, USER));
    expect(providers).toHaveLength(1);
    expect(providers[0]!.kind).toBe("transformers");

    const assignments = await db
      .select()
      .from(aiRoleAssignments)
      .where(eq(aiRoleAssignments.userId, USER));
    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.role).toBe("embedding");
    expect(assignments[0]!.modelId).toBe(TRANSFORMERS_DEFAULT_MODEL);
    expect(assignments[0]!.providerId).toBe(providers[0]!.id);
  });

  it("is idempotent — second call does not create duplicate provider or assignment", async () => {
    await ensureDefaultEmbeddingProvider(USER);
    await ensureDefaultEmbeddingProvider(USER);

    const providers = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.userId, USER));
    const assignments = await db
      .select()
      .from(aiRoleAssignments)
      .where(eq(aiRoleAssignments.userId, USER));
    expect(providers).toHaveLength(1);
    expect(assignments).toHaveLength(1);
  });

  it("does not overwrite an existing user-chosen embedding assignment", async () => {
    const userProviderId = crypto.randomUUID();
    await db.insert(aiProviders).values({
      id: userProviderId,
      userId: USER,
      kind: "openai-compatible",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnc: "fake",
    });
    await db.insert(aiRoleAssignments).values({
      userId: USER,
      role: "embedding",
      providerId: userProviderId,
      modelId: "deepseek-v4-flash",
    });

    await ensureDefaultEmbeddingProvider(USER);

    const assignments = await db
      .select()
      .from(aiRoleAssignments)
      .where(eq(aiRoleAssignments.userId, USER));
    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.providerId).toBe(userProviderId);
    expect(assignments[0]!.modelId).toBe("deepseek-v4-flash");

    const providers = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.userId, USER));
    // No phantom transformers provider should be created either.
    expect(providers).toHaveLength(1);
    expect(providers[0]!.kind).toBe("openai-compatible");
  });

  it("reuses an existing transformers provider instead of creating a duplicate", async () => {
    const existingId = crypto.randomUUID();
    await db.insert(aiProviders).values({
      id: existingId,
      userId: USER,
      kind: "transformers",
      label: "My Transformers",
      baseUrl: null,
      apiKeyEnc: null,
    });

    await ensureDefaultEmbeddingProvider(USER);

    const providers = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.userId, USER));
    expect(providers).toHaveLength(1);
    expect(providers[0]!.id).toBe(existingId);

    const [assignment] = await db
      .select()
      .from(aiRoleAssignments)
      .where(eq(aiRoleAssignments.userId, USER));
    expect(assignment!.providerId).toBe(existingId);
  });
});
