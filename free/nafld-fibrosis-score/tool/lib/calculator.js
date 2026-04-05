export const STORAGE_KEY = "utilivo.nafld-fibrosis-score.v1";

const NUMERIC_FIELD_CONFIG = {
  age: { min: 18, max: 120, integer: true, errorBase: "form.fields.age.errors" },
  bmi: { min: 10, max: 100, errorBase: "form.fields.bmi.errors" },
  ast: { min: 0.1, max: 2000, errorBase: "form.fields.ast.errors" },
  alt: { min: 0.1, max: 2000, errorBase: "form.fields.alt.errors" },
  platelets: { min: 1, max: 1000, errorBase: "form.fields.platelets.errors" },
  albumin: { min: 0.5, max: 6.5, errorBase: "form.fields.albumin.errors" }
};

export const FIELD_IDS = [
  "age",
  "bmi",
  "diabetes",
  "ast",
  "alt",
  "platelets",
  "albumin"
];

export function createEmptyFormState() {
  return {
    age: "",
    bmi: "",
    diabetes: "",
    ast: "",
    alt: "",
    platelets: "",
    albumin: ""
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
    if (fieldId === "diabetes") {
      const rawValue = rawState[fieldId];
      if (rawValue === true) {
        sanitized.diabetes = "yes";
        continue;
      }
      if (rawValue === false) {
        sanitized.diabetes = "no";
        continue;
      }
      const normalized = String(rawValue ?? "")
        .trim()
        .toLowerCase();
      sanitized.diabetes = normalized === "yes" || normalized === "no" ? normalized : "";
      continue;
    }

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

  for (const fieldId of Object.keys(NUMERIC_FIELD_CONFIG)) {
    const result = validateNumericField(fieldId, sanitized[fieldId]);
    if (result.errorKey) {
      errors[fieldId] = result.errorKey;
      continue;
    }
    values[fieldId] = result.value;
  }

  if (!sanitized.diabetes) {
    errors.diabetes = "form.fields.diabetes.errors.required";
  } else {
    values.diabetes = sanitized.diabetes === "yes";
  }

  const isValid = Object.keys(errors).length === 0;
  const astAltRatio = isValid ? values.ast / values.alt : null;

  return {
    isValid,
    errors,
    values,
    sanitized,
    hasAnyValue: hasAnyInputValue(sanitized),
    astAltRatio
  };
}

export function calculateNafldFibrosisScore(values) {
  if (!values || typeof values !== "object") {
    throw new Error("invalid-values");
  }

  if (!Number.isFinite(values.alt) || values.alt === 0) {
    throw new Error("invalid-alt");
  }

  const astAltRatio = values.ast / values.alt;
  const score =
    -1.675 +
    0.037 * values.age +
    0.094 * values.bmi +
    1.13 * (values.diabetes ? 1 : 0) +
    0.99 * astAltRatio -
    0.013 * values.platelets -
    0.66 * values.albumin;

  return {
    score,
    astAltRatio,
    interpretation: interpretScore(score)
  };
}

export function interpretScore(score) {
  if (score < -1.455) {
    return {
      tone: "low",
      badgeKey: "result.badges.low",
      categoryKey: "result.categories.low",
      messageKey: "result.interpretations.low",
      thresholdKey: "result.thresholds.low"
    };
  }

  if (score <= 0.676) {
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
  const result = validation.isValid ? calculateNafldFibrosisScore(validation.values) : null;

  return {
    formState,
    validation,
    result
  };
}
