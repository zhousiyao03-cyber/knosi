"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Clock3,
  Inbox,
  Plus,
  Search,
  Sparkles,
  SunMedium,
  Target,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high";
type Status = "todo" | "in_progress" | "done";

interface TodoItem {
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

interface TodoDraft {
  title: string;
  description: string;
  priority: Priority;
  category: string;
  dueDate: string;
}

interface TodoEditorDraft extends TodoDraft {
  status: Status;
}

const EMPTY_DRAFT: TodoDraft = {
  title: "",
  description: "",
  priority: "medium",
  category: "",
  dueDate: "",
};

const CATEGORY_OPTIONS = [
  "工作",
  "学习",
  "生活",
  "采购",
  "健康",
  "杂项",
] as const;

const TIME_OPTIONS = [
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

const priorityMeta: Record<
  Priority,
  {
    label: string;
    badge: string;
    rank: number;
    detailTone: string;
  }
> = {
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

const statusMeta: Record<
  Status,
  {
    label: string;
    icon: typeof Circle;
    badge: string;
    buttonTone: string;
  }
> = {
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

function toLocalDateTimeValue(date: Date | null) {
  if (!date) return "";

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toDateValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function getDatePart(value: string) {
  return value ? value.slice(0, 10) : "";
}

function getTimePart(value: string) {
  return value ? value.slice(11, 16) : "";
}

function joinDateAndTime(datePart: string, timePart: string) {
  if (!datePart) return "";
  return `${datePart}T${timePart || "09:00"}`;
}

function getQuickDueValue(offsetDays: number, time = "09:00") {
  const target = startOfDay(new Date());
  target.setDate(target.getDate() + offsetDays);
  return joinDateAndTime(toDateValue(target), time);
}

function fromLocalDateTimeValue(value: string) {
  if (!value) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatAbsoluteDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeDueDate(date: Date | null) {
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

function getTodoBucket(todo: TodoItem) {
  if ((todo.status ?? "todo") === "done") return "completed" as const;
  if (!todo.dueDate) return "noDate" as const;

  if (todo.dueDate.getTime() < Date.now()) return "overdue" as const;
  if (startOfDay(todo.dueDate).getTime() === startOfDay(new Date()).getTime()) {
    return "today" as const;
  }

  return "upcoming" as const;
}

function getBucketFromDueDate(dueDate: Date | null) {
  if (!dueDate) return "noDate" as const;

  if (dueDate.getTime() < Date.now()) return "overdue" as const;
  if (startOfDay(dueDate).getTime() === startOfDay(new Date()).getTime()) {
    return "today" as const;
  }

  return "upcoming" as const;
}

function comparePriority(a: TodoItem, b: TodoItem) {
  const aRank = priorityMeta[(a.priority ?? "medium") as Priority].rank;
  const bRank = priorityMeta[(b.priority ?? "medium") as Priority].rank;
  return bRank - aRank;
}

function sortTodos(items: TodoItem[]) {
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

function sortBacklogTodos(items: TodoItem[]) {
  return [...items].sort((a, b) => {
    const updatedDiff = (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
    if (updatedDiff !== 0) return updatedDiff;

    return comparePriority(a, b);
  });
}

function toEditorDraft(todo: TodoItem): TodoEditorDraft {
  return {
    title: todo.title,
    description: todo.description ?? "",
    priority: (todo.priority ?? "medium") as Priority,
    category: todo.category ?? "",
    dueDate: toLocalDateTimeValue(todo.dueDate),
    status: (todo.status ?? "todo") as Status,
  };
}

export default function TodosPage() {
  const [draft, setDraft] = useState<TodoDraft>(EMPTY_DRAFT);
  const [showCreateDetails, setShowCreateDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<TodoEditorDraft | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    overdue: true,
    today: true,
    upcoming: true,
    noDate: false,
    completed: false,
  });

  const utils = trpc.useUtils();
  const { data: todoResults = [], isLoading } = trpc.todos.list.useQuery();
  const todos = todoResults as TodoItem[];

  const createTodo = trpc.todos.create.useMutation({
    onSuccess: ({ id }, variables) => {
      const createdDueDate =
        variables.dueDate instanceof Date ? variables.dueDate : null;
      const createdBucket = getBucketFromDueDate(createdDueDate);

      void utils.todos.list.invalidate();
      setStatusFilter("all");
      setPriorityFilter("all");
      setCategoryFilter("all");
      setQuery("");
      setSelectedTodoId(id);
      setEditorDraft({
        title: variables.title,
        description: variables.description ?? "",
        priority: variables.priority ?? "medium",
        category: variables.category ?? "",
        dueDate: toLocalDateTimeValue(createdDueDate),
        status: "todo",
      });
      setExpandedSections((current) => ({
        ...current,
        [createdBucket]: true,
      }));
      setDraft(EMPTY_DRAFT);
      setShowCreateDetails(false);
    },
  });

  const updateTodo = trpc.todos.update.useMutation({
    onSuccess: () => void utils.todos.list.invalidate(),
  });

  const deleteTodo = trpc.todos.delete.useMutation({
    onSuccess: (_, variables) => {
      void utils.todos.list.invalidate();
      if (variables.id === selectedTodoId) {
        setSelectedTodoId(null);
        setEditorDraft(null);
      }
    },
  });

  const selectedTodo =
    todos.find((todo) => todo.id === selectedTodoId) ?? null;

  const categories = Array.from(
    new Set([
      ...CATEGORY_OPTIONS,
      ...todos
        .map((todo) => todo.category?.trim())
        .filter((value): value is string => Boolean(value)),
    ])
  );

  const filteredTodos = todos.filter((todo) => {
    const haystack = [todo.title, todo.description, todo.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesQuery = !query || haystack.includes(query.trim().toLowerCase());
    const matchesStatus =
      statusFilter === "all" || (todo.status ?? "todo") === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || (todo.priority ?? "medium") === priorityFilter;
    const matchesCategory =
      categoryFilter === "all" || (todo.category ?? "") === categoryFilter;

    return matchesQuery && matchesStatus && matchesPriority && matchesCategory;
  });

  const groupedTodos = {
    overdue: sortTodos(
      filteredTodos.filter((todo) => getTodoBucket(todo) === "overdue")
    ),
    today: sortTodos(
      filteredTodos.filter((todo) => getTodoBucket(todo) === "today")
    ),
    upcoming: sortTodos(
      filteredTodos.filter((todo) => getTodoBucket(todo) === "upcoming")
    ),
    noDate: sortBacklogTodos(
      filteredTodos.filter((todo) => getTodoBucket(todo) === "noDate")
    ),
    completed: sortBacklogTodos(
      filteredTodos.filter((todo) => getTodoBucket(todo) === "completed")
    ),
  };

  const nextDueTodo =
    sortTodos(
      todos.filter(
        (todo) => (todo.status ?? "todo") !== "done" && Boolean(todo.dueDate)
      )
    )[0] ?? null;

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();

    if (!draft.title.trim()) return;

    createTodo.mutate({
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      priority: draft.priority,
      category: draft.category.trim() || undefined,
      dueDate: fromLocalDateTimeValue(draft.dueDate),
    });
  };

  const cycleStatus = (todo: TodoItem) => {
    const current = (todo.status ?? "todo") as Status;
    const next =
      current === "todo"
        ? "in_progress"
        : current === "in_progress"
          ? "done"
          : "todo";

    updateTodo.mutate({ id: todo.id, status: next });

    if (selectedTodoId === todo.id && editorDraft) {
      setEditorDraft({ ...editorDraft, status: next });
    }
  };

  const handleSaveSelectedTodo = () => {
    if (!selectedTodoId || !editorDraft || !editorDraft.title.trim()) return;

    updateTodo.mutate({
      id: selectedTodoId,
      title: editorDraft.title.trim(),
      description: editorDraft.description.trim() || null,
      priority: editorDraft.priority,
      status: editorDraft.status,
      category: editorDraft.category.trim() || null,
      dueDate: fromLocalDateTimeValue(editorDraft.dueDate) ?? null,
    });
  };

  const sectionConfigs = [
    {
      key: "overdue",
      title: "逾期",
      subtitle: "先拆掉会持续拉低节奏的阻塞项",
      items: groupedTodos.overdue,
      empty: "没有逾期任务",
      icon: TriangleAlert,
      panelTone:
        "border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,242,0.94))] dark:border-rose-900/40 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(69,10,10,0.30))]",
      iconTone:
        "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
      countTone:
        "bg-rose-100/80 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
      railTone: "bg-rose-400/80 dark:bg-rose-500/60",
    },
    {
      key: "today",
      title: "今天",
      subtitle: "保持当天的目标足够轻，能在晚上前收口",
      items: groupedTodos.today,
      empty: "今天没有到期任务",
      icon: SunMedium,
      panelTone:
        "border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.94))] dark:border-amber-900/40 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(69,26,3,0.32))]",
      iconTone:
        "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
      countTone:
        "bg-amber-100/80 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
      railTone: "bg-amber-400/80 dark:bg-amber-500/60",
    },
    {
      key: "upcoming",
      title: "即将到来",
      subtitle: "提前看见排期，减少被临时期限追着跑",
      items: groupedTodos.upcoming,
      empty: "接下来没有排期任务",
      icon: Clock3,
      panelTone:
        "border-sky-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,249,255,0.94))] dark:border-sky-900/40 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,47,73,0.30))]",
      iconTone:
        "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
      countTone:
        "bg-sky-100/80 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
      railTone: "bg-sky-400/80 dark:bg-sky-500/60",
    },
    {
      key: "noDate",
      title: "无时间",
      subtitle: "先保留想法，再决定它值不值得排进日程",
      items: groupedTodos.noDate,
      empty: "所有任务都安排了时间",
      icon: Inbox,
      panelTone:
        "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.68))]",
      iconTone:
        "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
      countTone:
        "bg-slate-100/90 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
      railTone: "bg-slate-400/80 dark:bg-slate-500/60",
    },
    {
      key: "completed",
      title: "已完成",
      subtitle: "把完成项留在底部，既有成就感，也不抢焦点",
      items: groupedTodos.completed,
      empty: "还没有完成的任务",
      icon: CheckCheck,
      panelTone:
        "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.94))] dark:border-emerald-900/40 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(6,78,59,0.28))]",
      iconTone:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
      countTone:
        "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
      railTone: "bg-emerald-400/80 dark:bg-emerald-500/60",
    },
  ] as const;

  const openTaskCount =
    groupedTodos.overdue.length +
    groupedTodos.today.length +
    groupedTodos.upcoming.length +
    groupedTodos.noDate.length;

  useEffect(() => {
    if (!selectedTodoId) return;

    const row = document.querySelector<HTMLElement>(
      `[data-todo-id="${selectedTodoId}"]`
    );

    if (!row) return;

    row.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [selectedTodoId, todos.length]);

  return (
    <div className="relative isolate space-y-6 pb-10 font-[family:var(--font-geist-sans)]">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.30),transparent_34%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.22),transparent_24%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(248,250,252,0))] dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,0))]" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_380px]">
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96)_56%,rgba(255,247,237,0.9))] p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.55)] dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.92)_55%,rgba(30,41,59,0.9))]">
            <div className="absolute -left-14 top-8 h-32 w-32 rounded-full bg-sky-200/50 blur-3xl dark:bg-sky-500/20" />
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-amber-200/50 blur-3xl dark:bg-amber-500/10" />
            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-medium tracking-[0.14em] text-white dark:bg-white dark:text-slate-950">
                  <Sparkles size={14} />
                  TODAY FLOW
                </div>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white md:text-[2.9rem]">
                  Todo
                </h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
                  先把任务录进来，再用时间和状态把注意力放在当下。
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm">
                  <div className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-slate-600 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-300">
                    当前未完成 {openTaskCount} 项
                  </div>
                  <div className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-slate-600 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-300">
                    今天要收口 {groupedTodos.today.length} 项
                  </div>
                  <div className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-slate-600 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-300">
                    已完成 {groupedTodos.completed.length} 项
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px]">
                <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    <span>Focus</span>
                    <Target size={14} />
                  </div>
                  <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
                    {openTaskCount}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    当前还在盘子里的任务量
                  </p>
                </div>
                <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm backdrop-blur dark:border-amber-900/40 dark:bg-amber-950/30">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-amber-500 dark:text-amber-300">
                    <span>Today</span>
                    <SunMedium size={14} />
                  </div>
                  <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-amber-700 dark:text-amber-300">
                    {groupedTodos.today.length}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-amber-700/80 dark:text-amber-200/80">
                    当天必须记得回来的事项
                  </p>
                </div>
                <div className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm backdrop-blur dark:border-emerald-900/40 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-emerald-500 dark:text-emerald-300">
                    <span>Done</span>
                    <CheckCheck size={14} />
                  </div>
                  <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-emerald-700 dark:text-emerald-300">
                    {groupedTodos.completed.length}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-emerald-700/80 dark:text-emerald-200/80">
                    已经收口，可以放心放下
                  </p>
                </div>
              </div>
            </div>
          </section>

          <form
            onSubmit={handleCreate}
            className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.75)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/85"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  快速录入
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  先把事情扔进系统，再决定它是否值得排进时间表。
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                Quick capture
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="flex-1 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/80">
                <label
                  htmlFor="todo-title"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500"
                >
                  Title
                </label>
                <input
                  id="todo-title"
                  type="text"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="添加新任务..."
                  aria-label="Todo 标题"
                  className="w-full bg-transparent text-lg font-medium tracking-[-0.03em] text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row xl:items-stretch">
                <button
                  type="button"
                  onClick={() => setShowCreateDetails((current) => !current)}
                  className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-slate-200 px-5 py-4 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  {showCreateDetails ? (
                    <>
                      收起字段 <ChevronUp size={16} />
                    </>
                  ) : (
                    <>
                      更多字段 <ChevronDown size={16} />
                    </>
                  )}
                </button>
                <button
                  type="submit"
                  disabled={!draft.title.trim() || createTodo.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-slate-950 px-5 py-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <Plus size={16} />
                  添加
                </button>
              </div>
            </div>

            {showCreateDetails && (
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 md:grid-cols-2">
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="补充描述，方便以后接着做"
                  aria-label="Todo 描述"
                  className="md:col-span-2 rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                />
                <select
                  value={draft.category}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  aria-label="Todo 分类"
                  className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                >
                  <option value="">未分类</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      priority: event.target.value as Priority,
                    }))
                  }
                  aria-label="Todo 优先级"
                  className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                >
                  <option value="low">低优先级</option>
                  <option value="medium">中优先级</option>
                  <option value="high">高优先级</option>
                </select>
                <div className="md:col-span-2 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "今天", offset: 0, time: "18:00" },
                      { label: "明天", offset: 1, time: "09:00" },
                      { label: "下周", offset: 7, time: "09:00" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            dueDate: getQuickDueValue(preset.offset, preset.time),
                          }))
                        }
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                      >
                        {preset.label}
                      </button>
                    ))}
                    {draft.dueDate && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({ ...current, dueDate: "" }))
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <X size={14} />
                        清空时间
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <label className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      <Calendar size={16} className="text-slate-400" />
                      <input
                        type="date"
                        value={getDatePart(draft.dueDate)}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            dueDate: joinDateAndTime(
                              event.target.value,
                              getTimePart(current.dueDate) || "09:00"
                            ),
                          }))
                        }
                        aria-label="Todo 截止时间"
                        className="w-full bg-transparent text-slate-900 outline-none dark:text-white"
                      />
                    </label>
                    <select
                      value={getTimePart(draft.dueDate) || "09:00"}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          dueDate: current.dueDate
                            ? joinDateAndTime(
                                getDatePart(current.dueDate),
                                event.target.value
                              )
                            : current.dueDate,
                        }))
                      }
                      aria-label="Todo 截止时刻"
                      disabled={!draft.dueDate}
                      className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </form>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.75)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/85">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    Focus Filters
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    过滤视图，不改变任务本身。
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {filteredTodos.length} 个结果
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,0.82fr))]">
                <label className="flex items-center gap-2 rounded-[20px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                  <Search size={16} />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索标题、描述或分类"
                    aria-label="搜索任务"
                    className="w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="按状态筛选"
                  className="rounded-[20px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                >
                  <option value="all">全部状态</option>
                  <option value="todo">待办</option>
                  <option value="in_progress">进行中</option>
                  <option value="done">已完成</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  aria-label="按优先级筛选"
                  className="rounded-[20px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                >
                  <option value="all">全部优先级</option>
                  <option value="high">高优先级</option>
                  <option value="medium">中优先级</option>
                  <option value="low">低优先级</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  aria-label="按分类筛选"
                  className="rounded-[20px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                >
                  <option value="all">全部分类</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
                加载中...
              </div>
            ) : filteredTodos.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
                {todos.length === 0
                  ? "还没有任务，先把第一个任务记下来。"
                  : "当前筛选条件下没有匹配的任务。"}
              </div>
            ) : (
              <div className="space-y-4">
                {sectionConfigs.map((section) => (
                  <section
                    key={section.key}
                    className={cn(
                      "rounded-[28px] border p-4 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.8)]",
                      section.panelTone
                    )}
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "grid size-11 place-items-center rounded-[18px]",
                            section.iconTone
                          )}
                        >
                          <section.icon size={18} />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                            {section.title}
                          </h2>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {section.subtitle}
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium",
                          section.countTone
                        )}
                      >
                        {section.items.length} 项
                      </div>
                    </div>

                    {section.items.length === 0 ? (
                      <p className="rounded-[22px] border border-dashed border-slate-200/80 px-4 py-4 text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
                        {section.empty}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const previewCount =
                            section.key === "noDate"
                              ? 5
                              : section.key === "completed"
                                ? 4
                                : 6;
                          const shouldExpand =
                            expandedSections[section.key] ||
                            section.items.some((item) => item.id === selectedTodoId);
                          const visibleItems = shouldExpand
                            ? section.items
                            : section.items.slice(0, previewCount);

                          return (
                            <>
                              {visibleItems.map((todo) => {
                          const status = (todo.status ?? "todo") as Status;
                          const priority = (todo.priority ?? "medium") as Priority;
                          const StatusIcon = statusMeta[status].icon;
                          const dueMeta = formatRelativeDueDate(todo.dueDate);

                          return (
                            <div
                              key={todo.id}
                              data-todo-id={todo.id}
                              onClick={() => {
                                setSelectedTodoId(todo.id);
                                setEditorDraft(toEditorDraft(todo));
                              }}
                              className={cn(
                                "group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-[24px] border bg-white/92 p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.6)] backdrop-blur transition duration-200 dark:bg-slate-950/70",
                                selectedTodoId === todo.id
                                  ? "border-sky-300/80 ring-1 ring-sky-200 dark:border-sky-700 dark:ring-sky-900"
                                  : "border-white/70 hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                              )}
                            >
                              <div
                                className={cn(
                                  "absolute inset-y-5 left-0 w-1 rounded-r-full",
                                  section.railTone
                                )}
                              />

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  cycleStatus(todo);
                                }}
                                title="切换状态"
                                className={cn(
                                  "mt-0.5 grid size-10 place-items-center rounded-full border transition",
                                  statusMeta[status].buttonTone
                                )}
                              >
                                <StatusIcon
                                  size={18}
                                  className={cn(status === "done" && "text-emerald-500")}
                                />
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3
                                        className={cn(
                                          "truncate text-[15px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white",
                                          status === "done" &&
                                            "text-slate-400 line-through dark:text-slate-500"
                                        )}
                                      >
                                        {todo.title}
                                      </h3>
                                      {todo.category && (
                                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/50 dark:text-violet-300">
                                          {todo.category}
                                        </span>
                                      )}
                                    </div>

                                    {todo.description && (
                                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        {todo.description}
                                      </p>
                                    )}
                                  </div>

                                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                                    查看
                                    <ArrowUpRight size={13} />
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-1 font-medium",
                                      priorityMeta[priority].badge
                                    )}
                                  >
                                    {priorityMeta[priority].label}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-1 font-medium",
                                      statusMeta[status].badge
                                    )}
                                  >
                                    {statusMeta[status].label}
                                  </span>
                                  {todo.dueDate && (
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium",
                                        dueMeta.tone
                                      )}
                                    >
                                      <Calendar size={12} />
                                      {dueMeta.label}
                                    </span>
                                  )}
                                  <span className="text-slate-400 dark:text-slate-500">
                                    更新于{" "}
                                    {todo.updatedAt
                                      ? formatAbsoluteDate(todo.updatedAt)
                                      : "刚刚"}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteTodo.mutate({ id: todo.id });
                                }}
                                className="rounded-full p-2 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-950/30"
                                title="删除"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          );
                              })}

                              {section.items.length > previewCount && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSections((current) => ({
                                      ...current,
                                      [section.key]: !shouldExpand,
                                    }))
                                  }
                                  className="w-full rounded-[20px] border border-dashed border-slate-200/80 px-4 py-3 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:bg-white/60 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-950/40"
                                >
                                  {shouldExpand
                                    ? `收起 ${section.title}`
                                    : `展开剩余 ${section.items.length - previewCount} 项`}
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/92 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.75)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/90">
            {selectedTodo && editorDraft ? (
              <div>
                <div className="relative overflow-hidden bg-slate-950 px-5 py-5 text-white dark:bg-slate-900">
                  <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-sky-500/20 blur-3xl" />
                  <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-amber-400/20 blur-3xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">
                        任务详情
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                        {selectedTodo.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-white/70">
                        在这里补齐上下文、安排时间，再决定它是推进、延后还是完成。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTodoId(null);
                        setEditorDraft(null);
                      }}
                      className="rounded-full border border-white/10 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                      title="关闭"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="relative mt-4 flex flex-wrap gap-2">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        statusMeta[editorDraft.status].badge
                      )}
                    >
                      {statusMeta[editorDraft.status].label}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        priorityMeta[editorDraft.priority].detailTone
                      )}
                    >
                      {priorityMeta[editorDraft.priority].label}
                    </span>
                    {selectedTodo.category && (
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
                        {selectedTodo.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editorDraft.title}
                      onChange={(event) =>
                        setEditorDraft((current) =>
                          current
                            ? { ...current, title: event.target.value }
                            : current
                        )
                      }
                      aria-label="编辑任务标题"
                      className="w-full rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                    />
                    <textarea
                      value={editorDraft.description}
                      onChange={(event) =>
                        setEditorDraft((current) =>
                          current
                            ? { ...current, description: event.target.value }
                            : current
                        )
                      }
                      rows={4}
                      placeholder="补充更完整的上下文"
                      aria-label="编辑任务描述"
                      className="w-full rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={editorDraft.status}
                        onChange={(event) =>
                          setEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  status: event.target.value as Status,
                                }
                              : current
                          )
                        }
                        aria-label="编辑任务状态"
                        className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                      >
                        <option value="todo">待办</option>
                        <option value="in_progress">进行中</option>
                        <option value="done">已完成</option>
                      </select>
                      <select
                        value={editorDraft.priority}
                        onChange={(event) =>
                          setEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  priority: event.target.value as Priority,
                                }
                              : current
                          )
                        }
                        aria-label="编辑任务优先级"
                        className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                      >
                        <option value="low">低优先级</option>
                        <option value="medium">中优先级</option>
                        <option value="high">高优先级</option>
                      </select>
                    </div>
                    <select
                      value={editorDraft.category}
                      onChange={(event) =>
                        setEditorDraft((current) =>
                          current
                            ? { ...current, category: event.target.value }
                            : current
                        )
                      }
                      aria-label="编辑任务分类"
                      className="w-full rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                    >
                      <option value="">未分类</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: "今天", offset: 0, time: "18:00" },
                          { label: "明天", offset: 1, time: "09:00" },
                          { label: "下周", offset: 7, time: "09:00" },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              setEditorDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      dueDate: getQuickDueValue(
                                        preset.offset,
                                        preset.time
                                      ),
                                    }
                                  : current
                              )
                            }
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                          >
                            {preset.label}
                          </button>
                        ))}
                        {editorDraft.dueDate && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditorDraft((current) =>
                                current ? { ...current, dueDate: "" } : current
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <X size={14} />
                            清空时间
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                        <label className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                          <Calendar size={16} className="text-slate-400" />
                          <input
                            type="date"
                            value={getDatePart(editorDraft.dueDate)}
                            onChange={(event) =>
                              setEditorDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      dueDate: joinDateAndTime(
                                        event.target.value,
                                        getTimePart(current.dueDate) || "09:00"
                                      ),
                                    }
                                  : current
                              )
                            }
                            aria-label="编辑任务截止时间"
                            className="w-full bg-transparent text-slate-900 outline-none dark:text-white"
                          />
                        </label>
                        <select
                          value={getTimePart(editorDraft.dueDate) || "09:00"}
                          onChange={(event) =>
                            setEditorDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    dueDate: current.dueDate
                                      ? joinDateAndTime(
                                          getDatePart(current.dueDate),
                                          event.target.value
                                        )
                                      : current.dueDate,
                                  }
                                : current
                            )
                          }
                          aria-label="编辑任务截止时刻"
                          disabled={!editorDraft.dueDate}
                          className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-700 dark:focus:ring-sky-950"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <div>
                      创建于{" "}
                      {selectedTodo.createdAt
                        ? formatAbsoluteDate(selectedTodo.createdAt)
                        : "未知"}
                    </div>
                    <div className="mt-1">
                      最近更新{" "}
                      {selectedTodo.updatedAt
                        ? formatAbsoluteDate(selectedTodo.updatedAt)
                        : "未知"}
                    </div>
                    {selectedTodo.dueDate && (
                      <div className="mt-1">
                        当前安排 {formatAbsoluteDate(selectedTodo.dueDate)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveSelectedTodo}
                      disabled={!editorDraft.title.trim() || updateTodo.isPending}
                      className="rounded-[22px] bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      保存修改
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTodo.mutate({ id: selectedTodo.id })}
                      className="rounded-[22px] border border-rose-200 px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      删除任务
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-[26px] bg-[linear-gradient(135deg,rgba(15,23,42,1),rgba(30,41,59,0.96))] p-5 text-white">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-[0.18em] text-white/70">
                    <Target size={14} />
                    INSPECTOR
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
                    任务详情
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-white/70">
                    选中左侧任务后，可以在这里补时间、分类、描述，或者直接改状态。
                  </p>
                </div>

                <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm leading-7 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <p>如果只是快速记一下，用上面的标题输入框就够了。</p>
                  <p className="mt-2">
                    {nextDueTodo
                      ? `下一件有明确时间的任务是「${nextDueTodo.title}」，记得先把它安排好。`
                      : "你还没有安排任何截止时间，适合先给最重要的事上时间。"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
