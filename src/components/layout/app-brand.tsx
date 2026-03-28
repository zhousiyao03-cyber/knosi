import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppBrandProps {
  compact?: boolean;
  className?: string;
}

export function AppBrand({ compact = false, className }: AppBrandProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-stone-300/80 bg-stone-100 text-stone-700 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.55)] dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
        <div className="absolute inset-x-0 top-0 h-4 bg-linear-to-b from-cyan-200/80 to-transparent dark:from-cyan-400/20" />
        <div className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-500/80 dark:bg-cyan-300/80" />
        <BrainCircuit className="relative h-5 w-5" strokeWidth={1.9} />
      </div>

      {compact ? null : (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
            Second Brain
          </div>
          <div className="truncate text-xs text-stone-500 dark:text-stone-400">
            Your workspace
          </div>
        </div>
      )}
    </div>
  );
}
