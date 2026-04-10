import { redirect } from "next/navigation";
import { getRequestSession } from "@/server/auth/request-session";
import { GraphViewClient } from "@/components/notes/graph-view-client";

export default async function GraphPage() {
  const session = await getRequestSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <GraphViewClient />;
}
