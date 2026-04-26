import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/public-origin";
import { OAUTH_SCOPES } from "@/server/integrations/oauth-clients";

// Next.js treats GET route handlers that only use `request.headers.get(...)`
// (Web API) as static by default — a first-hit response gets cached and
// served for the pod's lifetime. We've seen that cache pin an old `http://`
// body even after a fresh image shipped the AUTH_URL-aware `getPublicOrigin`.
// Force dynamic so the origin is recomputed on every request.
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPES.knowledgeRead, OAUTH_SCOPES.knowledgeWriteInbox],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/docs`,
  });
}
