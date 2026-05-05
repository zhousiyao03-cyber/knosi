"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

type MasteryLog = {
  changedAt: Date | null;
  mastery: "blank" | "heard" | "learning" | "mastered";
  topicId: string;
};

type Bucket = { label: string; date: Date; mastered: number; learning: number; heard: number };

// Reconstruct a daily-snapshot of "current state per topic" by replaying log
// entries chronologically. We don't know the pre-window state, so any topic
// not seen in the log is assumed blank for the chart period — the chart shows
// progress *during* the window, not absolute counts.
function buildDailyBuckets(rows: MasteryLog[], days: number): Bucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: Bucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    buckets.push({
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      date: d,
      mastered: 0,
      learning: 0,
      heard: 0,
    });
  }

  // Walk buckets day by day; each day, replay log up to end-of-day.
  const sorted = [...rows]
    .filter((r) => r.changedAt)
    .sort(
      (a, b) =>
        (a.changedAt as Date).getTime() - (b.changedAt as Date).getTime()
    );

  for (const b of buckets) {
    const cutoff = b.date.getTime() + 24 * 60 * 60 * 1000 - 1;
    const stateAtDay = new Map<string, MasteryLog["mastery"]>();
    for (const r of sorted) {
      if ((r.changedAt as Date).getTime() > cutoff) break;
      stateAtDay.set(r.topicId, r.mastery);
    }
    for (const m of stateAtDay.values()) {
      if (m === "mastered") b.mastered++;
      else if (m === "learning") b.learning++;
      else if (m === "heard") b.heard++;
    }
  }

  return buckets;
}

export function MasteryProgressChart() {
  const query = trpc.curriculum.getMasteryHistory.useQuery({ days: 90 });
  const rows = useMemo(() => (query.data ?? []) as MasteryLog[], [query.data]);

  const buckets = useMemo(() => buildDailyBuckets(rows, 90), [rows]);
  const max = useMemo(
    () =>
      Math.max(
        1,
        ...buckets.map((b) => b.mastered + b.learning + b.heard)
      ),
    [buckets]
  );

  if (query.isLoading) return <p className="text-xs text-stone-500">Loading chart…</p>;

  if (rows.length === 0) {
    return (
      <p className="text-xs italic text-stone-400">
        No mastery changes logged yet. Toggle some topics on /learn/map to start tracking
        progress here.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Mastery progress (90d)
        </h3>
        <div className="flex items-center gap-3 text-[11px] text-stone-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Mastered
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-amber-500" /> Learning
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-sky-500" /> Heard
          </span>
        </div>
      </div>
      <div className="flex h-32 items-end gap-[2px]" data-testid="mastery-chart">
        {buckets.map((b, idx) => {
          const total = b.mastered + b.learning + b.heard;
          const pct = (n: number) => (max === 0 ? 0 : (n / max) * 100);
          return (
            <div
              key={idx}
              className="flex flex-1 flex-col justify-end"
              title={`${b.label}: mastered=${b.mastered} learning=${b.learning} heard=${b.heard}`}
            >
              <div
                className="w-full bg-emerald-500"
                style={{ height: `${pct(b.mastered)}%` }}
              />
              <div
                className="w-full bg-amber-500"
                style={{ height: `${pct(b.learning)}%` }}
              />
              <div
                className="w-full bg-sky-500"
                style={{ height: `${pct(b.heard)}%` }}
              />
              {total === 0 && (
                <div className="h-px w-full bg-stone-200 dark:bg-stone-800" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-stone-500">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  );
}
