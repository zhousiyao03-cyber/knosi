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
  note: "Note",
  journal: "Daily note",
  summary: "Summary",
} as const;

export interface NoteCoverOption {
  id: NoteCoverId;
  label: string;
  src: string;
}

export const NOTE_COVER_OPTIONS: NoteCoverOption[] = [
  {
    id: "amber",
    label: "Sunroom",
    src: "/covers/amber-window.svg",
  },
  {
    id: "sage",
    label: "Courtyard",
    src: "/covers/sage-garden.svg",
  },
  {
    id: "sky",
    label: "Tide",
    src: "/covers/sky-tide.svg",
  },
  {
    id: "plum",
    label: "Interlude",
    src: "/covers/plum-stage.svg",
  },
  {
    id: "graphite",
    label: "Studio",
    src: "/covers/graphite-paper.svg",
  },
];

export function getNoteCoverOption(cover: string | null | undefined) {
  if (!cover) return null;

  return NOTE_COVER_OPTIONS.find((option) => option.id === cover) ?? null;
}
