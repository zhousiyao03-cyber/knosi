import type { ModelMessage } from "ai";
import type { z } from "zod/v4";

export type AIProviderMode = "local" | "openai" | "codex" | "claude-code-daemon";

export type GenerationKind = "chat" | "task";

export type StreamChatOptions = {
  messages: ModelMessage[];
  sessionId?: string;
  signal?: AbortSignal;
  system: string;
};

export type GenerateStructuredDataOptions<TSchema extends z.ZodType> = {
  description: string;
  name: string;
  prompt: string;
  schema: TSchema;
  signal?: AbortSignal;
};

export type CodexProfile = {
  access: string;
  accountId?: string;
  expires: number;
  provider?: string;
  refresh: string;
  type?: string;
  [key: string]: unknown;
};

export type CodexAuthStore = {
  order?: Record<string, string[]>;
  profiles?: Record<string, CodexProfile>;
  usageStats?: Record<string, unknown>;
  version?: unknown;
  [key: string]: unknown;
};

export type CodexSseEvent = {
  delta?: string;
  item?: {
    content?: Array<{ text?: string; type?: string }>;
    error?: { message?: string };
    type?: string;
  };
  message?: string;
  response?: {
    error?: { message?: string };
    status?: string;
  };
  type?: string;
};
