import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { notes, osProjectNotes, osProjects } from "@/server/db/schema";

export async function getSharedNoteByToken(token: string) {
  const [note] = await db
    .select({
      title: notes.title,
      content: notes.content,
      cover: notes.cover,
      icon: notes.icon,
      tags: notes.tags,
      type: notes.type,
      sharedAt: notes.sharedAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(eq(notes.shareToken, token));

  return note ?? null;
}

export async function getSharedProjectNoteByToken(token: string) {
  const [note] = await db
    .select({
      id: osProjectNotes.id,
      title: osProjectNotes.title,
      content: osProjectNotes.content,
      plainText: osProjectNotes.plainText,
      tags: osProjectNotes.tags,
      noteType: osProjectNotes.noteType,
      sharedAt: osProjectNotes.sharedAt,
      updatedAt: osProjectNotes.updatedAt,
      projectId: osProjects.id,
      projectName: osProjects.name,
      projectRepoUrl: osProjects.repoUrl,
      projectDescription: osProjects.description,
      projectLanguage: osProjects.language,
    })
    .from(osProjectNotes)
    .innerJoin(osProjects, eq(osProjectNotes.projectId, osProjects.id))
    .where(eq(osProjectNotes.shareToken, token));

  return note ?? null;
}
