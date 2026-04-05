import { WHO_LMS_BY_SEX } from "./who-lms-data.js";
import {
  Z_P3,
  Z_P97,
  ageDaysToMonths,
  interpolateLms,
  lmsValueAtZ,
  valueToZScore,
  zScoreToPercentile
} from "./lms.js";

export const FIELD_IDS = [
  "sex",
  "birthDate",
  "weightKg",
  "weightLb",
  "weightOz",
  "lengthCm",
  "lengthFt",
  "lengthIn",
  "headCm"
];

export const STORAGE_KEY = "baby-growth-form-v1";

export const LB_TO_KG = 0.45359237;
export const IN_TO_CM = 2.54;

export function metricToImperialWeight(kg) {
  const totalLb = kg / LB_TO_KG;
  let lb = Math.floor(totalLb);
  let oz = Math.round((totalLb - lb) * 16 * 100) / 100;
  if (oz >= 16) {
    lb += 1;
    oz = Math.round((oz - 16) * 100) / 100;
  }
  return { lb: String(lb), oz: String(oz) };
}

export function cmToFtIn(cm) {
  const totalIn = cm / IN_TO_CM;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round((totalIn - ft * 12) * 100) / 100;
  if (inch >= 12) {
    ft += 1;
    inch = Math.round((inch - 12) * 100) / 100;
  }
  return { ft: String(ft), inch: String(inch) };
}

export function getTodayLocalYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function createEmptyFormState() {
  return {
    unitSystem: "imperial",
    sex: "boy",
    birthDate: "",
    weightKg: "",
    weightLb: "",
    weightOz: "",
    lengthCm: "",
    lengthFt: "",
    lengthIn: "",
    headCm: ""
  };
}

export function sanitizePersistedState(raw) {
  const next = createEmptyFormState();
  if (!raw || typeof raw !== "object") {
    return next;
  }
  if (raw.unitSystem === "metric" || raw.unitSystem === "imperial") {
    next.unitSystem = raw.unitSystem;
  }
  if (raw.sex === "boy" || raw.sex === "girl") {
    next.sex = raw.sex;
  }
  for (const key of FIELD_IDS) {
    if (typeof raw[key] === "string") {
      next[key] = raw[key];
    }
  }
  return next;
}

/** Parse YYYY-MM-DD as a local calendar date (no UTC shift). */
export function parseLocalYmd(str) {
  const s = String(str || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null;
  }
  const [y, m, d] = s.split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

/** Civil calendar days between two Y-M-D strings (DST-safe). */
export function ageDaysBetweenLocalYmd(birthYmd, measureYmd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(measureYmd)) {
    return null;
  }
  const [by, bm, bd] = birthYmd.split("-").map(Number);
  const [my, mm, md] = measureYmd.split("-").map(Number);
  const birth = parseLocalYmd(birthYmd);
  const measure = parseLocalYmd(measureYmd);
  if (!birth || !measure) {
    return null;
  }
  const a = Date.UTC(by, bm - 1, bd);
  const b = Date.UTC(my, mm - 1, md);
  return Math.floor((b - a) / 86400000);
}

function parsePositiveNumber(str, maxDecimals = 4) {
  const t = String(str ?? "").trim().replace(",", ".");
  if (!t) {
    return null;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return null;
  }
  const rounded = Math.round(n * 10 ** maxDecimals) / 10 ** maxDecimals;
  return rounded;
}

export function weightToKg(form) {
  if (form.unitSystem === "metric") {
    return parsePositiveNumber(form.weightKg, 3);
  }
  const lb = parsePositiveNumber(form.weightLb, 2) ?? 0;
  const oz = parsePositiveNumber(form.weightOz, 2) ?? 0;
  if (lb === 0 && oz === 0) {
    return null;
  }
  const totalLb = lb + oz / 16;
  return Math.round(totalLb * LB_TO_KG * 1000) / 1000;
}

export function lengthToCm(form) {
  if (form.unitSystem === "metric") {
    return parsePositiveNumber(form.lengthCm, 2);
  }
  const ft = parsePositiveNumber(form.lengthFt, 2) ?? 0;
  const inch = parsePositiveNumber(form.lengthIn, 2) ?? 0;
  if (ft === 0 && inch === 0) {
    return null;
  }
  const totalIn = ft * 12 + inch;
  return Math.round(totalIn * IN_TO_CM * 100) / 100;
}

export function parseOptionalHeadCm(form) {
  const t = String(form.headCm ?? "").trim();
  if (!t) {
    return null;
  }
  return parsePositiveNumber(form.headCm, 2);
}

/**
 * @param {object} [options]
 * @param {string} [options.asOfYmd] reference day YYYY-MM-DD (default: today local)
 * @returns {object} activeFieldIds, errors, isValid, hasAnyValue
 */
