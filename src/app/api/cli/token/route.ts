import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateCliToken } from "@/server/ai/cli-auth";

/**
 * POST /api/cli/token — Generate a new CLI auth token.
 * Requires browser session (user must be logged in).
 * Returns the raw token once — it cannot be retrieved again.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await generateCliToken(session.user.id);

  return NextResponse.json({ token });
}
