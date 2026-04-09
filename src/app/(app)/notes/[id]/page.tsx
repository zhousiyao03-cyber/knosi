import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { NoteEditorPageClient } from "@/components/notes/note-editor-page-client";
import { getRequestSession } from "@/server/auth/request-session";
import { db } from "@/server/db";
import { notes } from "@/server/db/schema";
import { normalizeJournalTitlesForUser } from "@/server/notes/journal-titles";

export default async function NoteEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getRequestSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { id } = await params;
  await normalizeJournalTitlesForUser(userId);
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));

  return <NoteEditorPageClient id={id} initialNote={note ?? null} />;
}
