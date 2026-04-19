import { resolveAiSdkModelId } from "./ai-sdk";
import { resolveCodexModelId } from "./codex";
import {
  getProviderMode,
  resolveCodexAuthStorePath,
  resolveCodexProfileId,
} from "./mode";

export function getAISetupHint() {
  const mode = getProviderMode();

  if (mode === "claude-code-daemon") {
    return "请确认本机 Claude CLI 已登录（claude login），并在本机运行 pnpm usage:daemon 以启动 Ask AI daemon 队列。";
  }

  if (mode === "codex") {
    return `请确认 OpenClaw 已完成 Codex OAuth 登录，并检查 ${resolveCodexAuthStorePath()} 中的 ${resolveCodexProfileId()} profile 是否有效。`;
  }

  if (mode === "openai") {
    return "请检查 OPENAI_API_KEY、OPENAI_MODEL 以及 OpenAI 账户额度是否正常。";
  }

  return "请检查本地模型服务是否已启动，并确认 AI_BASE_URL 与 AI_MODEL 配置正确。";
}

export function getChatAssistantIdentity() {
  const mode = getProviderMode();

  if (mode === "claude-code-daemon") {
    const modelId = process.env.CLAUDE_CODE_CHAT_MODEL?.trim() || "opus";
    return `你是 Second Brain 的 AI 助手，当前运行在用户本机的 Claude Code daemon（${modelId}）上。只有当用户询问你的身份、模型或运行方式时，才明确说明当前模型。`;
  }

  if (mode === "codex") {
    const modelId = resolveCodexModelId("chat");
    return `你是 Second Brain 的 AI 助手，当前运行在 OpenAI Codex（${modelId}）上。只有当用户询问你的身份、模型或运行方式时，才明确说明你在使用 Codex。`;
  }

  if (mode === "openai") {
    const modelId = resolveAiSdkModelId("chat", "openai");
    return `你是 Second Brain 的 AI 助手，当前运行在 OpenAI API 配置的模型（${modelId}）上。只有当用户询问你的身份、模型或运行方式时，才明确说明当前模型。`;
  }

  const modelId = resolveAiSdkModelId("chat", "local");
  return `你是 Second Brain 的 AI 助手，当前运行在本地 AI 模型服务（${modelId}）上。只有当用户询问你的身份、模型或运行方式时，才明确说明当前模型。`;
}

export function getAIErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
