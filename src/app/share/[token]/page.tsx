import { SharedNoteView } from "@/components/share/shared-note-view";
import { getSharedNoteByToken } from "@/server/shares";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const note = await getSharedNoteByToken(token);

  return <SharedNoteView note={note} />;
}
