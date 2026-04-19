import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, streamText } from "ai";
import type { z } from "zod/v4";
import { resolveValue } from "./shared";
import type {
  AIProviderMode,
  GenerateStructuredDataOptions,
  GenerationKind,
  StreamChatOptions,
} from "./types";

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_LOCAL_CHAT_MODEL = "qwen2.5:14b";
const DEFAULT_LOCAL_TASK_MODEL = "qwen2.5:14b";
const DEFAULT_OPENAI_CHAT_MODEL = "gpt-5.4";
const DEFAULT_OPENAI_TASK_MODEL = "gpt-5.4";

type AiSdkMode = Exclude<AIProviderMode, "codex" | "claude-code-daemon">;

function createAiSdkProvider(mode: AiSdkMode) {
  if (mode === "openai") {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error(
        "Missing OPENAI_API_KEY. Add it to .env.local or switch AI_PROVIDER to codex/local."
      );
    }

    return createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: resolveValue(process.env.OPENAI_BASE_URL),
      organization: resolveValue(process.env.OPENAI_ORGANIZATION),
      project: resolveValue(process.env.OPENAI_PROJECT),
    });
  }

  return createOpenAI({
    name: "local-ai",
    baseURL:
      resolveValue(process.env.AI_BASE_URL, process.env.LOCAL_AI_BASE_URL) ??
      DEFAULT_LOCAL_BASE_URL,
    apiKey:
      resolveValue(process.env.AI_API_KEY, process.env.LOCAL_AI_API_KEY) ??
      "local",
  });
}

export function resolveAiSdkModelId(kind: GenerationKind, mode: AiSdkMode) {
  if (mode === "openai") {
    const fallbackModelId =
      kind === "chat" ? DEFAULT_OPENAI_CHAT_MODEL : DEFAULT_OPENAI_TASK_MODEL;

    return (
      resolveValue(
        kind === "chat"
          ? process.env.OPENAI_CHAT_MODEL
          : process.env.OPENAI_TASK_MODEL,
        process.env.OPENAI_MODEL
      ) ?? fallbackModelId
    );
  }

  const fallbackModelId =
    kind === "chat" ? DEFAULT_LOCAL_CHAT_MODEL : DEFAULT_LOCAL_TASK_MODEL;

  return (
    resolveValue(
      kind === "chat" ? process.env.AI_CHAT_MODEL : process.env.AI_TASK_MODEL,
      kind === "chat"
        ? process.env.LOCAL_AI_CHAT_MODEL
        : process.env.LOCAL_AI_TASK_MODEL,
      process.env.AI_MODEL,
      process.env.LOCAL_AI_MODEL
    ) ?? fallbackModelId
  );
}

export function streamChatAiSdk({
  messages,
  signal,
  system,
  mode,
}: StreamChatOptions & { mode: AiSdkMode }) {
  const provider = createAiSdkProvider(mode);
  const result = streamText({
    abortSignal: signal,
    model: provider(resolveAiSdkModelId("chat", mode)),
    messages,
    system,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "chat",
      metadata: { mode },
    },
  });

  return result.toTextStreamResponse();
}

export async function generateStructuredDataAiSdk<TSchema extends z.ZodType>({
  description,
  name,
  prompt,
  schema,
  signal,
  mode,
}: GenerateStructuredDataOptions<TSchema> & { mode: AiSdkMode }): Promise<z.infer<TSchema>> {
  const provider = createAiSdkProvider(mode);
  const { output } = await generateText({
    model: provider(resolveAiSdkModelId("task", mode)),
    output: Output.object({ description, name, schema }),
    prompt,
    abortSignal: signal,
  });

  return output as z.infer<TSchema>;
}
