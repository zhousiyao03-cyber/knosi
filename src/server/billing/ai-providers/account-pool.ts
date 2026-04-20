import crypto from "node:crypto";

export type PoolAccount = {
  name: string;
  authPath: string;          // ~/.openclaw/<name> or an env-resolved path
};

export function parsePool(env: string | undefined): PoolAccount[] {
  if (!env) return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, authPath: `~/.openclaw/${name}` }));
}

export function pickAccountForUser(pool: PoolAccount[], userId: string): PoolAccount | null {
  if (pool.length === 0) return null;
  const hash = crypto.createHash("sha256").update(userId).digest();
  const index = hash.readUInt32BE(0) % pool.length;
  return pool[index];
}
