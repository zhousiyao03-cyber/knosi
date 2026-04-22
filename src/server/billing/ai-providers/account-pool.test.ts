import { describe, expect, it } from "vitest";
import { parsePool, pickAccountForUser } from "./account-pool";

describe("account-pool", () => {
  it("parses comma-separated env", () => {
    const pool = parsePool("a,b, c ");
    expect(pool.map((p) => p.name)).toEqual(["a", "b", "c"]);
  });

  it("empty env → empty pool", () => {
    expect(parsePool(undefined)).toEqual([]);
    expect(parsePool("")).toEqual([]);
  });

  it("picks deterministically by userId", () => {
    const pool = parsePool("a,b,c,d");
    const first = pickAccountForUser(pool, "user-1");
    const second = pickAccountForUser(pool, "user-1");
    expect(first?.name).toBe(second?.name);
  });

  it("distributes across pool", () => {
    const pool = parsePool("a,b,c,d");
    const names = new Set(
      Array.from({ length: 100 }, (_, i) => pickAccountForUser(pool, `user-${i}`)!.name),
    );
    expect(names.size).toBeGreaterThan(1);
  });

  it("null pool → null account", () => {
    expect(pickAccountForUser([], "user")).toBeNull();
  });
});
