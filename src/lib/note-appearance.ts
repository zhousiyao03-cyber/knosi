export const NOTE_COVER_IDS = [
  "amber",
  "sage",
  "sky",
  "plum",
  "graphite",
] as const;

export type NoteCoverId = (typeof NOTE_COVER_IDS)[number];

export const NOTE_ICON_OPTIONS = [
  "✨",
  "📝",
  "💡",
  "📚",
  "🧠",
  "🚀",
  "📌",
  "🌿",
] as const;

export const NOTE_TYPE_LABELS = {
  note: "笔记",
  journal: "日记",
  summary: "总结",
} as const;

export interface NoteCoverOption {
  id: NoteCoverId;
  label: string;
  bannerClassName: string;
  chipClassName: string;
  swatchClassName: string;
}

export const NOTE_COVER_OPTIONS: NoteCoverOption[] = [
  {
    id: "amber",
    label: "日光",
    bannerClassName:
      "bg-gradient-to-br from-amber-200 via-orange-100 to-rose-50",
    chipClassName:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/60 dark:text-amber-200",
    swatchClassName: "bg-gradient-to-br from-amber-300 via-orange-200 to-rose-100",
  },
  {
    id: "sage",
    label: "苔原",
    bannerClassName:
      "bg-gradient-to-br from-emerald-200 via-lime-100 to-stone-50",
    chipClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/60 dark:text-emerald-200",
    swatchClassName: "bg-gradient-to-br from-emerald-300 via-lime-200 to-stone-100",
  },
  {
    id: "sky",
    label: "海雾",
    bannerClassName:
      "bg-gradient-to-br from-sky-200 via-cyan-100 to-blue-50",
    chipClassName:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/80 dark:bg-sky-950/60 dark:text-sky-200",
    swatchClassName: "bg-gradient-to-br from-sky-300 via-cyan-200 to-blue-100",
  },
  {
    id: "plum",
    label: "暮紫",
    bannerClassName:
      "bg-gradient-to-br from-fuchsia-200 via-violet-100 to-purple-50",
    chipClassName:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/80 dark:bg-violet-950/60 dark:text-violet-200",
    swatchClassName:
      "bg-gradient-to-br from-fuchsia-300 via-violet-200 to-purple-100",
  },
  {
    id: "graphite",
    label: "石墨",
    bannerClassName:
      "bg-gradient-to-br from-stone-300 via-stone-200 to-zinc-50 dark:from-stone-700 dark:via-stone-800 dark:to-stone-950",
    chipClassName:
      "border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200",
    swatchClassName: "bg-gradient-to-br from-stone-400 via-stone-300 to-zinc-100",
  },
];

export function getNoteCoverOption(cover: string | null | undefined) {
  if (!cover) return null;

  return NOTE_COVER_OPTIONS.find((option) => option.id === cover) ?? null;
}
