import { db } from "../db";
import { notes, bookmarks } from "../db/schema";

export interface RetrievalResult {
  id: string;
  type: "note" | "bookmark";
  title: string;
  content: string;
  matchScore: number;
}

const MAX_RESULTS = 5;
const MAX_CONTENT_LENGTH = 2000;

function tokenize(query: string): string[] {
  return query
    .split(/[\s,，。！？、；：""''（）\[\]{}·…—\-_/\\|@#$%^&*+=<>~`!?.;:'"()]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2);
}

export async function retrieveContext(query: string): Promise<RetrievalResult[]> {
  const words = tokenize(query);
  if (words.length === 0) return [];

  // Fetch all notes and bookmarks
  const allNotes = await db.select().from(notes);
  const allBookmarks = await db.select().from(bookmarks);

  const results: RetrievalResult[] = [];

  for (const note of allNotes) {
    const searchable = [note.title, note.plainText].filter(Boolean).join(" ").toLowerCase();
    const matchScore = words.filter((w) => searchable.includes(w)).length;
    if (matchScore > 0) {
      results.push({
        id: note.id,
        type: "note",
        title: note.title,
        content: (note.plainText ?? "").slice(0, MAX_CONTENT_LENGTH),
        matchScore,
      });
    }
  }

  for (const bm of allBookmarks) {
    const searchable = [bm.title, bm.content, bm.summary].filter(Boolean).join(" ").toLowerCase();
    const matchScore = words.filter((w) => searchable.includes(w)).length;
    if (matchScore > 0) {
      results.push({
        id: bm.id,
        type: "bookmark",
        title: bm.title ?? bm.url ?? "无标题",
        content: (bm.content ?? bm.summary ?? "").slice(0, MAX_CONTENT_LENGTH),
        matchScore,
      });
    }
  }

  // Sort by match score descending, take top N
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, MAX_RESULTS);
}
