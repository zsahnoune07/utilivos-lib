/** @typedef {"kg" | "lb"} MassUnit */

/**
 * @typedef {Object} FormState
 * @property {string} weight
 * @property {string} reps
 * @property {MassUnit} unit
 */

/**
 * @typedef {Object} EstimatesKg
 * @property {number} brzyckiKg
 * @property {number} epleyKg
 * @property {number} lombardiKg
 */

export const LB_PER_KG = 2.2046226218487757;

/** Max entered weight in the user's chosen unit (kg or lb). */
const WEIGHT_MAX_DISPLAY = 2000;

const REPS_MIN = 1;
const REPS_MAX = 15;

/**
 * @returns {FormState}
 */
export function createEmptyFormState() {
  return {
    weight: "",
    reps: "",
    unit: "kg",
  };
}

/**
 * @param {unknown} rawState
 * @returns {FormState}
 */
export function sanitizePersistedState(rawState) {
  const empty = createEmptyFormState();
  if (!rawState || typeof rawState !== "object") {
    return empty;
  }
  const o = /** @type {Record<string, unknown>} */ (rawState);
  const unit = o.unit === "lb" ? "lb" : "kg";
  return {
    weight: String(o.weight ?? "").trim(),
    reps: String(o.reps ?? "").trim(),
    unit,
  };
}

/**
 * @param {number} weightLb
 * @returns {number}
 */
export function lbToKg(weightLb) {
  return weightLb / LB_PER_KG;
}

/**
 * @param {number} weightKg
 * @returns {number}
 */
export function kgToLb(weightKg) {
  return weightKg * LB_PER_KG;
}

/**
 * Display weight in user's unit (from kg).
 * @param {number} weightKg
 * @param {MassUnit} unit
 * @returns {number}
 */
export function fromKg(weightKg, unit) {
  return unit === "lb" ? kgToLb(weightKg) : weightKg;
}

/**
 * @param {number} displayWeight
 * @param {MassUnit} unit
 * @returns {number}
 */
export function toKg(displayWeight, unit) {
  return unit === "lb" ? lbToKg(displayWeight) : displayWeight;
}

/**
 * @param {number} weightKg
 * @param {number} reps
 * @returns {EstimatesKg}
 */
export function computeEstimatesKg(weightKg, reps) {
  const w = weightKg;
  const r = reps;
  const brzyckiKg = r === 1 ? w : (w * 36) / (37 - r);
  const epleyKg = w * (1 + r / 30);
  const lombardiKg = w * r ** 0.1;
  return { brzyckiKg, epleyKg, lombardiKg };
}

/**
 * @param {string} rawValue
 * @param {MassUnit} unit
 */
function validateWeight(rawValue, unit) {
  const base = "form.fields.weight.errors";
  const value = String(rawValue ?? "").trim();
  if (!value) {
    return { errorKey: `${base}.required` };
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { errorKey: `${base}.number` };
  }
  if (n > WEIGHT_MAX_DISPLAY) {
    return { errorKey: `${base}.range` };
  }
  return { value: n };
}

/**
 * @param {string} rawValue
 */
function validateReps(rawValue) {
  const base = "form.fields.reps.errors";
  const value = String(rawValue ?? "").trim();
  if (!value) {
    return { errorKey: `${base}.required` };
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return { errorKey: `${base}.number` };
  }
  if (!Number.isInteger(n)) {
    return { errorKey: `${base}.integer` };
  }
  if (n < REPS_MIN || n > REPS_MAX) {
    return { errorKey: `${base}.range` };
  }
  return { value: n };
}

/**
 * @param {FormState} formState
 */
export function validateFormState(formState) {
  const sanitized = sanitizePersistedState(formState);
  const errors = /** @type {Record<string, string>} */ ({});
  /** @type {Record<string, number | undefined>} */
  const values = {};

  const wRes = validateWeight(sanitized.weight, sanitized.unit);
  if (wRes.errorKey) {
    errors.weight = wRes.errorKey;
  } else {
    values.weightKg = toKg(/** @type {number} */ (wRes.value), sanitized.unit);
  }

  const rRes = validateReps(sanitized.reps);
  if (rRes.errorKey) {
    errors.reps = rRes.errorKey;
  } else {
    values.reps = rRes.value;
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    values: isValid
      ? {
          weightKg: /** @type {number} */ (values.weightKg),
          reps: /** @type {number} */ (values.reps),
        }
      : null,
    sanitized,
  };
}

/**
 * @param {number} n
 * @param {number} [decimals=1]
 */
export function formatMass(n, decimals = 1) {
  if (!Number.isFinite(n)) {
    return "";
  }
  return n.toFixed(decimals);
}
