export const STORAGE_KEY = "utilivo.fib4-index.v1";

const NUMERIC_FIELD_CONFIG = {
  age: { min: 18, max: 120, integer: true, errorBase: "form.fields.age.errors" },
  ast: { min: 0.1, max: 2000, errorBase: "form.fields.ast.errors" },
  alt: { min: 0.1, max: 2000, errorBase: "form.fields.alt.errors" },
  platelets: { min: 1, max: 1000, errorBase: "form.fields.platelets.errors" }
};

export const FIELD_IDS = ["age", "ast", "alt", "platelets"];

export function createEmptyFormState() {
  return {
    age: "",
    ast: "",
    alt: "",
    platelets: ""
  };
}

export function hasAnyInputValue(formState) {
  return FIELD_IDS.some((fieldId) => String(formState[fieldId] ?? "").trim().length > 0);
}

export function sanitizePersistedState(rawState) {
  const empty = createEmptyFormState();
  if (!rawState || typeof rawState !== "object") {
    return empty;
  }

  const sanitized = { ...empty };
  for (const fieldId of FIELD_IDS) {
    sanitized[fieldId] = String(rawState[fieldId] ?? "").trim();
  }
  return sanitized;
}

function validateNumericField(fieldId, rawValue) {
  const config = NUMERIC_FIELD_CONFIG[fieldId];
  const value = String(rawValue ?? "").trim();

  if (!value) {
    return { errorKey: `${config.errorBase}.required` };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { errorKey: `${config.errorBase}.number` };
  }

  if (fieldId === "alt" && numericValue === 0) {
    return { errorKey: `${config.errorBase}.nonzero` };
  }

  if (numericValue < config.min || numericValue > config.max) {
    return { errorKey: `${config.errorBase}.range` };
  }

  if (config.integer && !Number.isInteger(numericValue)) {
    return { errorKey: `${config.errorBase}.integer` };
  }

  return { value: numericValue };
}

export function validateFormState(formState) {
  const sanitized = sanitizePersistedState(formState);
  const errors = {};
  const values = {};

  for (const fieldId of FIELD_IDS) {
    const result = validateNumericField(fieldId, sanitized[fieldId]);
    if (result.errorKey) {
      errors[fieldId] = result.errorKey;
      continue;
    }
    values[fieldId] = result.value;
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    values,
    sanitized,
    hasAnyValue: hasAnyInputValue(sanitized)
  };
}

// FIB-4 = (age [years] × AST [U/L]) / (platelets [×10^9/L] × √ALT [U/L])
export function calculateFib4(values) {
  if (!values || typeof values !== "object") {
    throw new Error("invalid-values");
  }

  if (!Number.isFinite(values.alt) || values.alt <= 0) {
    throw new Error("invalid-alt");
  }

  if (!Number.isFinite(values.platelets) || values.platelets <= 0) {
    throw new Error("invalid-platelets");
  }

  const sqrtAlt = Math.sqrt(values.alt);
  const score = (values.age * values.ast) / (values.platelets * sqrtAlt);

  return {
    score,
    sqrtAlt,
    interpretation: interpretScore(score)
  };
}

// Sterling et al. style cutoffs (widely used; correlate with clinical context).
export function interpretScore(score) {
  if (score < 1.45) {
    return {
      tone: "low",
      badgeKey: "result.badges.low",
      categoryKey: "result.categories.low",
      messageKey: "result.interpretations.low",
      thresholdKey: "result.thresholds.low"
    };
  }

  if (score <= 3.25) {
    return {
      tone: "indeterminate",
      badgeKey: "result.badges.indeterminate",
      categoryKey: "result.categories.indeterminate",
      messageKey: "result.interpretations.indeterminate",
      thresholdKey: "result.thresholds.indeterminate"
    };
  }

  return {
    tone: "high",
    badgeKey: "result.badges.high",
    categoryKey: "result.categories.high",
    messageKey: "result.interpretations.high",
    thresholdKey: "result.thresholds.high"
  };
}

export function formatDecimal(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(digits);
}

export function buildRestoredViewModel(rawState) {
  const formState = sanitizePersistedState(rawState);
  const validation = validateFormState(formState);
  const result = validation.isValid ? calculateFib4(validation.values) : null;

  return {
    formState,
    validation,
    result
  };
}
