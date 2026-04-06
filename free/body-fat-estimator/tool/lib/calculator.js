export const STORAGE_KEY = "utilivos.body-fat-estimator.v1";

const CM_PER_INCH = 2.54;
const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;
const MAX_HEIGHT_FEET = 8;
const MIN_INCHES = 0;
const MAX_INCHES = 11.9;

const MIN_NECK_CM = 25;
const MAX_NECK_CM = 55;
const MIN_NECK_IN = 10;
const MAX_NECK_IN = 22;

const MIN_ABDOMEN_CM = 55;
const MAX_ABDOMEN_CM = 200;
const MIN_ABDOMEN_IN = 22;
const MAX_ABDOMEN_IN = 79;

const MIN_WAIST_CM = 50;
const MAX_WAIST_CM = 180;
const MIN_WAIST_IN = 20;
const MAX_WAIST_IN = 71;

const MIN_HIP_CM = 60;
const MAX_HIP_CM = 220;
const MIN_HIP_IN = 24;
const MAX_HIP_IN = 87;

const MIN_BF_DISPLAY = 2;
const MAX_BF_DISPLAY = 60;

const SEX_KEYS = ["male", "female"];

export const FIELD_IDS = [
  "heightCm",
  "neckCm",
  "abdomenCm",
  "waistCm",
  "hipCm",
  "heightFt",
  "heightIn",
  "neckIn",
  "abdomenIn",
  "waistIn",
  "hipIn"
];

function log10(x) {
  return Math.log(x) / Math.LN10;
}

export function getActiveFieldIds(sex = "male", unit = "metric") {
  const s = sex === "female" ? "female" : "male";
  if (unit === "imperial") {
    return s === "male"
      ? ["heightFt", "heightIn", "neckIn", "abdomenIn"]
      : ["heightFt", "heightIn", "neckIn", "waistIn", "hipIn"];
  }
  return s === "male" ? ["heightCm", "neckCm", "abdomenCm"] : ["heightCm", "neckCm", "waistCm", "hipCm"];
}

