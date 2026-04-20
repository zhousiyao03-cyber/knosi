// src/server/billing/quota.test.ts
import { describe, expect, it } from "vitest";
import { PRO_UNLIMITED } from "./entitlements";
import { assertQuota } from "./quota";

const freeEnt = {
  plan: "free" as const,
  source: "hosted-free" as const,
  limits: { askAiPerDay: 20, notes: 50, storageMB: 100, shareLinks: 3 },
  features: {
    portfolio: false,
    focusTracker: false,
    ossProjects: false,
    claudeCapture: false,
    knosiProvidedAi: false,
  },
};

describe("assertQuota", () => {
  it("passes under limit", () => {
    expect(() => assertQuota(freeEnt, "notes", 49, 1)).not.toThrow();
  });

  it("passes exactly at limit − delta", () => {
    expect(() => assertQuota(freeEnt, "notes", 49, 1)).not.toThrow();
  });

  it("throws when delta exceeds", () => {
    expect(() => assertQuota(freeEnt, "notes", 50, 1)).toThrow(/QUOTA_EXCEEDED/);
  });

  it("throws with multi-unit delta", () => {
    expect(() => assertQuota(freeEnt, "storageMB", 95, 10)).toThrow(/QUOTA_EXCEEDED/);
  });

  it("no-op on unlimited (self-hosted)", () => {
    expect(() => assertQuota(PRO_UNLIMITED, "notes", 99999, 100)).not.toThrow();
  });
});
