export const STORAGE_KEY = "utilivo.bmi-calculator.v1";

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;
const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;
const MAX_HEIGHT_FEET = 8;
const MIN_INCHES = 0;
const MAX_INCHES = 11.9;
const MIN_WEIGHT_LB = MIN_WEIGHT_KG / KG_PER_LB;
const MAX_WEIGHT_LB = MAX_WEIGHT_KG / KG_PER_LB;

export const FIELD_IDS = [
  "heightCm",
  "weightKg",
  "heightFt",
  "heightIn",
  "weightLb"
];

const ACTIVE_FIELDS = {
  metric: ["heightCm", "weightKg"],
  imperial: ["heightFt", "heightIn", "weightLb"]
};

export function createEmptyFormState() {
  return {
    unit: "metric",
    heightCm: "",
    weightKg: "",
    heightFt: "",
    heightIn: "",
    weightLb: ""
  };
}

export function getActiveFieldIds(unit = "metric") {
  return ACTIVE_FIELDS[unit] ?? ACTIVE_FIELDS.metric;
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
  sanitized.unit = rawState.unit === "imperial" ? "imperial" : "metric";

  for (const fieldId of FIELD_IDS) {
    sanitized[fieldId] = String(rawState[fieldId] ?? "").trim();
  }

  return sanitized;
}

function parseNumericValue(rawValue, errorBase, { integer = false, min = null, max = null } = {}) {
  const value = String(rawValue ?? "").trim();

  if (!value) {
    return { errorKey: `${errorBase}.required` };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { errorKey: `${errorBase}.number` };
  }

  if (integer && !Number.isInteger(numericValue)) {
    return { errorKey: `${errorBase}.integer` };
  }

  if ((min != null && numericValue < min) || (max != null && numericValue > max)) {
    return { errorKey: `${errorBase}.range` };
  }

  return { value: numericValue };
}

export function convertFormToMetric(formState) {
  const sanitized = sanitizePersistedState(formState);

  if (sanitized.unit === "imperial") {
    const heightFt = Number(sanitized.heightFt);
    const heightIn = Number(sanitized.heightIn);
    const weightLb = Number(sanitized.weightLb);
    const totalInches = heightFt * 12 + heightIn;
    const heightCm = totalInches * CM_PER_INCH;
    const weightKg = weightLb * KG_PER_LB;

    return {
      unit: "imperial",
      heightCm,
      heightM: heightCm / 100,
      weightKg,
      totalInches
    };
  }

  const heightCm = Number(sanitized.heightCm);
  const weightKg = Number(sanitized.weightKg);

  return {
    unit: "metric",
    heightCm,
    heightM: heightCm / 100,
    weightKg
  };
}

export function convertMetricToImperialValues(metricValues) {
  const heightCm = Number(metricValues?.heightCm);
  const weightKg = Number(metricValues?.weightKg);

  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg)) {
    throw new Error("invalid-metric-values");
  }

  const totalInches = heightCm / CM_PER_INCH;
  const heightFt = Math.floor(totalInches / 12);
  const heightIn = totalInches - heightFt * 12;
  const weightLb = weightKg / KG_PER_LB;

  return {
    heightFt: String(heightFt),
    heightIn: formatInputValue(heightIn, 1),
    weightLb: formatInputValue(weightLb, 1)
  };
}

