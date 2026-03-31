import test from "node:test";
import assert from "node:assert/strict";
import { getWorkingHoursBaselineCopy } from "./focus-working-hours.ts";

test("working-hours baseline copy uses workHoursSecs rather than tracked total", () => {
  assert.equal(
    getWorkingHoursBaselineCopy(4 * 3600 + 44 * 60),
    "3h 16m left to reach 8h."
  );
});

test("working-hours baseline copy reports goal reached after eight hours", () => {
  assert.equal(
    getWorkingHoursBaselineCopy(8 * 3600 + 5 * 60),
    "Past the 8h working-hours baseline."
  );
});

test("working-hours baseline copy handles missing data", () => {
  assert.equal(getWorkingHoursBaselineCopy(null), "Waiting for more data.");
});
