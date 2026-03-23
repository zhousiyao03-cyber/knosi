import { execFileSync } from "child_process";
import { mkdirSync, rmSync } from "fs";
import path from "path";
import {
  PLAYWRIGHT_DB_PATH,
  PLAYWRIGHT_PNPM_BIN,
  PLAYWRIGHT_RUNTIME_PATH,
} from "./test-db";

function removeIfExists(filePath: string) {
  rmSync(filePath, { force: true });
}

export default function globalSetup() {
  mkdirSync(path.dirname(PLAYWRIGHT_DB_PATH), { recursive: true });
  removeIfExists(PLAYWRIGHT_DB_PATH);
  removeIfExists(`${PLAYWRIGHT_DB_PATH}-shm`);
  removeIfExists(`${PLAYWRIGHT_DB_PATH}-wal`);

  execFileSync(PLAYWRIGHT_PNPM_BIN, ["db:push"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: PLAYWRIGHT_RUNTIME_PATH,
      SQLITE_DB_PATH: PLAYWRIGHT_DB_PATH,
    },
    stdio: "inherit",
  });
}
