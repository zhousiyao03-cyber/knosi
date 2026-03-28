import { redirect } from "next/navigation";
import TokenUsageClient from "./_client";

export default function TokenUsagePage() {
  if (process.env.ENABLE_TOKEN_USAGE !== "true") {
    redirect("/");
  }

  return <TokenUsageClient />;
}
