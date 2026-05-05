"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const HIDDEN_ON_PATHS = ["/ask"];

const FloatingAskAiDockImpl = dynamic(
  () =>
    import("./floating-ask-ai-dock").then((m) => ({
      default: m.FloatingAskAiDock,
    })),
  { ssr: false }
);

export function FloatingAskAiDock() {
  const pathname = usePathname();
  const [shouldMount, setShouldMount] = useState(false);
  const isHidden = HIDDEN_ON_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (shouldMount || isHidden) return;
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setShouldMount(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shouldMount, isHidden]);

  if (isHidden) return null;
  if (shouldMount) return <FloatingAskAiDockImpl />;

  return (
    <button
      type="button"
      aria-label="Ask AI"
      onClick={() => setShouldMount(true)}
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-white shadow-lg transition-transform hover:scale-105 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
    >
      <Sparkles size={20} />
    </button>
  );
}
