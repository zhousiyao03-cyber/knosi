/**
 * Regression tests for the 2026-04-28 privacy hardening pass.
 *
 * These guard the observable contracts of three concerns that drove the fix:
 *  1. Share tokens must not be enumerated in sitemap.xml.
 *  2. /share/ must be disallowed in robots.txt and tagged noindex per page.
 *  3. The CLI authorize page must opt out of Referer leaks.
 *
 * They're vitest unit tests rather than e2e because the pieces under test are
 * all pure functions / static metadata exports — there's no UI flow to drive.
 */

import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { metadata as sharedNoteMetadata } from "@/app/share/[token]/page";
import { metadata as sharedProjectNoteMetadata } from "@/app/share/project-note/[token]/page";
import { metadata as cliAuthMetadata } from "@/app/(app)/cli/auth/layout";

describe("privacy hardening — sitemap.ts", () => {
  it("returns only static marketing/legal URLs (no /share/<token>)", () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.url).not.toMatch(/\/share\//);
    }
    // Sanity-check: at least the homepage and pricing are still present.
    expect(entries.find((e) => e.url.endsWith("/"))).toBeDefined();
    expect(entries.find((e) => e.url.endsWith("/pricing"))).toBeDefined();
  });

  it("is synchronous (no longer hits the database)", () => {
    // If sitemap() returns a Promise, someone re-introduced the DB enumeration.
    const result = sitemap();
    expect(result).not.toBeInstanceOf(Promise);
  });
});

describe("privacy hardening — robots.ts", () => {
  it("disallows /share/ for all crawlers", () => {
    const config = robots();
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    expect(rule).toBeDefined();
    expect(rule!.userAgent).toBe("*");
    const disallow = Array.isArray(rule!.disallow)
      ? rule!.disallow
      : [rule!.disallow as string];
    expect(disallow).toContain("/share/");
  });

  it("does not allow /share/ (must not appear in allow rules)", () => {
    const config = robots();
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    const allow = Array.isArray(rule!.allow)
      ? rule!.allow
      : [rule!.allow as string];
    expect(allow).not.toContain("/share/");
  });
});

describe("privacy hardening — share page metadata", () => {
  it("/share/[token] page exports robots.index = false", () => {
    expect(sharedNoteMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it("/share/project-note/[token] page exports robots.index = false", () => {
    expect(sharedProjectNoteMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
});

describe("privacy hardening — CLI auth layout metadata", () => {
  it("sets Referrer-Policy: no-referrer to keep session_id out of Referer", () => {
    expect(cliAuthMetadata.referrer).toBe("no-referrer");
  });

  it("is also marked noindex (defense in depth)", () => {
    expect(cliAuthMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
});
