export type LocalModelPhase =
  | "idle"
  | "loading"
  | "ready"
  | "generating"
  | "error";

export interface LocalModelStatus {
  phase: LocalModelPhase;
  detail: string;
  error?: string;
  progress?: number;
}

export type ModelCacheSource = "folder" | "browser-cache" | "network";

export interface LocalModelCacheStatus {
  configured: boolean;
  detail: string;
  downloadBytes?: number;
  folderName: string | null;
  isReady: boolean;
  manifestComplete: boolean;
  permission: PermissionState | "unknown";
  source: ModelCacheSource | null;
}

export interface LocalChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LocalGenerateRequest {
  system: string;
  messages: LocalChatMessage[];
}

export interface LocalGenerateResult {
  output: string;
}

export interface LocalStreamChunk {
  type: "text";
  text: string;
}

export type LocalStreamListener = (chunk: LocalStreamChunk) => void;

export interface LocalLlmWorkerAPI {
  getStatus(): Promise<LocalModelStatus>;
  loadModel(): Promise<LocalModelStatus>;
  generateChat(
    request: LocalGenerateRequest,
    onStream?: LocalStreamListener
  ): Promise<LocalGenerateResult>;
  abortGeneration(): Promise<void>;
  configureModelCache(
    directoryHandle: FileSystemDirectoryHandle | null
  ): Promise<LocalModelCacheStatus>;
  clearModelCachePreference(): Promise<LocalModelCacheStatus>;
  getModelCacheStatus(): Promise<LocalModelCacheStatus>;
}
