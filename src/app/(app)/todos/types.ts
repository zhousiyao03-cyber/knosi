import type { Circle } from "lucide-react";

export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "in_progress" | "done";
export type ViewMode = "table" | "dashboard";
export type TodoBucket = "overdue" | "today" | "upcoming" | "noDate" | "completed";

export interface TodoItem {
  id: string;
  title: string;
  description: string | null;
  priority: Priority | null;
  status: Status | null;
  category: string | null;
  dueDate: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface TodoDraft {
  title: string;
  description: string;
  priority: Priority;
  category: string;
  dueDate: string;
}

export interface TodoEditorDraft extends TodoDraft {
  status: Status;
}

export interface PriorityMeta {
  label: string;
  badge: string;
  rank: number;
  detailTone: string;
}

export interface StatusMeta {
  label: string;
  icon: typeof Circle;
  badge: string;
  buttonTone: string;
}

export interface BucketMeta {
  label: string;
  badge: string;
  summary: string;
}