export function createEmptyFormState() {
  return {
    unit: "metric",
    sex: "male",
    heightCm: "",
    neckCm: "",
    abdomenCm: "",
    waistCm: "",
    hipCm: "",
    heightFt: "",
    heightIn: "",
    neckIn: "",
    abdomenIn: "",
    waistIn: "",
    hipIn: ""
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
  sanitized.unit = rawState.unit === "imperial" ? "imperial" : "metric";
  sanitized.sex = SEX_KEYS.includes(rawState.sex) ? rawState.sex : "male";

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

function heightCmFromImperial(heightFt, heightIn) {
  const totalInches = heightFt * 12 + heightIn;
  return totalInches * CM_PER_INCH;
}

/** @param {object} sanitized form state (metric or imperial) */
export function buildInchValuesFromForm(sanitized) {
  const sex = sanitized.sex === "female" ? "female" : "male";

  if (sanitized.unit === "imperial") {
    const ft = Number(sanitized.heightFt);
    const inch = Number(sanitized.heightIn);
    const heightIn = ft * 12 + inch;
    const neckIn = Number(sanitized.neckIn);
    if (sex === "male") {
      return {
        heightIn,
        neckIn,
        abdomenIn: Number(sanitized.abdomenIn)
      };
    }
    return {
      heightIn,
      neckIn,
      waistIn: Number(sanitized.waistIn),
      hipIn: Number(sanitized.hipIn)
    };
  }

  const heightIn = Number(sanitized.heightCm) / CM_PER_INCH;
  const neckIn = Number(sanitized.neckCm) / CM_PER_INCH;
  if (sex === "male") {
    return {
      heightIn,
      neckIn,
      abdomenIn: Number(sanitized.abdomenCm) / CM_PER_INCH
    };
  }
  return {
    heightIn,
    neckIn,
    waistIn: Number(sanitized.waistCm) / CM_PER_INCH,
    hipIn: Number(sanitized.hipCm) / CM_PER_INCH
  };
}

export function inchValuesToMetricFormFields(v, sex) {
  const heightCm = v.heightIn * CM_PER_INCH;
  const neckCm = v.neckIn * CM_PER_INCH;
  const base = {
    heightCm: formatInputValue(heightCm, 1),
    neckCm: formatInputValue(neckCm, 1)
  };
  if (sex === "male") {
    return {
      ...base,
      abdomenCm: formatInputValue(v.abdomenIn * CM_PER_INCH, 1)
    };
  }
  return {
    ...base,
    waistCm: formatInputValue(v.waistIn * CM_PER_INCH, 1),
    hipCm: formatInputValue(v.hipIn * CM_PER_INCH, 1)
  };
}

export function inchValuesToImperialFormFields(v, sex) {
  const heightFt = Math.floor(v.heightIn / 12);
  const heightInRem = v.heightIn - heightFt * 12;
  const base = {
    heightFt: String(heightFt),
    heightIn: formatInputValue(heightInRem, 1),
    neckIn: formatInputValue(v.neckIn, 1)
  };
  if (sex === "male") {
    return {
      ...base,
      abdomenIn: formatInputValue(v.abdomenIn, 1)
    };
  }
  return {
    ...base,
    waistIn: formatInputValue(v.waistIn, 1),
    hipIn: formatInputValue(v.hipIn, 1)
  };
}

export function validateFormState(formState) {
  const sanitized = sanitizePersistedState(formState);
  const errors = {};
  const sex = sanitized.sex === "female" ? "female" : "male";
  const activeFieldIds = getActiveFieldIds(sex, sanitized.unit);

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
    const neckResult = parseNumericValue(sanitized.neckIn, "form.fields.neckIn.errors", {
      min: MIN_NECK_IN,
      max: MAX_NECK_IN
    });

    if (feetResult.errorKey) errors.heightFt = feetResult.errorKey;
    if (inchesResult.errorKey) errors.heightIn = inchesResult.errorKey;
    if (neckResult.errorKey) errors.neckIn = neckResult.errorKey;

    if (sex === "male") {
      const ab = parseNumericValue(sanitized.abdomenIn, "form.fields.abdomenIn.errors", {
        min: MIN_ABDOMEN_IN,
        max: MAX_ABDOMEN_IN
      });
      if (ab.errorKey) errors.abdomenIn = ab.errorKey;
    } else {
      const waist = parseNumericValue(sanitized.waistIn, "form.fields.waistIn.errors", {
        min: MIN_WAIST_IN,
        max: MAX_WAIST_IN
      });
      const hip = parseNumericValue(sanitized.hipIn, "form.fields.hipIn.errors", {
        min: MIN_HIP_IN,
        max: MAX_HIP_IN
      });
      if (waist.errorKey) errors.waistIn = waist.errorKey;
      if (hip.errorKey) errors.hipIn = hip.errorKey;
    }

    if (Object.keys(errors).length === 0) {
      const heightCm = heightCmFromImperial(feetResult.value, inchesResult.value);
      if (heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) {
        errors.heightFt = "form.fields.heightFt.errors.combinedRange";
        errors.heightIn = "form.fields.heightIn.errors.combinedRange";
      }
    }

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

    const inchVals = buildInchValuesFromForm(sanitized);
    if (sex === "male") {
      if (inchVals.abdomenIn <= inchVals.neckIn) {
        errors.abdomenIn = "form.errors.geometry.abdomenNeck";
      }
    } else if (inchVals.waistIn + inchVals.hipIn <= inchVals.neckIn) {
      errors.waistIn = "form.errors.geometry.waistHipNeck";
      errors.hipIn = "form.errors.geometry.waistHipNeck";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      values: Object.keys(errors).length === 0 ? inchVals : null,
      sanitized,
      hasAnyValue: hasAnyInputValue(sanitized),
      activeFieldIds
    };
  }

  const heightResult = parseNumericValue(sanitized.heightCm, "form.fields.heightCm.errors", {
    min: MIN_HEIGHT_CM,
    max: MAX_HEIGHT_CM
  });
  const neckResult = parseNumericValue(sanitized.neckCm, "form.fields.neckCm.errors", {
    min: MIN_NECK_CM,
    max: MAX_NECK_CM
  });

  if (heightResult.errorKey) errors.heightCm = heightResult.errorKey;
  if (neckResult.errorKey) errors.neckCm = neckResult.errorKey;

  if (sex === "male") {
    const ab = parseNumericValue(sanitized.abdomenCm, "form.fields.abdomenCm.errors", {
      min: MIN_ABDOMEN_CM,
      max: MAX_ABDOMEN_CM
    });
    if (ab.errorKey) errors.abdomenCm = ab.errorKey;
  } else {
    const waist = parseNumericValue(sanitized.waistCm, "form.fields.waistCm.errors", {
      min: MIN_WAIST_CM,
      max: MAX_WAIST_CM
    });
    const hip = parseNumericValue(sanitized.hipCm, "form.fields.hipCm.errors", {
      min: MIN_HIP_CM,
      max: MAX_HIP_CM
    });
    if (waist.errorKey) errors.waistCm = waist.errorKey;
    if (hip.errorKey) errors.hipCm = hip.errorKey;
  }

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

  const inchVals = buildInchValuesFromForm(sanitized);
  if (sex === "male") {
    if (inchVals.abdomenIn <= inchVals.neckIn) {
      errors.abdomenCm = "form.errors.geometry.abdomenNeck";
    }
  } else if (inchVals.waistIn + inchVals.hipIn <= inchVals.neckIn) {
    errors.waistCm = "form.errors.geometry.waistHipNeck";
    errors.hipCm = "form.errors.geometry.waistHipNeck";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: Object.keys(errors).length === 0 ? inchVals : null,
    sanitized,
    hasAnyValue: hasAnyInputValue(sanitized),
    activeFieldIds
  };
}

export function interpretBodyFat(sex, bodyFatPercent) {
  const bf = Number(bodyFatPercent);
  if (sex === "female") {
    if (bf < 14) {
      return {
        tone: "essential",
        badgeVariant: "info",
        badgeKey: "result.badges.essential",
        categoryKey: "result.categories.essentialFemale",
        messageKey: "result.messages.essentialFemale"
      };
    }
    if (bf < 21) {
      return {
        tone: "athletic",
        badgeVariant: "success",
        badgeKey: "result.badges.athletic",
        categoryKey: "result.categories.athleticFemale",
        messageKey: "result.messages.athleticFemale"
      };
    }
    if (bf < 25) {
      return {
        tone: "fitness",
        badgeVariant: "success",
        badgeKey: "result.badges.fitness",
        categoryKey: "result.categories.fitnessFemale",
        messageKey: "result.messages.fitnessFemale"
      };
    }
    if (bf < 32) {
      return {
        tone: "average",
        badgeVariant: "warning",
        badgeKey: "result.badges.average",
        categoryKey: "result.categories.averageFemale",
        messageKey: "result.messages.averageFemale"
      };
    }
    return {
      tone: "obese",
      badgeVariant: "error",
      badgeKey: "result.badges.obese",
      categoryKey: "result.categories.obeseFemale",
      messageKey: "result.messages.obeseFemale"
    };
  }

  if (bf < 6) {
    return {
      tone: "essential",
      badgeVariant: "info",
      badgeKey: "result.badges.essential",
      categoryKey: "result.categories.essentialMale",
      messageKey: "result.messages.essentialMale"
    };
  }
  if (bf < 14) {
    return {
      tone: "athletic",
      badgeVariant: "success",
      badgeKey: "result.badges.athletic",
      categoryKey: "result.categories.athleticMale",
      messageKey: "result.messages.athleticMale"
    };
  }
  if (bf < 18) {
    return {
      tone: "fitness",
      badgeVariant: "success",
      badgeKey: "result.badges.fitness",
      categoryKey: "result.categories.fitnessMale",
      messageKey: "result.messages.fitnessMale"
    };
  }
  if (bf < 25) {
    return {
      tone: "average",
      badgeVariant: "warning",
      badgeKey: "result.badges.average",
      categoryKey: "result.categories.averageMale",
      messageKey: "result.messages.averageMale"
    };
  }
  return {
    tone: "obese",
    badgeVariant: "error",
    badgeKey: "result.badges.obese",
    categoryKey: "result.categories.obeseMale",
    messageKey: "result.messages.obeseMale"
  };
}

/**
 * @param {object} inchValues from validateFormState
 * @param {"male"|"female"} sex
 */
export function calculateBodyFat(inchValues, sex) {
  const s = sex === "female" ? "female" : "male";
  const heightIn = inchValues.heightIn;
  const neckIn = inchValues.neckIn;

  if (!Number.isFinite(heightIn) || heightIn <= 0 || !Number.isFinite(neckIn) || neckIn <= 0) {
    return { ok: false, errorKey: "form.errors.unrealisticResult" };
  }

  let bodyFatPercent;
  if (s === "male") {
    const abdomenIn = inchValues.abdomenIn;
    if (!Number.isFinite(abdomenIn) || abdomenIn <= neckIn) {
      return { ok: false, errorKey: "form.errors.unrealisticResult" };
    }
    bodyFatPercent =
      86.010 * log10(abdomenIn - neckIn) - 70.041 * log10(heightIn) + 36.76;
  } else {
    const waistIn = inchValues.waistIn;
    const hipIn = inchValues.hipIn;
    if (!Number.isFinite(waistIn) || !Number.isFinite(hipIn) || waistIn + hipIn <= neckIn) {
      return { ok: false, errorKey: "form.errors.unrealisticResult" };
    }
    bodyFatPercent =
      163.205 * log10(waistIn + hipIn - neckIn) -
      97.684 * log10(heightIn) -
      78.387;
  }

  if (!Number.isFinite(bodyFatPercent) || bodyFatPercent < MIN_BF_DISPLAY || bodyFatPercent > MAX_BF_DISPLAY) {
    return { ok: false, errorKey: "form.errors.unrealisticResult" };
  }

  return {
    ok: true,
    bodyFatPercent,
    interpretation: interpretBodyFat(s, bodyFatPercent)
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
  const calc =
    validation.isValid && validation.values
      ? calculateBodyFat(validation.values, formState.sex)
      : null;
  const result = calc && calc.ok ? calc : null;

  return {
    formState,
    validation,
    result
  };
}
