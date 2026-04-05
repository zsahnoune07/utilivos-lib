import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRestoredViewModel,
  calculateFib4,
  createEmptyFormState,
  interpretScore,
  validateFormState
} from "../tool/lib/calculator.js";

test("calculates the published FIB-4 formula", () => {
  const result = calculateFib4({
    age: 50,
    ast: 80,
    alt: 50,
    platelets: 150
  });

  assert.equal(result.score.toFixed(12), "3.771236166328");
  assert.equal(result.sqrtAlt.toFixed(6), "7.071068");
});

test("classifies scores below the low cutoff", () => {
  assert.equal(interpretScore(1.44).tone, "low");
});

test("treats the lower cutoff as indeterminate", () => {
  assert.equal(interpretScore(1.45).tone, "indeterminate");
});

test("treats the upper cutoff as indeterminate", () => {
  assert.equal(interpretScore(3.25).tone, "indeterminate");
});

test("classifies scores above the high cutoff", () => {
  assert.equal(interpretScore(3.26).tone, "high");
});

test("rejects ALT zero", () => {
  const validation = validateFormState({
    age: "50",
    ast: "80",
    alt: "0",
    platelets: "150"
  });
  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.alt, "form.fields.alt.errors.nonzero");
});

test("treats missing inputs as invalid", () => {
  const validation = validateFormState(createEmptyFormState());
  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.age, "form.fields.age.errors.required");
});

test("restores valid persisted state and recomputes the result", () => {
  const restored = buildRestoredViewModel({
    age: "40",
    ast: "50",
    alt: "45",
    platelets: "200"
  });

  assert.equal(restored.validation.isValid, true);
  assert.ok(restored.result);
  assert.equal(restored.result.interpretation.tone, "indeterminate");
  assert.equal(restored.result.score.toFixed(6), "1.490712");
});
