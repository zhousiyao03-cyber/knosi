import { AskPageClient } from "@/components/ask/ask-page-client";
import { shouldUseDaemonForChat } from "@/server/ai/daemon-mode";

export default function AskPage() {
  return (
    <AskPageClient
      chatMode={shouldUseDaemonForChat() ? "daemon" : "stream"}
    />
  );
}
