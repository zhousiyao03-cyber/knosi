import { and, eq } from "drizzle-orm";
import { normalizeAutoJournalTitle } from "@/lib/note-templates";
import { db } from "../db";
import { notes } from "../db/schema";

export async function normalizeJournalTitlesForUser(userId: string) {
  const journalNotes = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.type, "journal")));

  for (const journal of journalNotes) {
    const normalizedTitle = normalizeAutoJournalTitle(journal.title);
    if (!normalizedTitle || normalizedTitle === journal.title) {
      continue;
    }

    await db
      .update(notes)
      .set({ title: normalizedTitle })
      .where(eq(notes.id, journal.id));
  }
}
