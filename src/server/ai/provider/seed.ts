import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { aiProviders, aiRoleAssignments } from "@/server/db/schema/ai-providers";
import { TRANSFORMERS_DEFAULT_MODEL } from "./presets";
import { invalidateProviderCache } from "./resolve";

const SEED_LABEL = "Local Embeddings (Transformers.js)";

/**
 * Lazy default for the embedding role: in-process Transformers.js with
 * `Xenova/multilingual-e5-small`. Embedding is the role users almost never
 * touch — without a default they end up with `[rag] query embedding failed`
 * the first time they trigger RAG. Idempotent: only seeds when no embedding
 * assignment exists; never overwrites a user-chosen provider.
 */
export async function ensureDefaultEmbeddingProvider(
  userId: string,
): Promise<void> {
  const [existing] = await db
    .select({ providerId: aiRoleAssignments.providerId })
    .from(aiRoleAssignments)
    .where(
      and(
        eq(aiRoleAssignments.userId, userId),
        eq(aiRoleAssignments.role, "embedding"),
      ),
    )
    .limit(1);
  if (existing) return;

  let providerId: string;
  const [reuse] = await db
    .select({ id: aiProviders.id })
    .from(aiProviders)
    .where(
      and(eq(aiProviders.userId, userId), eq(aiProviders.kind, "transformers")),
    )
    .limit(1);
  if (reuse) {
    providerId = reuse.id;
  } else {
    providerId = crypto.randomUUID();
    await db.insert(aiProviders).values({
      id: providerId,
      userId,
      kind: "transformers",
      label: SEED_LABEL,
      baseUrl: null,
      apiKeyEnc: null,
    });
  }

  await db
    .insert(aiRoleAssignments)
    .values({
      userId,
      role: "embedding",
      providerId,
      modelId: TRANSFORMERS_DEFAULT_MODEL,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [aiRoleAssignments.userId, aiRoleAssignments.role],
    });
  invalidateProviderCache(userId);
}
