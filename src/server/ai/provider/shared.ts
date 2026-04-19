import { existsSync, readFileSync } from "node:fs";
import { z } from "zod/v4";
import type { ModelMessage } from "ai";
import type { GenerateStructuredDataOptions } from "./types";

export function resolveValue(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim();
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function getTextFromModelMessageContent(content: ModelMessage["content"]) {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function buildStructuredJsonPrompt<TSchema extends z.ZodType>({
  description,
  name,
  prompt,
  schema,
}: Omit<GenerateStructuredDataOptions<TSchema>, "signal">) {
  return [
    `Return exactly one JSON object for "${name}".`,
    description,
    "Do not include markdown fences, explanations, or any text outside the JSON object.",
    "The JSON must satisfy this schema exactly:",
    JSON.stringify(z.toJSONSchema(schema), null, 2),
    "",
    "Task:",
    prompt,
  ].join("\n");
}

export function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return candidate;
  }

  return candidate.slice(start, end + 1);
}
