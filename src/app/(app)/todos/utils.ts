import type { Priority, TodoItem, TodoEditorDraft } from "./types";
import { priorityMeta } from "./constants";

export function toLocalDateTimeValue(date: Date | null) {
  if (!date) return "";

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function toDateValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function getDatePart(value: string) {
  return value ? value.slice(0, 10) : "";
}

export function getTimePart(value: string) {
  return value ? value.slice(11, 16) : "";
}

export function joinDateAndTime(datePart: string, timePart: string) {
  if (!datePart) return "";
  return `${datePart}T${timePart || "09:00"}`;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getQuickDueValue(offsetDays: number, time = "09:00") {
  const target = startOfDay(new Date());
  target.setDate(target.getDate() + offsetDays);
  return joinDateAndTime(toDateValue(target), time);
}

export function fromLocalDateTimeValue(value: string) {
  if (!value) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export function formatAbsoluteDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeDueDate(date: Date | null) {
  if (!date) {
    return {
      label: "未设置时间",
      tone:
        "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
    };
  }

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(tomorrow.getDate() + 1);
  const time = formatAbsoluteDate(date).split(" ")[1] ?? formatAbsoluteDate(date);

  if (date.getTime() < now.getTime()) {
    return {
      label: `逾期 ${formatAbsoluteDate(date)}`,
      tone:
        "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-300",
    };
  }

  if (date >= today && date < tomorrow) {
    return {
      label: `今天 ${time}`,
      tone:
        "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300",
    };
  }

  if (date >= tomorrow && date < dayAfterTomorrow) {
    return {
      label: `明天 ${time}`,
      tone:
        "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-300",
    };
  }

  return {
    label: formatAbsoluteDate(date),
    tone:
      "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
  };
}

export function getTodoBucket(todo: TodoItem) {
  if ((todo.status ?? "todo") === "done") return "completed";
  if (!todo.dueDate) return "noDate";

  if (todo.dueDate.getTime() < Date.now()) return "overdue";
  if (startOfDay(todo.dueDate).getTime() === startOfDay(new Date()).getTime()) {
    return "today";
  }

  return "upcoming";
}

export function getBucketFromDueDate(dueDate: Date | null) {
  if (!dueDate) return "noDate";

  if (dueDate.getTime() < Date.now()) return "overdue";
  if (startOfDay(dueDate).getTime() === startOfDay(new Date()).getTime()) {
    return "today";
  }

  return "upcoming";
}

function comparePriority(a: TodoItem, b: TodoItem) {
  const aRank = priorityMeta[(a.priority ?? "medium") as Priority].rank;
  const bRank = priorityMeta[(b.priority ?? "medium") as Priority].rank;
  return bRank - aRank;
}

export function sortTodos(items: TodoItem[]) {
  return [...items].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      const dueDiff = a.dueDate.getTime() - b.dueDate.getTime();
      if (dueDiff !== 0) return dueDiff;
    }

    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    const priorityDiff = comparePriority(a, b);
    if (priorityDiff !== 0) return priorityDiff;

    return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
  });
}

export function sortBacklogTodos(items: TodoItem[]) {
  return [...items].sort((a, b) => {
    const updatedDiff = (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
    if (updatedDiff !== 0) return updatedDiff;

    return comparePriority(a, b);
  });
}

export function toEditorDraft(todo: TodoItem): TodoEditorDraft {
  return {
    title: todo.title,
    description: todo.description ?? "",
    priority: (todo.priority ?? "medium") as Priority,
    category: todo.category ?? "",
    dueDate: toLocalDateTimeValue(todo.dueDate),
    status: (todo.status ?? "todo") as Status,
  };
}

// Re-export Status for the toEditorDraft return type
import type { Status } from "./types";
