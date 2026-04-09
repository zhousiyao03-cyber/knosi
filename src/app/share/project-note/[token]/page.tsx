import { SharedProjectNoteView } from "@/components/share/shared-project-note-view";
import { getSharedProjectNoteByToken } from "@/server/shares";

export default async function SharedProjectNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const note = await getSharedProjectNoteByToken(token);

  return <SharedProjectNoteView note={note} />;
}
