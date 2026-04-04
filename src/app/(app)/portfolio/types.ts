export type AssetType = "stock" | "crypto";
export type Sentiment = "bullish" | "bearish" | "neutral";

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType | null;
  quantity: number;
  costPrice: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PriceData {
  price: number | null;
  changePercent: number | null;
}

export interface NewsItem {
  id: string;
  symbol: string;
  summary: string;
  sentiment: Sentiment | null;
  generatedAt: Date | null;
}

export interface AddHoldingDraft {
  symbol: string;
  name: string;
  assetType: AssetType;
  quantity: string;
  costPrice: string;
}

export interface EditHoldingDraft {
  quantity: string;
  costPrice: string;
}

export interface HoldingSnapshot {
  holding: Holding;
  priceData: PriceData | undefined;
  currentPrice: number | null;
  changePercent: number | null;
  currentValue: number | null;
  costValue: number;
  displayValue: number;
  pnl: number | null;
  pnlPercent: number | null;
  dailyChange: number | null;
  portfolioWeight: number | null;
}
