import { NextResponse } from "next/server";
import { shouldUseDaemonForChat } from "@/server/ai/daemon-mode";

export async function GET() {
  return NextResponse.json({
    chatMode: shouldUseDaemonForChat() ? "daemon" : "stream",
  });
}
