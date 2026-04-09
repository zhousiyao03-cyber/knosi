"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const SearchDialogModal = dynamic(
  () =>
    import("./search-dialog-modal").then((module) => module.SearchDialogModal),
  {
    ssr: false,
  }
);

export function SearchDialog() {
  const [open, setOpen] = useState(false);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
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

  return <SearchDialogModal onClose={closeDialog} />;
}
