export const STORAGE_KEY = "utilivo.heart-rate-zones.v1";

const MIN_AGE = 15;
const MAX_AGE = 100;
const MIN_RESTING_BPM = 40;
const MAX_RESTING_BPM = 120;

/** Five-zone %HRR bands (Karvonen): lower inclusive, upper inclusive for display. */
export const ZONE_BANDS = [
  { id: "z1", pctLow: 0.5, pctHigh: 0.6 },
  { id: "z2", pctLow: 0.6, pctHigh: 0.7 },
  { id: "z3", pctLow: 0.7, pctHigh: 0.8 },
  { id: "z4", pctLow: 0.8, pctHigh: 0.9 },
  { id: "z5", pctLow: 0.9, pctHigh: 1.0 }
];

export const FIELD_IDS = ["age", "restingBpm"];

export function estimateMaxHeartRate(age) {
  return 220 - age;
}

export function createEmptyFormState() {
  return {
    age: "",
    restingBpm: ""
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

function parseIntegerField(rawValue, errorBase, { min, max } = {}) {
  const value = String(rawValue ?? "").trim();

  if (!value) {
    return { errorKey: `${errorBase}.required` };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || !Number.isInteger(numericValue)) {
    return { errorKey: `${errorBase}.integer` };
  }

  if ((min != null && numericValue < min) || (max != null && numericValue > max)) {
    return { errorKey: `${errorBase}.range` };
  }

  return { value: numericValue };
}

export function validateFormState(formState) {
  const sanitized = sanitizePersistedState(formState);
  const errors = {};
  const activeFieldIds = [...FIELD_IDS];

  const ageResult = parseIntegerField(sanitized.age, "form.fields.age.errors", {
    min: MIN_AGE,
    max: MAX_AGE
  });
  const restingResult = parseIntegerField(sanitized.restingBpm, "form.fields.restingBpm.errors", {
    min: MIN_RESTING_BPM,
    max: MAX_RESTING_BPM
  });

  if (ageResult.errorKey) errors.age = ageResult.errorKey;
  if (restingResult.errorKey) errors.restingBpm = restingResult.errorKey;

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
      values: null,
      sanitized,
      hasAnyValue: hasAnyInputValue(sanitized),
      activeFieldIds
    };
  }

  const age = ageResult.value;
  const restingBpm = restingResult.value;
  const maxHr = estimateMaxHeartRate(age);

  if (restingBpm >= maxHr) {
    errors.restingBpm = "form.errors.restingVsMax";
    return {
      isValid: false,
      errors,
      values: null,
      sanitized,
      hasAnyValue: hasAnyInputValue(sanitized),
      activeFieldIds
    };
  }

  return {
    isValid: true,
    errors: {},
    values: { age, restingBpm, maxHr },
    sanitized,
    hasAnyValue: hasAnyInputValue(sanitized),
    activeFieldIds
  };
}

/** @param {object} values validated numeric age, restingBpm, maxHr from validateFormState */
export function computeHeartRateZones(values) {
  const { restingBpm, maxHr } = values;
  const hrr = maxHr - restingBpm;

  if (!Number.isFinite(hrr) || hrr <= 0) {
    return { ok: false, errorKey: "form.errors.invalidReserve" };
  }

  const zones = ZONE_BANDS.map((band) => ({
    id: band.id,
    pctLow: band.pctLow,
    pctHigh: band.pctHigh,
    bpmLow: Math.round(restingBpm + hrr * band.pctLow),
    bpmHigh: Math.round(restingBpm + hrr * band.pctHigh)
  }));

  return {
    ok: true,
    maxHr,
    hrr,
    restingBpm,
    age: values.age,
    zones
  };
}

export function buildRestoredViewModel(rawState) {
  const formState = sanitizePersistedState(rawState);
  const validation = validateFormState(formState);
  const result =
    validation.isValid && validation.values ? computeHeartRateZones(validation.values) : null;
  const okResult = result && result.ok ? result : null;

  return {
    formState,
    validation,
    result: okResult
  };
}