export function validateFormState(formState) {
  const sanitized = sanitizePersistedState(formState);
  const errors = {};

  if (sanitized.unit === "imperial") {
    const feetResult = parseNumericValue(sanitized.heightFt, "form.fields.heightFt.errors", {
      integer: true,
      min: 0,
      max: MAX_HEIGHT_FEET
    });
    const inchesResult = parseNumericValue(sanitized.heightIn, "form.fields.heightIn.errors", {
      min: MIN_INCHES,
      max: MAX_INCHES
    });
    const weightResult = parseNumericValue(sanitized.weightLb, "form.fields.weightLb.errors", {
      min: MIN_WEIGHT_LB,
      max: MAX_WEIGHT_LB
    });

    if (feetResult.errorKey) {
      errors.heightFt = feetResult.errorKey;
    }
    if (inchesResult.errorKey) {
      errors.heightIn = inchesResult.errorKey;
    }
    if (weightResult.errorKey) {
      errors.weightLb = weightResult.errorKey;
    }

    if (Object.keys(errors).length === 0) {
      const values = convertFormToMetric(sanitized);

      if (values.heightCm < MIN_HEIGHT_CM || values.heightCm > MAX_HEIGHT_CM) {
        errors.heightFt = "form.fields.heightFt.errors.combinedRange";
        errors.heightIn = "form.fields.heightIn.errors.combinedRange";
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
        values,
        sanitized,
        hasAnyValue: hasAnyInputValue(sanitized),
        activeFieldIds: getActiveFieldIds("imperial")
      };
    }

    return {
      isValid: false,
      errors,
      values: null,
      sanitized,
      hasAnyValue: hasAnyInputValue(sanitized),
      activeFieldIds: getActiveFieldIds("imperial")
    };
  }

  const heightResult = parseNumericValue(sanitized.heightCm, "form.fields.heightCm.errors", {
    min: MIN_HEIGHT_CM,
    max: MAX_HEIGHT_CM
  });
  const weightResult = parseNumericValue(sanitized.weightKg, "form.fields.weightKg.errors", {
    min: MIN_WEIGHT_KG,
    max: MAX_WEIGHT_KG
  });

  if (heightResult.errorKey) {
    errors.heightCm = heightResult.errorKey;
  }
  if (weightResult.errorKey) {
    errors.weightKg = weightResult.errorKey;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: Object.keys(errors).length === 0 ? convertFormToMetric(sanitized) : null,
    sanitized,
    hasAnyValue: hasAnyInputValue(sanitized),
    activeFieldIds: getActiveFieldIds("metric")
  };
}

export function interpretBmi(bmi) {
  if (bmi < 18.5) {
    return {
      tone: "underweight",
      badgeVariant: "info",
      badgeKey: "result.badges.underweight",
      categoryKey: "result.categories.underweight",
      messageKey: "result.messages.underweight"
    };
  }

  if (bmi < 25) {
    return {
      tone: "healthy",
      badgeVariant: "success",
      badgeKey: "result.badges.healthy",
      categoryKey: "result.categories.healthy",
      messageKey: "result.messages.healthy"
    };
  }

  if (bmi < 30) {
    return {
      tone: "overweight",
      badgeVariant: "warning",
      badgeKey: "result.badges.overweight",
      categoryKey: "result.categories.overweight",
      messageKey: "result.messages.overweight"
    };
  }

  return {
    tone: "obesity",
    badgeVariant: "error",
    badgeKey: "result.badges.obesity",
    categoryKey: "result.categories.obesity",
    messageKey: "result.messages.obesity"
  };
}

export function calculateHealthyWeightRange(heightCm) {
  const numericHeightCm = Number(heightCm);
  if (!Number.isFinite(numericHeightCm) || numericHeightCm <= 0) {
    throw new Error("invalid-height");
  }

  const heightM = numericHeightCm / 100;
  const minKg = 18.5 * heightM * heightM;
  const maxKg = 24.9 * heightM * heightM;

  return {
    minKg,
    maxKg,
    minLb: minKg / KG_PER_LB,
    maxLb: maxKg / KG_PER_LB
  };
}

export function calculateBmi(values) {
  const heightM = Number(values?.heightM);
  const weightKg = Number(values?.weightKg);
  const heightCm = Number(values?.heightCm);

  if (!Number.isFinite(heightM) || heightM <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("invalid-values");
  }

  const bmi = weightKg / (heightM * heightM);

  return {
    bmi,
    metric: {
      heightCm,
      heightM,
      weightKg
    },
    healthyWeightRange: calculateHealthyWeightRange(heightCm),
    interpretation: interpretBmi(bmi)
  };
}

export function formatDecimal(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(digits);
}

export function formatInputValue(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function buildRestoredViewModel(rawState) {
  const formState = sanitizePersistedState(rawState);
  const validation = validateFormState(formState);
  const result = validation.isValid ? calculateBmi(validation.values) : null;

  return {
    formState,
    validation,
    result
  };
}
