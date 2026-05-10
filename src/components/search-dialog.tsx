"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { LocalSearchProvider } from "@/components/local-search/provider";

const SearchDialogModal = dynamic(
  () =>
    import("./search-dialog-modal").then((module) => module.SearchDialogModal),
  {
    ssr: false,
  }
);

const LOCAL_SEARCH_PREF_KEY = "knosi.local-search.enabled";

function readLocalSearchPref(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LOCAL_SEARCH_PREF_KEY) === "1";
}

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  // Read once on mount; the dialog itself owns the runtime toggle.
  const [localEnabled, setLocalEnabled] = useState(false);
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);

  const setLocal = useCallback((next: boolean) => {
    setLocalEnabled(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_SEARCH_PREF_KEY, next ? "1" : "0");
    }
  }, []);

  useEffect(() => {
    // Hydrate the user preference from localStorage. We can't initialize the
    // useState directly because localStorage is unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect syncs external storage into local state
    setLocalEnabled(readLocalSearchPref());
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    window.addEventListener("second-brain:open-search", openDialog);
    return () =>
      window.removeEventListener("second-brain:open-search", openDialog);
  }, [openDialog]);

  if (!open) {
    return null;
  }

  // Only mount the LocalSearchProvider while the dialog is open AND the
  // feature is enabled — that's when wasm is actually useful, and it avoids
  // pulling 187 KB of wasm for users who never search.
  return (
    <LocalSearchProvider enabled={localEnabled} userKey={userId ?? "anonymous"}>
      <SearchDialogModal
        onClose={closeDialog}
        localEnabled={localEnabled}
        onToggleLocal={setLocal}
      />
    </LocalSearchProvider>
  );
}
