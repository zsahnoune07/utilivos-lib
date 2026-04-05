import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeHeartRateZones,
  estimateMaxHeartRate,
  sanitizePersistedState,
  validateFormState,
  ZONE_BANDS
} from "../tool/lib/calculator.js";

describe("estimateMaxHeartRate", () => {
  it("uses 220 minus age", () => {
    assert.equal(estimateMaxHeartRate(20), 200);
    assert.equal(estimateMaxHeartRate(40), 180);
  });
});

describe("validateFormState", () => {
  it("accepts valid inputs", () => {
    const v = validateFormState({ age: "35", restingBpm: "60" });
    assert.equal(v.isValid, true);
    assert.deepEqual(v.values, { age: 35, restingBpm: 60, maxHr: 185 });
  });

  it("rejects empty fields", () => {
    const v = validateFormState({ age: "", restingBpm: "" });
    assert.equal(v.isValid, false);
    assert.ok(v.errors.age);
    assert.ok(v.errors.restingBpm);
  });

  it("rejects age out of range", () => {
    const v = validateFormState({ age: "12", restingBpm: "60" });
    assert.equal(v.isValid, false);
    assert.ok(v.errors.age);
  });

  it("rejects resting HR out of range", () => {
    const v = validateFormState({ age: "30", restingBpm: "130" });
    assert.equal(v.isValid, false);
    assert.ok(v.errors.restingBpm);
  });

  it("rejects resting HR at or above estimated max HR", () => {
    const v = validateFormState({ age: "100", restingBpm: "120" });
    assert.equal(v.isValid, false);
    assert.equal(v.errors.restingBpm, "form.errors.restingVsMax");
  });

  it("rejects non-integer age", () => {
    const v = validateFormState({ age: "35.5", restingBpm: "60" });
    assert.equal(v.isValid, false);
    assert.ok(v.errors.age);
  });
});

describe("computeHeartRateZones", () => {
  it("returns five zones with expected BPM for age 40, resting 60", () => {
    const maxHr = 180;
    const hrr = 120;
    const out = computeHeartRateZones({ age: 40, restingBpm: 60, maxHr });
    assert.equal(out.ok, true);
    assert.equal(out.maxHr, maxHr);
    assert.equal(out.hrr, hrr);
    assert.equal(out.zones.length, ZONE_BANDS.length);

    assert.deepEqual(
      out.zones.map((z) => ({ id: z.id, bpmLow: z.bpmLow, bpmHigh: z.bpmHigh })),
      [
        { id: "z1", bpmLow: 120, bpmHigh: 132 },
        { id: "z2", bpmLow: 132, bpmHigh: 144 },
        { id: "z3", bpmLow: 144, bpmHigh: 156 },
        { id: "z4", bpmLow: 156, bpmHigh: 168 },
        { id: "z5", bpmLow: 168, bpmHigh: 180 }
      ]
    );
  });

  it("fails when heart rate reserve is not positive", () => {
    const out = computeHeartRateZones({ age: 30, restingBpm: 60, maxHr: 60 });
    assert.equal(out.ok, false);
    assert.equal(out.errorKey, "form.errors.invalidReserve");
  });
});

describe("sanitizePersistedState", () => {
  it("returns empty state for null", () => {
    const s = sanitizePersistedState(null);
    assert.equal(s.age, "");
    assert.equal(s.restingBpm, "");
  });
});
