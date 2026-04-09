import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { NotesPageClient } from "@/components/notes/notes-page-client";
import { getRequestSession } from "@/server/auth/request-session";
import { db } from "@/server/db";
import { notes } from "@/server/db/schema";
import { normalizeJournalTitlesForUser } from "@/server/notes/journal-titles";

export default async function NotesPage() {
  const session = await getRequestSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  await normalizeJournalTitlesForUser(userId);
  const initialNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt));

  return <NotesPageClient initialNotes={initialNotes} />;
}
