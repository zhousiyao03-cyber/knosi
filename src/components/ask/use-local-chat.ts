"use client";

import { proxy } from "comlink";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LocalChatMessage,
  LocalModelCacheStatus,
  LocalModelStatus,
} from "@/lib/local-ai/contracts";
import {
  disposeLocalLlmRuntime,
  getLocalLlmRuntime,
  isWebGpuLikelySupported,
} from "@/lib/local-ai/runtime";
import type { PreparedChatBundle } from "@/app/api/chat/prepare/route";
import type { AskAiSourceScope } from "@/lib/ask-ai";

export type LocalChatStatus = "idle" | "preparing" | "streaming" | "error";

export interface LocalUiMessagePart {
  type: "text";
  text: string;
}

export interface LocalUiMessage {
  id: string;
  role: "user" | "assistant";
  parts: LocalUiMessagePart[];
}

export interface LocalChatSendOptions {
  sourceScope?: AskAiSourceScope;
  contextNoteText?: string;
  pinnedSources?: Array<{ id: string; type: "note" | "bookmark" }>;
  preferStructuredBlocks?: boolean;
}

export interface UseLocalChatResult {
  messages: LocalUiMessage[];
  status: LocalChatStatus;
  error: Error | null;
  clearError: () => void;
  sendMessage: (input: { text: string }, options?: LocalChatSendOptions) => void;
  setMessages: (next: LocalUiMessage[]) => void;
  stop: () => void;
  regenerate: (options?: LocalChatSendOptions) => void;
  modelStatus: LocalModelStatus;
  cacheStatus: LocalModelCacheStatus | null;
  loadModel: () => Promise<void>;
  configureCacheFolder: (
    handle: FileSystemDirectoryHandle | null
  ) => Promise<void>;
  webGpuSupported: boolean;
}

const IDLE_STATUS: LocalModelStatus = { phase: "idle", detail: "Model idle." };

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function asError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error");
}

async function fetchPrepared(
  messages: LocalUiMessage[],
  options: LocalChatSendOptions | undefined,
  signal: AbortSignal
): Promise<PreparedChatBundle> {
  const uiMessages = messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts,
  }));

  const res = await fetch("/api/chat/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: uiMessages,
      sourceScope: options?.sourceScope ?? "all",
      contextNoteText: options?.contextNoteText,
      pinnedSources: options?.pinnedSources,
      preferStructuredBlocks: options?.preferStructuredBlocks,
    }),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg =
      (errBody as { error?: string })?.error ??
      `Prepare request failed: ${res.status}`;
    throw new Error(msg);
  }

  return (await res.json()) as PreparedChatBundle;
}

