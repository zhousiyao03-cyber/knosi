import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_FOCUS_DISPLAY_MIN_SECS,
  getSessionDisplaySecs,
  splitSessionsByDisplayThreshold,
} from "./focus-display.ts";

test("getSessionDisplaySecs prefers focused seconds when present", () => {
  assert.equal(
    getSessionDisplaySecs({
      durationSecs: 1200,
      focusedSecs: 480,
    }),
    480
  );
});

test("splitSessionsByDisplayThreshold keeps sessions at or above ten minutes visible", () => {
  const result = splitSessionsByDisplayThreshold([
    { id: "short", durationSecs: 599 },
    { id: "exact", durationSecs: WEB_FOCUS_DISPLAY_MIN_SECS },
    { id: "long", durationSecs: 1800 },
  ]);

  assert.deepEqual(
    result.visibleSessions.map((session) => session.id),
    ["exact", "long"]
  );
  assert.deepEqual(
    result.hiddenSessions.map((session) => session.id),
    ["short"]
  );
  assert.equal(result.hiddenCount, 1);
  assert.equal(result.hiddenTotalSecs, 599);
});

test("splitSessionsByDisplayThreshold sums hidden sessions using focused seconds", () => {
  const result = splitSessionsByDisplayThreshold([
    { id: "block-a", durationSecs: 900, focusedSecs: 300 },
    { id: "block-b", durationSecs: 720, focusedSecs: 540 },
    { id: "block-c", durationSecs: 1800, focusedSecs: 900 },
  ]);

  assert.deepEqual(
    result.visibleSessions.map((session) => session.id),
    ["block-c"]
  );
  assert.deepEqual(
    result.hiddenSessions.map((session) => session.id),
    ["block-a", "block-b"]
  );
  assert.equal(result.hiddenCount, 2);
  assert.equal(result.hiddenTotalSecs, 840);
});
