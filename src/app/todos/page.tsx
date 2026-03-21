"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const priorityColors = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

const statusIcons = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2,
};

export default function TodosPage() {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const utils = trpc.useUtils();
  const { data: todos = [], isLoading } = trpc.todos.list.useQuery();
  const createTodo = trpc.todos.create.useMutation({
    onSuccess: () => {
      utils.todos.list.invalidate();
      setTitle("");
    },
  });
  const updateTodo = trpc.todos.update.useMutation({
    onSuccess: () => utils.todos.list.invalidate(),
  });
  const deleteTodo = trpc.todos.delete.useMutation({
    onSuccess: () => utils.todos.list.invalidate(),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTodo.mutate({ title: title.trim(), priority });
  };

  const cycleStatus = (id: string, current: string) => {
    const next =
      current === "todo" ? "in_progress" : current === "in_progress" ? "done" : "todo";
    updateTodo.mutate({ id, status: next as "todo" | "in_progress" | "done" });
  };

  const filtered = todos.filter((todo) => {
    const matchesStatus = statusFilter === "all" || todo.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || todo.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Todo</h1>

      <form onSubmit={handleCreate} className="flex items-center gap-2 mb-6">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="添加新任务..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
        <button
          type="submit"
          disabled={!title.trim() || createTodo.isPending}
          className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} />
          添加
        </button>
      </form>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">全部状态</option>
          <option value="todo">待办</option>
          <option value="in_progress">进行中</option>
          <option value="done">已完成</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">全部优先级</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">加载中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          {todos.length === 0 ? "还没有任务，添加一个吧" : "没有匹配的任务"}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((todo) => {
            const StatusIcon = statusIcons[(todo.status ?? "todo") as keyof typeof statusIcons] ?? Circle;
            return (
              <div
                key={todo.id}
                className={cn(
                  "flex items-center gap-3 p-3 border border-gray-200 rounded-lg group",
                  todo.status === "done" && "opacity-60"
                )}
              >
                <button
                  onClick={() => cycleStatus(todo.id, todo.status ?? "todo")}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                  title="切换状态"
                >
                  <StatusIcon size={20} className={todo.status === "done" ? "text-green-500" : ""} />
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      todo.status === "done" && "line-through text-gray-400"
                    )}
                  >
                    {todo.title}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-xs rounded",
                        priorityColors[(todo.priority ?? "medium") as keyof typeof priorityColors]
                      )}
                    >
                      {todo.priority === "high" ? "高" : todo.priority === "low" ? "低" : "中"}
                    </span>
                    {todo.dueDate && (
                      <span className="text-xs text-gray-400">{formatDate(todo.dueDate)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteTodo.mutate({ id: todo.id })}
                  className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
