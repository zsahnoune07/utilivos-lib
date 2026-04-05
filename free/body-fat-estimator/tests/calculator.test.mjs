import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRestoredViewModel,
  calculateBodyFat,
  createEmptyFormState,
  inchValuesToImperialFormFields,
  inchValuesToMetricFormFields,
  sanitizePersistedState,
  validateFormState
} from "../tool/lib/calculator.js";

test("sanitize restores defaults for unknown sex", () => {
  const s = sanitizePersistedState({ sex: "other", unit: "metric", heightCm: "170" });
  assert.equal(s.sex, "male");
  assert.equal(s.heightCm, "170");
});

test("male Navy formula matches reference vector (inches)", () => {
  const inchValues = { heightIn: 70, neckIn: 16, abdomenIn: 36 };
  const calc = calculateBodyFat(inchValues, "male");
  assert.equal(calc.ok, true);
  assert.ok(Math.abs(calc.bodyFatPercent - 19.429) < 0.05);
});

test("female Navy formula matches reference vector (inches)", () => {
  const inchValues = { heightIn: 65, neckIn: 14, waistIn: 28, hipIn: 38 };
  const calc = calculateBodyFat(inchValues, "female");
  assert.equal(calc.ok, true);
  assert.ok(Math.abs(calc.bodyFatPercent - 24.513) < 0.08);
});

test("rejects male when abdomen not greater than neck", () => {
  const v = validateFormState({
    ...createEmptyFormState(),
    unit: "imperial",
    sex: "male",
    heightFt: "5",
    heightIn: "10",
    neckIn: "16",
    abdomenIn: "16"
  });
  assert.equal(v.isValid, false);
  assert.ok(v.errors.abdomenIn);
});

test("calculateBodyFat rejects female when waist plus hip not greater than neck", () => {
  const calc = calculateBodyFat(
    { heightIn: 65, neckIn: 40, waistIn: 10, hipIn: 12 },
    "female"
  );
  assert.equal(calc.ok, false);
});

test("inch round-trip metric form fields preserves formula", () => {
  const inchValues = { heightIn: 70, neckIn: 16, abdomenIn: 36 };
  const metric = inchValuesToMetricFormFields(inchValues, "male");
  const v = validateFormState({
    ...createEmptyFormState(),
    unit: "metric",
    sex: "male",
    ...metric
  });
  assert.equal(v.isValid, true);
  const calc = calculateBodyFat(v.values, "male");
  assert.equal(calc.ok, true);
  assert.ok(Math.abs(calc.bodyFatPercent - 19.429) < 0.15);
});

test("inch round-trip imperial form fields for female", () => {
  const inchValues = { heightIn: 65, neckIn: 14, waistIn: 28, hipIn: 38 };
  const imperial = inchValuesToImperialFormFields(inchValues, "female");
  const v = validateFormState({
    ...createEmptyFormState(),
    unit: "imperial",
    sex: "female",
    ...imperial
  });
  assert.equal(v.isValid, true);
  const calc = calculateBodyFat(v.values, "female");
  assert.equal(calc.ok, true);
  assert.ok(Math.abs(calc.bodyFatPercent - 24.58) < 0.12);
});

test("buildRestoredViewModel yields result for valid persisted state", () => {
  const vm = buildRestoredViewModel({
    unit: "imperial",
    sex: "male",
    heightFt: "6",
    heightIn: "0",
    neckIn: "16",
    abdomenIn: "36",
    heightCm: "",
    neckCm: "",
    abdomenCm: "",
    waistCm: "",
    hipCm: "",
    waistIn: "",
    hipIn: ""
  });
  assert.equal(vm.validation.isValid, true);
  assert.equal(vm.result?.ok, true);
  assert.ok(vm.result.bodyFatPercent > 15 && vm.result.bodyFatPercent < 22);
});
