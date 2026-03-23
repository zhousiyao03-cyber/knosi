import { defineConfig } from "drizzle-kit";
import { resolveSqliteDbPath } from "./src/server/db/path";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: resolveSqliteDbPath(),
  },
});
