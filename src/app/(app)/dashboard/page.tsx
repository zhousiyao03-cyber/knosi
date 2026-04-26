import { count, desc, eq } from "drizzle-orm";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";
import { getRequestSession } from "@/server/auth/request-session";
import { db } from "@/server/db";
import { notes } from "@/server/db/schema";
import { normalizeJournalTitlesForUser } from "@/server/notes/journal-titles";

export default async function DashboardPage() {
  // Auth is guaranteed by (app) layout guard
  const session = (await getRequestSession())!;
  const userId = session.user!.id!;

  await normalizeJournalTitlesForUser(userId);

  const [noteCount] = await db
    .select({ count: count() })
    .from(notes)
    .where(eq(notes.userId, userId));

  const recentNotes = await db
    .select({
      id: notes.id,
      title: notes.title,
      folder: notes.folder,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt))
    .limit(15);

  const initialStats = {
    counts: {
      notes: noteCount.count,
    },
    recentNotes,
    tokenStats: { capturedNotes: 0, capturedTokens: 0, avgPerDay: 0 },
  };

  return (
    <DashboardPageClient
      initialStats={initialStats}
      identity={{
        email: session.user?.email,
        name: session.user?.name,
      }}
    />
  );
}
