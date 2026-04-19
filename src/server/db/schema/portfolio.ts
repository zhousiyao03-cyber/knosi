import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const portfolioHoldings = sqliteTable(
  "portfolio_holdings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    assetType: text("asset_type", { enum: ["stock", "crypto"] }).notNull(),
    quantity: real("quantity").notNull(),
    costPrice: real("cost_price").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("portfolio_holdings_user_idx").on(table.userId),
    index("portfolio_holdings_user_symbol_idx").on(table.userId, table.symbol),
  ]
);

export const portfolioNews = sqliteTable(
  "portfolio_news",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    summary: text("summary").notNull(),
    sentiment: text("sentiment", { enum: ["bullish", "bearish", "neutral"] }).notNull(),
    generatedAt: integer("generated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("portfolio_news_user_idx").on(table.userId),
    index("portfolio_news_user_symbol_idx").on(table.userId, table.symbol),
  ]
);
