import assert from "node:assert/strict";
import test from "node:test";
import { serializeOpsTimestamp, summarizeOverallStatus } from "./page-data";

test("summarizeOverallStatus returns degraded when daemon is stale", () => {
  const result = summarizeOverallStatus({
    services: [
      { name: "knosi", status: "healthy" },
      { name: "redis", status: "healthy" },
      { name: "caddy", status: "healthy" },
      { name: "daemon", status: "degraded" },
    ],
    queue: {
      queued: 0,
      running: 1,
      failedRecent: 0,
    },
    host: { available: true },
    cron: {
      jobsTick: { status: "healthy" },
      cleanupStaleChatTasks: { status: "healthy" },
    },
  });

  assert.equal(result, "degraded");
});

test("summarizeOverallStatus returns healthy when all subsystems are healthy", () => {
  const result = summarizeOverallStatus({
    services: [
      { name: "knosi", status: "healthy" },
      { name: "redis", status: "healthy" },
      { name: "caddy", status: "healthy" },
      { name: "daemon", status: "healthy" },
    ],
    queue: {
      queued: 0,
      running: 0,
      failedRecent: 0,
    },
    host: { available: true },
    cron: {
      jobsTick: { status: "healthy" },
      cleanupStaleChatTasks: { status: "healthy" },
    },
  });

  assert.equal(result, "healthy");
});

test("serializeOpsTimestamp supports date instances", () => {
  const value = new Date("2026-04-16T01:02:03.000Z");

  assert.equal(serializeOpsTimestamp(value), "2026-04-16T01:02:03.000Z");
});

test("serializeOpsTimestamp supports epoch seconds from Turso", () => {
  assert.equal(serializeOpsTimestamp(1776327020), "2026-04-16T08:10:20.000Z");
});

test("serializeOpsTimestamp supports timestamp strings", () => {
  assert.equal(serializeOpsTimestamp("1776327020"), "2026-04-16T08:10:20.000Z");
  assert.equal(serializeOpsTimestamp("2026-04-16T01:02:03.000Z"), "2026-04-16T01:02:03.000Z");
});

test("serializeOpsTimestamp returns null for invalid values", () => {
  assert.equal(serializeOpsTimestamp(null), null);
  assert.equal(serializeOpsTimestamp(undefined), null);
  assert.equal(serializeOpsTimestamp(""), null);
  assert.equal(serializeOpsTimestamp("not-a-date"), null);
});
