"use client";

import { wrap, type Remote } from "comlink";
import type { LocalLlmWorkerAPI } from "./contracts";

export type LocalLlmRemote = Remote<LocalLlmWorkerAPI>;

let cachedWorker: Worker | null = null;
let cachedRemote: LocalLlmRemote | null = null;

export function getLocalLlmRuntime(): LocalLlmRemote {
  if (cachedRemote) return cachedRemote;

  if (typeof Worker === "undefined") {
    throw new Error("Web Workers are not available in this environment.");
  }

  cachedWorker = new Worker(
    new URL("../../workers/llm.worker.ts", import.meta.url),
    { type: "module" }
  );
  cachedRemote = wrap<LocalLlmWorkerAPI>(cachedWorker);
  return cachedRemote;
}

export function disposeLocalLlmRuntime(): void {
  cachedWorker?.terminate();
  cachedWorker = null;
  cachedRemote = null;
}

export function isWebGpuLikelySupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "gpu" in navigator;
}

export function isFileSystemAccessSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as unknown as { showDirectoryPicker?: unknown })
    .showDirectoryPicker === "function";
}
