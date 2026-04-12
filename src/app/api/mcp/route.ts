import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { callKnosiMcpTool, KNOSI_MCP_TOOLS } from "@/server/integrations/mcp-tools";
import { OAUTH_SCOPES } from "@/server/integrations/oauth-clients";
import { validateBearerAccessToken } from "@/server/integrations/oauth";

function withMcpHeaders(response: NextResponse, sessionId?: string) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (sessionId) {
    response.headers.set("Mcp-Session-Id", sessionId);
  }
  return response;
}

function jsonRpcResult(id: unknown, result: unknown, sessionId?: string) {
  return withMcpHeaders(NextResponse.json({ jsonrpc: "2.0", id, result }), sessionId);
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return withMcpHeaders(
    NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 })
  );
}

export function GET() {
  const encoder = new TextEncoder();
  const sessionId = randomUUID();
  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      interval = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15_000);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }
    },
  });

  return withMcpHeaders(
    new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        Connection: "keep-alive",
        "Cache-Control": "no-store",
      },
    }),
    sessionId
  );
}

export function OPTIONS() {
  return withMcpHeaders(
    new NextResponse(null, {
      status: 204,
      headers: {
        Allow: "GET, POST, OPTIONS",
      },
    })
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        jsonrpc?: string;
        id?: unknown;
        method?: string;
        params?: Record<string, unknown>;
      }
    | null;

  if (!body?.method) {
    return jsonRpcError(body?.id ?? null, -32600, "Invalid JSON-RPC request");
  }

  if (body.method === "initialize") {
    const sessionId = request.headers.get("mcp-session-id") ?? randomUUID();
    return jsonRpcResult(body.id ?? null, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "knosi-mcp", version: "0.1.0" },
    }, sessionId);
  }

  if (body.method === "tools/list") {
    return jsonRpcResult(body.id ?? null, { tools: KNOSI_MCP_TOOLS });
  }

  if (body.method !== "tools/call") {
    return jsonRpcError(body.id ?? null, -32601, `Unsupported method: ${body.method}`);
  }

  const toolName = String(body.params?.name ?? "");
  const toolArgs =
    body.params?.arguments && typeof body.params.arguments === "object"
      ? (body.params.arguments as Record<string, unknown>)
      : {};

  try {
    const requiredScopes =
      toolName === "save_to_knosi"
        ? [OAUTH_SCOPES.knowledgeWriteInbox]
        : [OAUTH_SCOPES.knowledgeRead];
    const auth = await validateBearerAccessToken({
      authorization: request.headers.get("authorization"),
      requiredScopes,
    });

    const structured = await callKnosiMcpTool({
      userId: auth.userId,
      name: toolName as never,
      arguments: toolArgs,
    });

    return jsonRpcResult(body.id ?? null, {
      content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
      structuredContent: structured,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MCP tool call failed";
    return jsonRpcError(body.id ?? null, -32000, message);
  }
}