export function useLocalChat(): UseLocalChatResult {
  const [messages, setMessages] = useState<LocalUiMessage[]>([]);
  const [status, setStatus] = useState<LocalChatStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [modelStatus, setModelStatus] = useState<LocalModelStatus>(IDLE_STATUS);
  const [cacheStatus, setCacheStatus] =
    useState<LocalModelCacheStatus | null>(null);
  const [webGpuSupported, setWebGpuSupported] = useState(true);

  const prepareAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setWebGpuSupported(isWebGpuLikelySupported());
    const runtime = getLocalLlmRuntime();
    void runtime.getStatus().then(setModelStatus).catch(() => undefined);
    void runtime.getModelCacheStatus().then(setCacheStatus).catch(() => undefined);

    return () => {
      prepareAbortRef.current?.abort();
      disposeLocalLlmRuntime();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const loadModel = useCallback(async () => {
    setError(null);
    const runtime = getLocalLlmRuntime();

    const poll = async () => {
      try {
        const s = await runtime.getStatus();
        setModelStatus(s);
      } catch {
        // ignore
      }
    };
    const interval = setInterval(() => void poll(), 500);

    try {
      const next = await runtime.loadModel();
      setModelStatus(next);
    } catch (err) {
      setError(asError(err));
      try {
        setModelStatus(await runtime.getStatus());
      } catch {
        // ignore
      }
    } finally {
      clearInterval(interval);
    }
  }, []);

  const configureCacheFolder = useCallback(
    async (handle: FileSystemDirectoryHandle | null) => {
      const runtime = getLocalLlmRuntime();
      try {
        const next = await runtime.configureModelCache(handle);
        setCacheStatus(next);
      } catch (err) {
        setError(asError(err));
      }
    },
    []
  );

  const runGeneration = useCallback(
    async (
      historyBeforeAssistant: LocalUiMessage[],
      assistantId: string,
      options: LocalChatSendOptions | undefined
    ) => {
      const controller = new AbortController();
      prepareAbortRef.current = controller;

      setStatus("preparing");
      setError(null);

      let bundle: PreparedChatBundle;
      try {
        bundle = await fetchPrepared(
          historyBeforeAssistant,
          options,
          controller.signal
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("idle");
          return;
        }
        setError(asError(err));
        setStatus("error");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      const runtime = getLocalLlmRuntime();

      // Ensure model is ready before streaming
      try {
        const current = await runtime.getStatus();
        if (current.phase !== "ready") {
          setStatus("preparing");
          const poll = setInterval(async () => {
            try {
              const s = await runtime.getStatus();
              setModelStatus(s);
            } catch {
              // ignore
            }
          }, 500);
          try {
            const loaded = await runtime.loadModel();
            setModelStatus(loaded);
          } finally {
            clearInterval(poll);
          }
        }
      } catch (err) {
        setError(asError(err));
        setStatus("error");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      setStatus("streaming");

      const onStream = proxy((chunk: { type: "text"; text: string }) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const existing = m.parts[0]?.text ?? "";
            return {
              ...m,
              parts: [{ type: "text", text: existing + chunk.text }],
            };
          })
        );
      });

      try {
        const workerMessages: LocalChatMessage[] = bundle.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const result = await runtime.generateChat(
          { system: bundle.system, messages: workerMessages },
          onStream
        );
        // Final sync in case streamer produced nothing (non-streaming fallback)
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            if (m.parts[0]?.text) return m;
            return {
              ...m,
              parts: [{ type: "text", text: result.output }],
            };
          })
        );
        try {
          setModelStatus(await runtime.getStatus());
        } catch {
          // ignore
        }
        setStatus("idle");
      } catch (err) {
        const e = asError(err);
        if (e.message === "Generation interrupted.") {
          setStatus("idle");
          return;
        }
        setError(e);
        setStatus("error");
      }
    },
    []
  );

  const sendMessage = useCallback(
    (input: { text: string }, options?: LocalChatSendOptions) => {
      const userMsg: LocalUiMessage = {
        id: newId(),
        role: "user",
        parts: [{ type: "text", text: input.text }],
      };
      const assistantMsg: LocalUiMessage = {
        id: newId(),
        role: "assistant",
        parts: [{ type: "text", text: "" }],
      };

      setMessages((prev) => {
        const historyBeforeAssistant = [...prev, userMsg];
        void runGeneration(historyBeforeAssistant, assistantMsg.id, options);
        return [...historyBeforeAssistant, assistantMsg];
      });
    },
    [runGeneration]
  );

  const regenerate = useCallback(
    (options?: LocalChatSendOptions) => {
      setMessages((prev) => {
        // Drop the trailing assistant if it exists, keep the latest user
        let trimmed = prev;
        if (trimmed.length > 0 && trimmed[trimmed.length - 1]?.role === "assistant") {
          trimmed = trimmed.slice(0, -1);
        }
        if (trimmed.length === 0) return prev;

        const assistantMsg: LocalUiMessage = {
          id: newId(),
          role: "assistant",
          parts: [{ type: "text", text: "" }],
        };
        void runGeneration(trimmed, assistantMsg.id, options);
        return [...trimmed, assistantMsg];
      });
    },
    [runGeneration]
  );

  const stop = useCallback(() => {
    prepareAbortRef.current?.abort();
    const runtime = getLocalLlmRuntime();
    void runtime.abortGeneration();
    setStatus("idle");
  }, []);

  return {
    messages,
    status,
    error,
    clearError,
    sendMessage,
    setMessages,
    stop,
    regenerate,
    modelStatus,
    cacheStatus,
    loadModel,
    configureCacheFolder,
    webGpuSupported,
  };
}
