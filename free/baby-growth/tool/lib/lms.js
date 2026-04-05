/** WHO-style LMS to z-score and percentile (standard normal). */

export const DAYS_PER_MONTH = 30.4375;

/**
 * @param {number} z
 * @returns {number} approximate standard normal CDF Φ(z), in (0,1)
 */
export function normalCdf(z) {
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989423 * Math.exp(-0.5 * z * z);
  const p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * @param {number} value measured (kg or cm)
 * @param {object} lms L, M, S numbers (WHO LMS row)
 * @returns {number} z-score
 */
export function valueToZScore(value, lms) {
  const { L, M, S } = lms;
  if (!(value > 0) || !(M > 0) || !(S > 0)) {
    return NaN;
  }
  if (Math.abs(L) < 1e-12) {
    return Math.log(value / M) / S;
  }
  return (Math.pow(value / M, L) - 1) / (L * S);
}

/**
 * @param {number} z
 * @returns {number} percentile 0–100 (unclamped)
 */
export function zScoreToPercentile(z) {
  if (!Number.isFinite(z)) {
    return NaN;
  }
  return normalCdf(z) * 100;
}

/**
 * @param {Array<{ month: number; L: number; M: number; S: number }>} table rows month 0..24
 * @param {number} ageMonths fractional age in months
 */
export function interpolateLms(table, ageMonths) {
  if (!table?.length) {
    return null;
  }
  const clamped = Math.max(0, Math.min(24, ageMonths));
  const lo = Math.floor(clamped);
  const hi = Math.ceil(clamped);
  const a = table[lo];
  const b = table[hi];
  if (!a || !b) {
    return null;
  }
  if (lo === hi) {
    return { L: a.L, M: a.M, S: a.S };
  }
  const t = clamped - lo;
  return {
    L: a.L + t * (b.L - a.L),
    M: a.M + t * (b.M - a.M),
    S: a.S + t * (b.S - a.S)
  };
}

/**
 * @param {number} ageDays
 * @returns {number} fractional months for LMS lookup
 */
export function ageDaysToMonths(ageDays) {
  return ageDays / DAYS_PER_MONTH;
}

/** ~3rd / ~97th percentile z for LMS inversion (CDC/WHO chart convention). */
export const Z_P3 = -1.881;
export const Z_P97 = 1.881;

/**
 * Measurement X at z-score z given LMS (inverse of valueToZScore).
 * @param {object} lms
 * @param {number} z
 */
export function lmsValueAtZ(lms, z) {
  const { L, M, S } = lms;
  if (!(M > 0) || !(S > 0) || !Number.isFinite(z)) {
    return NaN;
  }
  if (Math.abs(L) < 1e-12) {
    return M * Math.exp(S * z);
  }
  const inner = 1 + L * S * z;
  if (inner <= 0) {
    return NaN;
  }
  return M * Math.pow(inner, 1 / L);
}
