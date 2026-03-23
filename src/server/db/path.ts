import path from "path";

export const SQLITE_DB_PATH_ENV = "SQLITE_DB_PATH";
export const DEFAULT_SQLITE_DB_PATH = path.join(
  process.cwd(),
  "data",
  "second-brain.db"
);

export function resolveSqliteDbPath(
  customPath = process.env[SQLITE_DB_PATH_ENV]
) {
  if (!customPath) {
    return DEFAULT_SQLITE_DB_PATH;
  }

  if (path.isAbsolute(customPath)) {
    return customPath;
  }

  return path.resolve(process.cwd(), customPath);
}
