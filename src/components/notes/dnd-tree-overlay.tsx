"use client";

import { DragOverlay } from "@dnd-kit/core";
import { Folder, FileText } from "lucide-react";

interface DndTreeOverlayProps {
  activeId: string | null;
  activeType: "folder" | "note" | null;
  activeLabel: string;
}

export function DndTreeOverlay({
  activeId,
  activeType,
  activeLabel,
}: DndTreeOverlayProps) {
  if (!activeId || !activeType) return null;

  return (
    <DragOverlay dropAnimation={null}>
      <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 shadow-lg dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300">
        {activeType === "folder" ? (
          <Folder size={14} />
        ) : (
          <FileText size={14} />
        )}
        <span className="max-w-[200px] truncate">
          {activeLabel || "Untitled"}
        </span>
      </div>
    </DragOverlay>
  );
}
