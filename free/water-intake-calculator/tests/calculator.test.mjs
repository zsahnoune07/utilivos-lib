import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRestoredViewModel,
  calculateWaterIntake,
  createEmptyFormState,
  poundsToKg,
  sanitizePersistedState,
  validateFormState
} from "../tool/lib/calculator.js";

test("converts pounds to kilograms", () => {
  const kg = poundsToKg(154);
  assert.ok(kg > 69.8 && kg < 69.9);
});

test("computes baseline plus activity for metric weight", () => {
  const result = calculateWaterIntake({
    unit: "metric",
    weightKg: 70,
    sex: "unspecified",
    activity: "moderate",
    climate: "temperate",
    pregnancy: "none"
  });

  assert.equal(result.breakdown.baseMl, 70 * 33);
  assert.equal(result.breakdown.activityMl, 500);
  assert.equal(result.breakdown.climateMl, 0);
  assert.equal(result.breakdown.pregnancyMl, 0);
  assert.equal(result.totalMl, 70 * 33 + 500);
});

test("uses female ml per kg and hot climate add-on", () => {
  const result = calculateWaterIntake({
    unit: "metric",
    weightKg: 60,
    sex: "female",
    activity: "sedentary",
    climate: "hot",
    pregnancy: "none"
  });

  assert.equal(result.breakdown.mlPerKg, 31);
  assert.equal(result.breakdown.baseMl, 60 * 31);
  assert.equal(result.totalMl, 60 * 31 + 400);
});

test("adds pregnancy and breastfeeding amounts", () => {
  const pregnant = calculateWaterIntake({
    unit: "metric",
    weightKg: 65,
    sex: "unspecified",
    activity: "light",
    climate: "temperate",
    pregnancy: "pregnant"
  });
  assert.equal(pregnant.breakdown.pregnancyMl, 300);
  assert.equal(pregnant.totalMl, 65 * 33 + 250 + 300);

  const nursing = calculateWaterIntake({
    unit: "metric",
    weightKg: 65,
    sex: "unspecified",
    activity: "light",
    climate: "temperate",
    pregnancy: "breastfeeding"
  });
  assert.equal(nursing.breakdown.pregnancyMl, 800);
});

test("rejects missing weight", () => {
  const validation = validateFormState(createEmptyFormState());
  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.weightKg, "form.fields.weightKg.errors.required");
});

test("rejects out-of-range kg weight", () => {
  const validation = validateFormState(
    sanitizePersistedState({
      unit: "metric",
      weightKg: "10",
      weightLb: "",
      sex: "unspecified",
      activity: "moderate",
      climate: "temperate",
      pregnancy: "none"
    })
  );
  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.weightKg, "form.fields.weightKg.errors.range");
});

test("restores valid state and recomputes", () => {
  const restored = buildRestoredViewModel({
    unit: "metric",
    weightKg: "68",
    weightLb: "",
    sex: "male",
    activity: "active",
    climate: "hot",
    pregnancy: "none"
  });

  assert.equal(restored.validation.isValid, true);
  assert.ok(restored.result);
  assert.equal(restored.result.breakdown.mlPerKg, 35);
  assert.equal(restored.result.breakdown.activityMl, 750);
  assert.equal(restored.result.breakdown.climateMl, 400);
  assert.equal(restored.result.totalMl, Math.round(68 * 35 + 750 + 400));
});
