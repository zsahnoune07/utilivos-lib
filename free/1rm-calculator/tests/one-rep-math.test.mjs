import test from "node:test";
import assert from "node:assert/strict";

import {
  computeEstimatesKg,
  createEmptyFormState,
  formatMass,
  fromKg,
  kgToLb,
  lbToKg,
  sanitizePersistedState,
  validateFormState,
} from "../tool/lib/one-rep-math.js";

test("Brzycki: 100 kg × 5 reps → 112.5 kg", () => {
  const r = computeEstimatesKg(100, 5);
  assert.equal(r.brzyckiKg, 112.5);
});

test("Epley: 100 kg × 5 reps → 116.67… kg", () => {
  const r = computeEstimatesKg(100, 5);
  assert.equal(Number(r.epleyKg.toFixed(2)), 116.67);
});

test("Lombardi: 100 kg × 5 reps", () => {
  const r = computeEstimatesKg(100, 5);
  const expected = 100 * 5 ** 0.1;
  assert.ok(Math.abs(r.lombardiKg - expected) < 1e-9);
});

test("reps === 1: all formulas baseline to lifted weight", () => {
  const r = computeEstimatesKg(80, 1);
  assert.equal(r.brzyckiKg, 80);
  assert.equal(Number(r.epleyKg.toFixed(6)), Number((80 * (1 + 1 / 30)).toFixed(6)));
  assert.equal(Number(r.lombardiKg.toFixed(6)), Number((80 * 1 ** 0.1).toFixed(6)));
});

test("lb ↔ kg round-trip is stable for display math", () => {
  const kg = 100;
  const lb = kgToLb(kg);
  assert.ok(Math.abs(lbToKg(lb) - kg) < 1e-6);
});

test("fromKg shows correct unit", () => {
  assert.equal(fromKg(100, "kg"), 100);
  assert.ok(Math.abs(fromKg(100, "lb") - kgToLb(100)) < 1e-6);
});

test("validateFormState rejects empty form", () => {
  const v = validateFormState(createEmptyFormState());
  assert.equal(v.isValid, false);
  assert.equal(v.errors.weight, "form.fields.weight.errors.required");
  assert.equal(v.errors.reps, "form.fields.reps.errors.required");
});

test("validateFormState rejects reps out of range", () => {
  const v = validateFormState({ weight: "100", reps: "20", unit: "kg" });
  assert.equal(v.isValid, false);
  assert.equal(v.errors.reps, "form.fields.reps.errors.range");
});

test("validateFormState rejects non-integer reps", () => {
  const v = validateFormState({ weight: "100", reps: "5.5", unit: "kg" });
  assert.equal(v.isValid, false);
  assert.equal(v.errors.reps, "form.fields.reps.errors.integer");
});

test("validateFormState accepts valid inputs", () => {
  const v = validateFormState({ weight: "100", reps: "5", unit: "kg" });
  assert.equal(v.isValid, true);
  assert.equal(v.values?.weightKg, 100);
  assert.equal(v.values?.reps, 5);
});

test("sanitizePersistedState normalizes unit and strings", () => {
  const s = sanitizePersistedState({ weight: 100, reps: 5, unit: "lb" });
  assert.equal(s.weight, "100");
  assert.equal(s.reps, "5");
  assert.equal(s.unit, "lb");
});

test("formatMass", () => {
  assert.equal(formatMass(112.456, 1), "112.5");
});
