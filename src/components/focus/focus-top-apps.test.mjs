import test from "node:test";
import assert from "node:assert/strict";

import { buildTopApps, FOCUS_TOP_APPS_LIMIT } from "./focus-top-apps.ts";

test("buildTopApps returns up to ten apps sorted by cumulative duration", () => {
  const sessions = Array.from({ length: 12 }, (_, index) => ({
    appName: `App ${index + 1}`,
    durationSecs: 60 * (index + 1),
  }));

  const result = buildTopApps(sessions);

  assert.equal(result.length, FOCUS_TOP_APPS_LIMIT);
  assert.deepEqual(
    result.map((entry) => entry.appName),
    [
      "App 12",
      "App 11",
      "App 10",
      "App 9",
      "App 8",
      "App 7",
      "App 6",
      "App 5",
      "App 4",
      "App 3",
    ]
  );
});

test("buildTopApps ignores derived focused time and uses recorded app duration", () => {
  const result = buildTopApps([
    {
      appName: "Code",
      durationSecs: 15 * 60,
      focusedSecs: 25 * 60,
    },
    {
      appName: "Chrome",
      durationSecs: 12 * 60,
      focusedSecs: 3 * 60,
    },
  ]);

  assert.deepEqual(result, [
    {
      appName: "Code",
      durationSecs: 15 * 60,
      sessions: 1,
    },
    {
      appName: "Chrome",
      durationSecs: 12 * 60,
      sessions: 1,
    },
  ]);
});
