import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRestoredViewModel,
  calculateNafldFibrosisScore,
  createEmptyFormState,
  interpretScore,
  validateFormState
} from "../tool/lib/calculator.js";

test("calculates the published NAFLD fibrosis score formula", () => {
  const result = calculateNafldFibrosisScore({
    age: 52,
    bmi: 32.4,
    diabetes: true,
    ast: 68,
    alt: 42,
    platelets: 185,
    albumin: 3.8
  });

  assert.equal(result.score.toFixed(12), "1.114457142857");
  assert.equal(result.astAltRatio.toFixed(6), "1.619048");
});

test("classifies scores below the low-risk threshold", () => {
  const interpretation = interpretScore(-1.456);
  assert.equal(interpretation.tone, "low");
});

test("treats the lower cutoff as indeterminate", () => {
  const interpretation = interpretScore(-1.455);
  assert.equal(interpretation.tone, "indeterminate");
});

test("treats the upper cutoff as indeterminate", () => {
  const interpretation = interpretScore(0.676);
  assert.equal(interpretation.tone, "indeterminate");
});

test("classifies scores above the high-risk threshold", () => {
  const interpretation = interpretScore(0.677);
  assert.equal(interpretation.tone, "high");
});

test("rejects ALT zero before ratio calculation", () => {
  const validation = validateFormState({
    age: "52",
    bmi: "32.4",
    diabetes: "yes",
    ast: "68",
    alt: "0",
    platelets: "185",
    albumin: "3.8"
  });

  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.alt, "form.fields.alt.errors.nonzero");
});

test("treats missing inputs as invalid", () => {
  const validation = validateFormState(createEmptyFormState());
  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.age, "form.fields.age.errors.required");
  assert.equal(validation.errors.diabetes, "form.fields.diabetes.errors.required");
});

test("restores valid persisted state and recomputes the result", () => {
  const restored = buildRestoredViewModel({
    age: "45",
    bmi: "28",
    diabetes: "no",
    ast: "30",
    alt: "35",
    platelets: "180",
    albumin: "3.8"
  });

  assert.equal(restored.validation.isValid, true);
  assert.ok(restored.result);
  assert.equal(restored.result.interpretation.tone, "indeterminate");
  assert.equal(restored.result.score.toFixed(6), "-1.377429");
});
