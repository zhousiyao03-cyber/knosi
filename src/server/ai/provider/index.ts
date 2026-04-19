/**
 * Provider façade — picks the right backend at runtime (local / openai /
 * codex / claude-code-daemon) and forwards chat or structured-data calls
 * to the matching file under `./`.
 *
 * Adding a new provider = one new file here plus a branch in the two
 * dispatchers below. Identity/setup helpers live in `identity.ts`.
 */

import type { z } from "zod/v4";
import { generateStructuredDataAiSdk, streamChatAiSdk } from "./ai-sdk";
import { generateStructuredDataCodex, streamChatCodex } from "./codex";
import { generateStructuredDataDaemon } from "./daemon";
import { getProviderMode } from "./mode";
import type {
  GenerateStructuredDataOptions,
  StreamChatOptions,
} from "./types";

export async function streamChatResponse(options: StreamChatOptions) {
  const mode = getProviderMode();

  if (mode === "claude-code-daemon") {
    throw new Error(
      "streamChatResponse must not be called when AI_PROVIDER=claude-code-daemon. " +
        "The chat route should have taken the daemon enqueue branch."
    );
  }

  if (mode === "codex") {
    return streamChatCodex(options);
  }

  return streamChatAiSdk({ ...options, mode });
}

export async function generateStructuredData<TSchema extends z.ZodType>(
  options: GenerateStructuredDataOptions<TSchema>
): Promise<z.infer<TSchema>> {
  const mode = getProviderMode();

  if (mode === "claude-code-daemon") {
    return generateStructuredDataDaemon(options);
  }

  if (mode === "codex") {
    return generateStructuredDataCodex(options);
  }

  return generateStructuredDataAiSdk({ ...options, mode });
}

export {
  getAIErrorMessage,
  getAISetupHint,
  getChatAssistantIdentity,
} from "./identity";
