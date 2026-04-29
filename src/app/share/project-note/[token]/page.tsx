import type { Metadata } from "next";
import { SharedProjectNoteView } from "@/components/share/shared-project-note-view";
import { getSharedProjectNoteByToken } from "@/server/shares";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
    nocache: true,
  },
};

export default async function SharedProjectNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const note = await getSharedProjectNoteByToken(token);

  return <SharedProjectNoteView note={note} />;
}
