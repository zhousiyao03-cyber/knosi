"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Kind = "analysis" | "followup";

const KIND_LABELS: Record<Kind, { title: string; description: string }> = {
  analysis: {
    title: "Source analysis prompt",
    description:
      "The main prompt sent when you click Analyse on a repository. Supports placeholders {{REPO_URL}}, {{COMMIT_SHA}}, {{COMMIT_SHORT}}, {{COMMIT_DATE}}, {{ANALYSED_AT}}.",
  },
  followup: {
    title: "Follow-up question prompt",
    description:
      "The prompt sent when you ask a follow-up question on a previously analysed project. Supports {{REPO_URL}}, commit placeholders, plus {{QUESTION}} and {{ORIGINAL_ANALYSIS}}.",
  },
};

export function AnalysisPromptsSection() {
  const { data, isLoading, refetch } = trpc.ossProjects.getAnalysisPrompts.useQuery();

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white/92 p-6 shadow-[0_22px_80px_-58px_rgba(15,23,42,0.55)] dark:border-stone-800 dark:bg-stone-950/88">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
          Source analysis prompts
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Customize the prompts the local daemon sends to Claude / Codex when
          analysing GitHub repositories. Changes apply to the next analysis
          task — no daemon restart needed.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 size={14} className="animate-spin" />
          Loading prompts…
        </div>
      ) : (
        <div className="space-y-8">
          {(["analysis", "followup"] as Kind[]).map((kind) => (
            <PromptEditor
              key={kind}
              kind={kind}
              initial={data[kind].content}
              defaultContent={data[kind].default}
              isCustom={data[kind].isCustom}
              onSaved={() => refetch()}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface PromptEditorProps {
  kind: Kind;
  initial: string;
  defaultContent: string;
  isCustom: boolean;
  onSaved: () => void;
}

function PromptEditor({ kind, initial, defaultContent, isCustom, onSaved }: PromptEditorProps) {
  const [value, setValue] = useState(initial);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Re-sync if the parent refetches and gives us new content
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const upsert = trpc.ossProjects.upsertAnalysisPrompt.useMutation({
    onSuccess: () => {
      setStatusMessage("Saved.");
      onSaved();
    },
    onError: (err) => setStatusMessage(`Error: ${err.message}`),
  });

  const reset = trpc.ossProjects.resetAnalysisPrompt.useMutation({
    onSuccess: () => {
      setStatusMessage("Reset to default.");
      setValue(defaultContent);
      onSaved();
    },
    onError: (err) => setStatusMessage(`Error: ${err.message}`),
  });

  const meta = KIND_LABELS[kind];
  const dirty = value !== initial;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
            {meta.title}
            {isCustom && (
              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-normal text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Customized
              </span>
            )}
          </h3>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {meta.description}
          </p>
        </div>
        {isCustom && (
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => {
              if (
                confirm(
                  `Reset the ${kind} prompt to the built-in default? Your customizations will be lost.`
                )
              ) {
                reset.mutate({ kind });
              }
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-900"
          >
            <RotateCcw size={12} />
            Reset to default
          </button>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (statusMessage) setStatusMessage(null);
        }}
        rows={18}
        spellCheck={false}
        className="w-full resize-y rounded-xl border border-stone-300 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-stone-900 outline-none transition focus:border-stone-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:focus:border-stone-500"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || upsert.isPending || value.trim().length < 10}
          onClick={() => upsert.mutate({ kind, content: value })}
          className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          {upsert.isPending && <Loader2 size={14} className="animate-spin" />}
          Save prompt
        </button>
        {statusMessage && (
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {statusMessage}
          </span>
        )}
        {dirty && !upsert.isPending && !statusMessage && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
