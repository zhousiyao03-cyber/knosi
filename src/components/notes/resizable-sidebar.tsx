"use client";

import { useState, useRef, useEffect } from "react";

const STORAGE_KEY = "notes-sidebar-width";
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 224; // ~w-56

interface ResizableSidebarProps {
  children: React.ReactNode;
  className?: string;
}

export function ResizableSidebar({ children, className }: ResizableSidebarProps) {
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
    }
    return DEFAULT_WIDTH;
  });

  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidth.current + delta)
      );
      setWidth(newWidth);
    };

    const handlePointerUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(STORAGE_KEY, String(width));
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [width]);

  return (
    <div className={className} style={{ width, flexShrink: 0, position: "relative" }}>
      {children}
      {/* Resize handle */}
      <div
        onPointerDown={handlePointerDown}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50"
        style={{ zIndex: 10 }}
      />
    </div>
  );
}
