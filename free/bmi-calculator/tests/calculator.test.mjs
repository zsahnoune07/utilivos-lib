import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRestoredViewModel,
  calculateBmi,
  calculateHealthyWeightRange,
  convertFormToMetric,
  convertMetricToImperialValues,
  createEmptyFormState,
  interpretBmi,
  validateFormState
} from "../tool/lib/calculator.js";

test("calculates BMI from valid metric inputs", () => {
  const validation = validateFormState({
    unit: "metric",
    heightCm: "180",
    weightKg: "81"
  });

  assert.equal(validation.isValid, true);

  const result = calculateBmi(validation.values);
  assert.equal(result.bmi.toFixed(3), "25.000");
  assert.equal(result.interpretation.tone, "overweight");
});

test("preserves BMI parity when converting a valid metric state to imperial", () => {
  const metricValidation = validateFormState({
    unit: "metric",
    heightCm: "180",
    weightKg: "81"
  });

  const imperialState = {
    unit: "imperial",
    ...convertMetricToImperialValues(metricValidation.values)
  };
  const restored = buildRestoredViewModel(imperialState);

  assert.equal(restored.validation.isValid, true);
  assert.ok(restored.result);
  assert.ok(Math.abs(restored.result.bmi - 25) < 0.05);
});

test("classifies BMI boundaries using the standard adult ranges", () => {
  assert.equal(interpretBmi(18.49).tone, "underweight");
  assert.equal(interpretBmi(18.5).tone, "healthy");
  assert.equal(interpretBmi(24.9).tone, "healthy");
  assert.equal(interpretBmi(25).tone, "overweight");
  assert.equal(interpretBmi(29.9).tone, "overweight");
  assert.equal(interpretBmi(30).tone, "obesity");
});

test("returns healthy-weight ranges in both kilograms and pounds", () => {
  const range = calculateHealthyWeightRange(180);

  assert.equal(range.minKg.toFixed(3), "59.940");
  assert.equal(range.maxKg.toFixed(3), "80.676");
  assert.equal(range.minLb.toFixed(3), "132.145");
  assert.equal(range.maxLb.toFixed(3), "177.860");
});

test("rejects missing and non-numeric metric inputs", () => {
  const emptyValidation = validateFormState(createEmptyFormState());
  assert.equal(emptyValidation.isValid, false);
  assert.equal(emptyValidation.errors.heightCm, "form.fields.heightCm.errors.required");
  assert.equal(emptyValidation.errors.weightKg, "form.fields.weightKg.errors.required");

  const invalidValidation = validateFormState({
    unit: "metric",
    heightCm: "abc",
    weightKg: "72"
  });
  assert.equal(invalidValidation.isValid, false);
  assert.equal(invalidValidation.errors.heightCm, "form.fields.heightCm.errors.number");
});

test("rejects out-of-range imperial inputs and combined height below the supported adult range", () => {
  const invalidInches = validateFormState({
    unit: "imperial",
    heightFt: "5",
    heightIn: "12",
    weightLb: "160"
  });

  assert.equal(invalidInches.isValid, false);
  assert.equal(invalidInches.errors.heightIn, "form.fields.heightIn.errors.range");

  const tooShort = validateFormState({
    unit: "imperial",
    heightFt: "3",
    heightIn: "0",
    weightLb: "160"
  });

  assert.equal(tooShort.isValid, false);
  assert.equal(tooShort.errors.heightFt, "form.fields.heightFt.errors.combinedRange");
  assert.equal(tooShort.errors.heightIn, "form.fields.heightIn.errors.combinedRange");
});

test("converts imperial form values into metric equivalents", () => {
  const converted = convertFormToMetric({
    unit: "imperial",
    heightFt: "5",
    heightIn: "11",
    weightLb: "176"
  });

  assert.equal(converted.heightCm.toFixed(2), "180.34");
  assert.equal(converted.weightKg.toFixed(3), "79.832");
});

test("restores a valid persisted state and rebuilds the result", () => {
  const restored = buildRestoredViewModel({
    unit: "imperial",
    heightFt: "5",
    heightIn: "8",
    weightLb: "150"
  });

  assert.equal(restored.validation.isValid, true);
  assert.ok(restored.result);
  assert.equal(restored.result.interpretation.tone, "healthy");
  assert.equal(restored.result.bmi.toFixed(3), "22.807");
});
