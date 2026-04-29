import type { Metadata } from "next";
import { SharedNoteView } from "@/components/share/shared-note-view";
import { getSharedNoteByToken } from "@/server/shares";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
    nocache: true,
  },
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const note = await getSharedNoteByToken(token);

  return <SharedNoteView note={note} />;
}
