import {
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import type {
  Priority,
  Status,
  TodoBucket,
  TodoDraft,
  PriorityMeta,
  StatusMeta,
  BucketMeta,
} from "./types";

export const EMPTY_DRAFT: TodoDraft = {
  title: "",
  description: "",
  priority: "medium",
  category: "",
  dueDate: "",
};

export const CATEGORY_OPTIONS = [
  "工作",
  "学习",
  "生活",
  "采购",
  "健康",
  "杂项",
] as const;

export const TIME_OPTIONS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
] as const;

export const priorityMeta: Record<Priority, PriorityMeta> = {
  low: {
    label: "低优先级",
    badge:
      "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300",
    rank: 0,
    detailTone:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  },
  medium: {
    label: "中优先级",
    badge:
      "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300",
    rank: 1,
    detailTone:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
  },
  high: {
    label: "高优先级",
    badge:
      "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-300",
    rank: 2,
    detailTone:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
  },
};

export const statusMeta: Record<Status, StatusMeta> = {
  todo: {
    label: "待办",
    icon: Circle,
    badge:
      "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
    buttonTone:
      "border-slate-200 bg-white text-slate-400 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-500 dark:hover:border-sky-700 dark:hover:text-sky-300",
  },
  in_progress: {
    label: "进行中",
    icon: Clock,
    badge:
      "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-300",
    buttonTone:
      "border-sky-200 bg-sky-50 text-sky-600 hover:border-sky-300 hover:text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:border-sky-700",
  },
  done: {
    label: "已完成",
    icon: CheckCircle2,
    badge:
      "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300",
    buttonTone:
      "border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:border-emerald-700",
  },
};

export const bucketMeta: Record<TodoBucket, BucketMeta> = {
  overdue: {
    label: "逾期",
    badge:
      "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-300",
    summary: "需要优先处理",
  },
  today: {
    label: "今天",
    badge:
      "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300",
    summary: "今天要收口",
  },
  upcoming: {
    label: "之后",
    badge:
      "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-300",
    summary: "已经排上时间",
  },
  noDate: {
    label: "待排期",
    badge:
      "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
    summary: "还没放进时间表",
  },
  completed: {
    label: "已完成",
    badge:
      "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300",
    summary: "不再抢占注意力",
  },
};