export function validateFormState(form, t, options) {
  const errors = {};
  const activeFieldIds = [];
  const asOfYmd = options?.asOfYmd ?? getTodayLocalYmd();

  if (form.unitSystem === "metric") {
    activeFieldIds.push("weightKg", "lengthCm");
  } else {
    activeFieldIds.push("weightLb", "weightOz", "lengthFt", "lengthIn");
  }

  activeFieldIds.push("sex", "birthDate", "headCm");

  const birth = parseLocalYmd(form.birthDate);
  const ref = parseLocalYmd(asOfYmd);
  if (!birth) {
    errors.birthDate = t("validation.birth_date");
  }
  if (birth && ref) {
    if (birth > ref) {
      errors.birthDate = t("validation.birth_future");
    } else {
      const days = ageDaysBetweenLocalYmd(form.birthDate, asOfYmd);
      if (days != null && days >= 730) {
        errors.birthDate = t("validation.age_two_years");
      }
    }
  }

  const wKg = weightToKg(form);
  if (wKg == null) {
    if (form.unitSystem === "metric") {
      errors.weightKg = t("validation.weight_required");
    } else {
      errors.weightLb = t("validation.weight_required");
    }
  } else if (wKg < 0.5 || wKg > 25) {
    const key = form.unitSystem === "metric" ? "weightKg" : "weightLb";
    errors[key] = t("validation.weight_range");
  }

  const lenCm = lengthToCm(form);
  if (lenCm == null) {
    if (form.unitSystem === "metric") {
      errors.lengthCm = t("validation.length_required");
    } else {
      errors.lengthFt = t("validation.length_required");
    }
  } else if (lenCm < 30 || lenCm > 110) {
    const key = form.unitSystem === "metric" ? "lengthCm" : "lengthFt";
    errors[key] = t("validation.length_range");
  }

  const head = parseOptionalHeadCm(form);
  if (String(form.headCm ?? "").trim() && head == null) {
    errors.headCm = t("validation.head_invalid");
  } else if (head != null && (head < 25 || head > 55)) {
    errors.headCm = t("validation.head_range");
  }

  const hasAnyValue = Boolean(
    String(form.birthDate ?? "").trim() ||
      String(form.weightKg ?? "").trim() ||
      String(form.weightLb ?? "").trim() ||
      String(form.weightOz ?? "").trim() ||
      String(form.lengthCm ?? "").trim() ||
      String(form.lengthFt ?? "").trim() ||
      String(form.lengthIn ?? "").trim() ||
      String(form.headCm ?? "").trim()
  );

  const isValid = Object.keys(errors).length === 0;
  return { activeFieldIds, errors, isValid, hasAnyValue };
}

function percentileSummary(z, p) {
  if (!Number.isFinite(p)) {
    return { labelKey: "result.percentile.unknown", z, p: NaN };
  }
  if (p < 0.5) {
    return { labelKey: "result.percentile.lt_half", z, p };
  }
  if (p > 99.5) {
    return { labelKey: "result.percentile.gt_99", z, p };
  }
  if (p < 2.5) {
    return { labelKey: "result.percentile.lt_3", z, p };
  }
  return { labelKey: "result.percentile.typical", z, p };
}

function oneIndicator(value, table, ageMonths) {
  const lms = interpolateLms(table, ageMonths);
  if (!lms) {
    return null;
  }
  const z = valueToZScore(value, lms);
  const p = zScoreToPercentile(z);
  return {
    z,
    p,
    ...percentileSummary(z, p)
  };
}

/**
 * @param {ReturnType<createEmptyFormState>} form
 * @param {(key: string, vars?: Record<string,string>) => string} t i18n
 * @param {object} [options]
 * @param {string} [options.asOfYmd] reference day YYYY-MM-DD (default: today local)
 */
export function computeGrowth(form, t, options) {
  const validation = validateFormState(form, t, options);
  if (!validation.isValid) {
    return { ok: false, validation, result: null };
  }

  const asOfYmd = options?.asOfYmd ?? getTodayLocalYmd();
  const ageDays = ageDaysBetweenLocalYmd(form.birthDate, asOfYmd);
  const ageMonths = ageDaysToMonths(ageDays);
  const tables = WHO_LMS_BY_SEX[form.sex];

  const weightKg = weightToKg(form);
  const lengthCm = lengthToCm(form);
  const headCm = parseOptionalHeadCm(form);

  const weight = oneIndicator(weightKg, tables.wfa, ageMonths);
  const length = oneIndicator(lengthCm, tables.lfa, ageMonths);
  const head = headCm != null ? oneIndicator(headCm, tables.hcfa, ageMonths) : null;

  return {
    ok: true,
    validation,
    result: {
      asOfYmd,
      ageDays,
      ageMonths,
      weightKg,
      lengthCm,
      headCm,
      weight,
      length,
      head
    }
  };
}

/**
 * Data for standard-comparison chart (3rd–97th band + median + child value).
 * @param {string} sex boy|girl
 * @param {number} ageMonths
 * @param {object} m weightKg, lengthCm, headCm (optional)
 */
export function buildGrowthChartRows(sex, ageMonths, m) {
  const tables = WHO_LMS_BY_SEX[sex];
  const rows = [];

  const pushRow = (id, table, value, unitKey) => {
    const lms = interpolateLms(table, ageMonths);
    if (!lms || value == null || !Number.isFinite(value)) {
      return;
    }
    const low = lmsValueAtZ(lms, Z_P3);
    const mid = lms.M;
    const high = lmsValueAtZ(lms, Z_P97);
    if (![low, mid, high].every((x) => Number.isFinite(x))) {
      return;
    }
    rows.push({
      id,
      unitKey,
      low,
      mid,
      high,
      value
    });
  };

  pushRow("weight", tables.wfa, m.weightKg, "chart.units.kg");
  pushRow("length", tables.lfa, m.lengthCm, "chart.units.cm");
  if (m.headCm != null && Number.isFinite(m.headCm)) {
    pushRow("head", tables.hcfa, m.headCm, "chart.units.cm");
  }

  return rows;
}

export function formatPercentileDisplay(p) {
  if (!Number.isFinite(p)) {
    return "—";
  }
  return String(Math.round(p));
}

