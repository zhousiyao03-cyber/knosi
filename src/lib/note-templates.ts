const JOURNAL_TITLE_DATE_PATTERN = /^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s+(星期[日一二三四五六]|周[日一二三四五六天]))?$/;

function formatJournalDatePart(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatJournalWeekdayPart(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
  }).format(date);
}

export function formatJournalTitle(date = new Date()) {
  return `${formatJournalDatePart(date)} ${formatJournalWeekdayPart(date)}`;
}

export function formatLegacyJournalTitle(date = new Date()) {
  return formatJournalDatePart(date);
}

export function parseAutoJournalTitleDate(title: string) {
  const match = title.trim().match(JOURNAL_TITLE_DATE_PATTERN);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
}

export function normalizeAutoJournalTitle(title: string) {
  const date = parseAutoJournalTitleDate(title);
  if (!date) {
    return null;
  }

  return formatJournalTitle(date);
}

const TODAY_TODO_HEADING = "Today's todo";
const REVIEW_HEADING = "Today's review";
const TOMORROW_PLAN_HEADING = "Tomorrow's plan";

type JournalDocNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: JournalDocNode[];
};

function createEmptyTaskItem() {
  return {
    type: "taskItem",
    attrs: { checked: false },
    content: [
      {
        type: "paragraph",
      },
    ],
  };
}

function createTaskItem(text: string) {
  return {
    type: "taskItem",
    attrs: { checked: false },
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : undefined,
      },
    ],
  };
}

function getInlineText(node?: JournalDocNode): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(getInlineText).join("");
}

function normalizeTaskItems(items: string[]) {
  const deduped = new Set<string>();

  for (const item of items) {
    const value = item.trim();
    if (value) deduped.add(value);
  }

  return [...deduped];
}

export function extractTomorrowPlanItems(content?: string | null) {
  if (!content) return [];

  let doc: JournalDocNode | null = null;
  try {
    doc = JSON.parse(content) as JournalDocNode;
  } catch {
    return [];
  }

  const nodes = doc?.content ?? [];
  const items: string[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.type !== "heading") continue;

    if (getInlineText(node).trim() !== TOMORROW_PLAN_HEADING) continue;

    const taskList = nodes[index + 1];
    if (taskList?.type !== "taskList") return [];

    for (const taskItem of taskList.content ?? []) {
      if (taskItem.type !== "taskItem") continue;
      if (taskItem.attrs?.checked === true) continue;

      const text = getInlineText(taskItem).trim();
      if (text) items.push(text);
    }

    return normalizeTaskItems(items);
  }

  return [];
}

export function createJournalTemplate(
  date = new Date(),
  carryOverItems: string[] = []
) {
  const title = formatJournalTitle(date);
  const normalizedCarryOverItems = normalizeTaskItems(carryOverItems);
  const content = JSON.stringify({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: TODAY_TODO_HEADING }],
      },
      {
        type: "taskList",
        content:
          normalizedCarryOverItems.length > 0
            ? normalizedCarryOverItems.map(createTaskItem)
            : [createEmptyTaskItem()],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: REVIEW_HEADING }],
      },
      {
        type: "paragraph",
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: TOMORROW_PLAN_HEADING }],
      },
      {
        type: "taskList",
        content: [createEmptyTaskItem()],
      },
    ],
  });

  return {
    title,
    type: "journal" as const,
    content,
    plainText: [
      TODAY_TODO_HEADING,
      ...normalizedCarryOverItems,
      REVIEW_HEADING,
      TOMORROW_PLAN_HEADING,
    ].join("\n"),
  };
}
