"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { MasteryProgressChart } from "@/components/learn/mastery-progress-chart";

export default function CurriculumAuditPage() {
  const utils = trpc.useUtils();
  const curriculumQuery = trpc.curriculum.getCurriculum.useQuery();
  const tracks = useMemo(
    () => curriculumQuery.data?.tracks ?? [],
    [curriculumQuery.data]
  );

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const activeTrackId = selectedTrackId ?? tracks[0]?.id ?? null;

  const auditsQuery = trpc.curriculum.listAudits.useQuery(
    { trackId: activeTrackId ?? undefined },
    { enabled: Boolean(activeTrackId) }
  );

  const runAudit = trpc.curriculum.runAudit.useMutation({
    onSuccess: () => {
      if (activeTrackId) utils.curriculum.listAudits.invalidate({ trackId: activeTrackId });
    },
  });

  const audits = auditsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <Link
          href="/learn/map"
          className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
        >
          ← Back to map
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900 dark:text-stone-100">
          Knowledge Audit
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Run an honest gap-analysis. The AI sees your curriculum coverage and
          linked notes, then identifies strengths, weak areas, and missing
          must-knows for the role.
        </p>
      </header>

      <div className="mb-6">
        <MasteryProgressChart />
      </div>

      <nav className="mb-6 flex flex-wrap gap-2" data-testid="audit-track-tabs">
        {tracks.map((track) => (
          <button
            key={track.id}
            onClick={() => setSelectedTrackId(track.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              track.id === activeTrackId
                ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                : "border-stone-200 bg-white text-stone-700 hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400 dark:hover:border-stone-600"
            )}
          >
            <span className="mr-1.5">{track.icon}</span>
            {track.title}
          </button>
        ))}
      </nav>

      <div className="mb-8">
        <button
          type="button"
          onClick={() => activeTrackId && runAudit.mutate({ trackId: activeTrackId })}
          disabled={!activeTrackId || runAudit.isPending}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          data-testid="run-audit"
        >
          {runAudit.isPending ? "Running audit (~30s)…" : "Run audit"}
        </button>
        {runAudit.error && (
          <p className="mt-2 text-xs text-rose-600">{runAudit.error.message}</p>
        )}
      </div>

      {auditsQuery.isLoading && <p className="text-sm text-stone-500">Loading…</p>}

      {audits.length === 0 && !auditsQuery.isLoading && !runAudit.isPending && (
        <p className="text-sm text-stone-500">
          No audits yet for this track. Run one above.
        </p>
      )}

      <div className="space-y-6">
        {audits.map((audit) => (
          <article
            key={audit.id}
            className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
            data-testid="audit-result"
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {audit.createdAt
                  ? new Date(audit.createdAt).toLocaleString()
                  : "Recent"}
              </h2>
            </div>
            <p className="mb-4 text-sm text-stone-700 dark:text-stone-300">
              {audit.summary}
            </p>

            <Section title="Strengths" items={audit.strengths} tone="emerald" />
            <Section title="Weak areas" items={audit.weakAreas} tone="amber" />
            <Section
              title="Missing must-knows"
              items={audit.missingMustKnows}
              tone="rose"
            />
            <Section title="Next steps" items={audit.nextSteps} tone="sky" />
          </article>
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "amber" | "rose" | "sky";
}) {
  if (items.length === 0) return null;
  const dot: Record<typeof tone, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    sky: "bg-sky-500",
  };
  return (
    <section className="mb-3 last:mb-0">
      <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-stone-500">
        {title}
      </h3>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot[tone])} />
            <span className="text-stone-700 dark:text-stone-300">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
