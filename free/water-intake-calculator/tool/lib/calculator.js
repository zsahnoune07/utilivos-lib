export const STORAGE_KEY = "utilivo.water-intake-calculator.v1";

const KG_PER_LB = 0.45359237;

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 300;
const MIN_WEIGHT_LB = MIN_WEIGHT_KG / KG_PER_LB;
const MAX_WEIGHT_LB = MAX_WEIGHT_KG / KG_PER_LB;

const SEX_KEYS = ["unspecified", "female", "male"];
const ACTIVITY_KEYS = ["sedentary", "light", "moderate", "active", "very_active"];
const CLIMATE_KEYS = ["temperate", "hot"];
const PREGNANCY_KEYS = ["none", "pregnant", "breastfeeding"];

/** ml per kg body weight by sex bucket (population-style heuristic, not clinical prescription) */
const ML_PER_KG = {
  unspecified: 33,
  female: 31,
  male: 35
};

const ACTIVITY_ML = {
  sedentary: 0,
  light: 250,
  moderate: 500,
  active: 750,
  very_active: 1100
};

const CLIMATE_ML = {
  temperate: 0,
  hot: 400
};

const PREGNANCY_ML = {
  none: 0,
  pregnant: 300,
  breastfeeding: 800
};

export const FIELD_IDS = ["weightKg", "weightLb"];

export function getActiveFieldIds(unit = "metric") {
  return unit === "imperial" ? ["weightLb"] : ["weightKg"];
}

export function createEmptyFormState() {
  return {
    unit: "metric",
    weightKg: "",
    weightLb: "",
    sex: "unspecified",
    activity: "moderate",
    climate: "temperate",
    pregnancy: "none"
  };
}

export function hasAnyInputValue(formState) {
  return (
    String(formState.weightKg ?? "").trim().length > 0 ||
    String(formState.weightLb ?? "").trim().length > 0
  );
}

export function sanitizePersistedState(rawState) {
  const empty = createEmptyFormState();
  if (!rawState || typeof rawState !== "object") {
    return empty;
  }

  const sanitized = { ...empty };
  sanitized.unit = rawState.unit === "imperial" ? "imperial" : "metric";
  sanitized.weightKg = String(rawState.weightKg ?? "").trim();
  sanitized.weightLb = String(rawState.weightLb ?? "").trim();
  sanitized.sex = SEX_KEYS.includes(rawState.sex) ? rawState.sex : "unspecified";
  sanitized.activity = ACTIVITY_KEYS.includes(rawState.activity) ? rawState.activity : "moderate";
  sanitized.climate = CLIMATE_KEYS.includes(rawState.climate) ? rawState.climate : "temperate";
  sanitized.pregnancy = PREGNANCY_KEYS.includes(rawState.pregnancy) ? rawState.pregnancy : "none";

  return sanitized;
}

function parseNumericValue(rawValue, errorBase, { min = null, max = null } = {}) {
  const value = String(rawValue ?? "").trim();

  if (!value) {
    return { errorKey: `${errorBase}.required` };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { errorKey: `${errorBase}.number` };
  }

  if ((min != null && numericValue < min) || (max != null && numericValue > max)) {
    return { errorKey: `${errorBase}.range` };
  }

  return { value: numericValue };
}

function buildValues(sanitized, weightKg) {
  return {
    unit: sanitized.unit,
    weightKg,
    sex: sanitized.sex,
    activity: sanitized.activity,
    climate: sanitized.climate,
    pregnancy: sanitized.pregnancy
  };
}

export function validateFormState(formState) {
  const sanitized = sanitizePersistedState(formState);
  const errors = {};

  if (sanitized.unit === "imperial") {
    const weightResult = parseNumericValue(sanitized.weightLb, "form.fields.weightLb.errors", {
      min: MIN_WEIGHT_LB,
      max: MAX_WEIGHT_LB
    });

    if (weightResult.errorKey) {
      errors.weightLb = weightResult.errorKey;
    }

    const weightKg =
      weightResult.value != null && !weightResult.errorKey
        ? weightResult.value * KG_PER_LB
        : null;

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      values: Object.keys(errors).length === 0 ? buildValues(sanitized, weightKg) : null,
      sanitized,
      hasAnyValue: hasAnyInputValue(sanitized),
      activeFieldIds: getActiveFieldIds("imperial")
    };
  }

  const weightResult = parseNumericValue(sanitized.weightKg, "form.fields.weightKg.errors", {
    min: MIN_WEIGHT_KG,
    max: MAX_WEIGHT_KG
  });

  if (weightResult.errorKey) {
    errors.weightKg = weightResult.errorKey;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values:
      Object.keys(errors).length === 0 ? buildValues(sanitized, weightResult.value) : null,
    sanitized,
    hasAnyValue: hasAnyInputValue(sanitized),
    activeFieldIds: getActiveFieldIds("metric")
  };
}

export function calculateWaterIntake(values) {
  const weightKg = Number(values?.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("invalid-weight");
  }

  const sex = SEX_KEYS.includes(values?.sex) ? values.sex : "unspecified";
  const activity = ACTIVITY_KEYS.includes(values?.activity) ? values.activity : "moderate";
  const climate = CLIMATE_KEYS.includes(values?.climate) ? values.climate : "temperate";
  const pregnancy = PREGNANCY_KEYS.includes(values?.pregnancy) ? values.pregnancy : "none";

  const mlPerKg = ML_PER_KG[sex];
  const baseMl = weightKg * mlPerKg;
  const activityMl = ACTIVITY_ML[activity];
  const climateMl = CLIMATE_ML[climate];
  const pregnancyMl = PREGNANCY_ML[pregnancy];

  const totalMl = Math.round(baseMl + activityMl + climateMl + pregnancyMl);

  return {
    totalMl,
    breakdown: {
      baseMl: Math.round(baseMl),
      activityMl,
      climateMl,
      pregnancyMl,
      mlPerKg
    }
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

/** @param {number} weightLb */
export function poundsToKg(weightLb) {
  return weightLb * KG_PER_LB;
}

/** @param {number} weightKg */
export function kgToPounds(weightKg) {
  if (!Number.isFinite(weightKg)) {
    return NaN;
  }
  return weightKg / KG_PER_LB;
}

export function buildRestoredViewModel(rawState) {
  const formState = sanitizePersistedState(rawState);
  const validation = validateFormState(formState);
  const result = validation.isValid ? calculateWaterIntake(validation.values) : null;

  return {
    formState,
    validation,
    result
  };
}
