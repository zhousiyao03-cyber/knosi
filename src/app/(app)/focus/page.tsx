import dynamic from "next/dynamic";
import { FocusGate } from "./_gate";

const FocusPageClient = dynamic(() =>
  import("@/components/focus/focus-page-client").then(
    (m) => m.FocusPageClient
  )
);

export default function FocusPage() {
  return (
    <FocusGate>
      <FocusPageClient />
    </FocusGate>
  );
}
