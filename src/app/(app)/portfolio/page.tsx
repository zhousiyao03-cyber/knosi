import { Metadata } from "next";
import { PortfolioClient } from "./_client";
import { PortfolioGate } from "./_gate";

export const metadata: Metadata = {
  title: "Portfolio",
};

export default function PortfolioPage() {
  return (
    <PortfolioGate>
      <PortfolioClient />
    </PortfolioGate>
  );
}
