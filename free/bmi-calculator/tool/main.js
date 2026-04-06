import {
  FIELD_IDS,
  STORAGE_KEY,
  buildRestoredViewModel,
  calculateBmi,
  convertMetricToImperialValues,
  createEmptyFormState,
  formatDecimal,
  formatInputValue,
  sanitizePersistedState,
  validateFormState
} from "./lib/calculator.js";
import {
  clearPersistedState,
  createStorageAdapter,
  readPersistedState,
  writePersistedState
} from "./lib/storage.js";

const SESSION_SNAPSHOT_VERSION = 2;

const ui = window.UtilivosUI;
const dom = {
  inputs: {},
  shells: {},
  errors: {}
};

let storageAdapter = null;
let session = null;
let formState = createEmptyFormState();
let touched = createTouchedState();
let validation = validateFormState(formState);
let result = null;
let persistTimer = 0;

function createTouchedState(markFilled = false) {
  return FIELD_IDS.reduce((accumulator, fieldId) => {
    const currentValue = String(formState[fieldId] ?? "").trim();
    accumulator[fieldId] = markFilled ? currentValue.length > 0 : false;
    return accumulator;
  }, {});
}

function t(key, values) {
  return ui.t(key, values);
}

function getSessionSnapshot() {
  return { v: SESSION_SNAPSHOT_VERSION, ...sanitizePersistedState(formState) };
}

function applySessionSnapshot(data) {
  if (!data || typeof data !== "object") {
    return;
  }
  formState = sanitizePersistedState(data);
  touched = createTouchedState(true);
  syncDomFromState();
  recompute();
  render();
}

function cacheDom() {
  dom.form = document.getElementById("calculatorForm");
  dom.formStatus = document.getElementById("formStatus");
  dom.reviewButton = document.getElementById("reviewButton");
  dom.resetButton = document.getElementById("resetButton");
  dom.unitMetric = document.getElementById("unitMetric");
  dom.unitImperial = document.getElementById("unitImperial");
  dom.metricFields = document.getElementById("metricFields");
  dom.imperialFields = document.getElementById("imperialFields");
  dom.resultCard = document.getElementById("resultCard");
  dom.resultBadge = document.getElementById("resultBadge");
  dom.resultScore = document.getElementById("resultScore");
  dom.resultCategory = document.getElementById("resultCategory");
  dom.resultMessage = document.getElementById("resultMessage");
  dom.healthyRangeValue = document.getElementById("healthyRangeValue");
  dom.heightValue = document.getElementById("heightValue");
  dom.weightValue = document.getElementById("weightValue");

  for (const fieldId of FIELD_IDS) {
    dom.inputs[fieldId] = document.getElementById(fieldId);
    dom.shells[fieldId] = document.getElementById(`${fieldId}Shell`);
    dom.errors[fieldId] = document.getElementById(`${fieldId}Error`);
  }
}

function syncDomFromState() {
  for (const [fieldId, input] of Object.entries(dom.inputs)) {
    input.value = formState[fieldId];
  }

  const isMetric = formState.unit === "metric";
  dom.unitMetric.setAttribute("aria-selected", String(isMetric));
  dom.unitImperial.setAttribute("aria-selected", String(!isMetric));
  dom.unitMetric.tabIndex = isMetric ? 0 : -1;
  dom.unitImperial.tabIndex = isMetric ? -1 : 0;
  dom.metricFields.hidden = !isMetric;
  dom.imperialFields.hidden = isMetric;
}

function bindEvents() {
  for (const [fieldId, input] of Object.entries(dom.inputs)) {
    input.addEventListener("input", (event) => {
      formState[fieldId] = event.target.value;
      touched[fieldId] = touched[fieldId] || String(event.target.value).trim().length > 0;
      recompute();
      render();
      queuePersist();
    });

    input.addEventListener("blur", () => {
      touched[fieldId] = true;
      recompute();
      render();
      session?.persistNow();
    });
  }

  dom.unitMetric.addEventListener("click", () => {
    switchUnit("metric");
  });

  dom.unitImperial.addEventListener("click", () => {
    switchUnit("imperial");
  });

  dom.form.addEventListener("submit", (event) => {
    event.preventDefault();
    markActiveFieldsTouched();
    recompute();
    render();

    if (!validation.isValid) {
      focusFirstInvalidField();
      return;
    }

    focusResultCard();
    queuePersist();
  });

  dom.resetButton.addEventListener("click", () => {
    formState = createEmptyFormState();
    touched = createTouchedState();
    syncDomFromState();
    recompute();
    render();
    clearTimeout(persistTimer);
    void clearPersistedState(storageAdapter, STORAGE_KEY).catch(() => {});
    session?.persistNow();
  });
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function isSmallViewport() {
  return window.matchMedia?.("(max-width: 840px)")?.matches ?? false;
}

function markActiveFieldsTouched() {
  for (const fieldId of validation.activeFieldIds) {
    touched[fieldId] = true;
  }
}

function focusFirstInvalidField() {
  for (const fieldId of validation.activeFieldIds) {
    if (!validation.errors[fieldId]) {
      continue;
    }
    dom.inputs[fieldId]?.focus();
    return;
  }
}

function focusResultCard() {
  if (isSmallViewport()) {
    dom.resultCard.scrollIntoView({
      block: "start",
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
  }

  try {
    dom.resultCard.focus({ preventScroll: true });
  } catch (_) {
    dom.resultCard.focus();
  }
}

function switchUnit(nextUnit) {
  if (nextUnit === formState.unit) {
    return;
  }

  const currentValidation = validateFormState(formState);
  let nextState = { ...formState, unit: nextUnit };

  if (currentValidation.isValid) {
    if (nextUnit === "imperial") {
      nextState = {
        ...formState,
        unit: nextUnit,
        ...convertMetricToImperialValues(currentValidation.values)
      };
    } else {
      nextState = {
        ...formState,
        unit: nextUnit,
        heightCm: formatInputValue(currentValidation.values.heightCm, 1),
        weightKg: formatInputValue(currentValidation.values.weightKg, 1)
      };
    }
  }

  formState = sanitizePersistedState(nextState);
  touched = createTouchedState();
  syncDomFromState();
  recompute();
  render();
  queuePersist();
}

function recompute() {
  validation = validateFormState(formState);
  result = validation.isValid ? calculateBmi(validation.values) : null;
}

function queuePersist() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    void writePersistedState(storageAdapter, STORAGE_KEY, sanitizePersistedState(formState)).catch(
      () => {}
    );
  }, 120);
  session?.schedulePersist();
}

function renderFieldError(fieldId) {
  const input = dom.inputs[fieldId];
  const shell = dom.shells[fieldId];
  const errorNode = dom.errors[fieldId];
  const shouldShowError = Boolean(validation.errors[fieldId] && touched[fieldId]);

  input.setAttribute("aria-invalid", shouldShowError ? "true" : "false");
  shell.dataset.invalid = shouldShowError ? "true" : "false";
  errorNode.textContent = shouldShowError ? t(validation.errors[fieldId]) : "";
}

function renderStatus() {
  let statusKey = "status.empty";
  if (validation.isValid) {
    statusKey = `status.ready.${formState.unit}`;
  } else if (validation.hasAnyValue) {
    statusKey = "status.incomplete";
  }

  dom.formStatus.textContent = t(statusKey);
  dom.reviewButton.disabled = !validation.isValid;
}

function setBadgeVariant(node, variant) {
  node.classList.remove("uv-badge--info", "uv-badge--success", "uv-badge--warning", "uv-badge--error");
  node.classList.add(`uv-badge--${variant}`);
}

function renderResult() {
  dom.resultCard.classList.remove(
    "bmi-result--empty",
    "bmi-result--underweight",
    "bmi-result--healthy",
    "bmi-result--overweight",
    "bmi-result--obesity"
  );

  if (!result) {
    dom.resultCard.classList.add("bmi-result--empty");
    setBadgeVariant(dom.resultBadge, "info");
    dom.resultBadge.textContent = t("result.badges.waiting");
    dom.resultScore.textContent = t("common.emptyValue");
    dom.resultCategory.textContent = t("result.empty.category");
    dom.resultMessage.textContent = t("result.empty.body");
    dom.healthyRangeValue.textContent = t("common.emptyValue");
    dom.heightValue.textContent = t("common.emptyValue");
    dom.weightValue.textContent = t("common.emptyValue");
    return;
  }

  const interpretation = result.interpretation;
  dom.resultCard.classList.add(`bmi-result--${interpretation.tone}`);
  setBadgeVariant(dom.resultBadge, interpretation.badgeVariant);
  dom.resultBadge.textContent = t(interpretation.badgeKey);
  dom.resultScore.textContent = formatDecimal(result.bmi, 1);
  dom.resultCategory.textContent = t(interpretation.categoryKey);
  dom.resultMessage.textContent = t(interpretation.messageKey);

  if (formState.unit === "imperial") {
    const imperialValues = convertMetricToImperialValues(result.metric);
    dom.healthyRangeValue.textContent = t("result.range.imperial", {
      min: formatDecimal(result.healthyWeightRange.minLb, 1),
      max: formatDecimal(result.healthyWeightRange.maxLb, 1)
    });
    dom.heightValue.textContent = t("result.measurements.imperial.height", {
      feet: imperialValues.heightFt,
      inches: imperialValues.heightIn
    });
    dom.weightValue.textContent = t("result.measurements.imperial.weight", {
      value: imperialValues.weightLb
    });
    return;
  }

  dom.healthyRangeValue.textContent = t("result.range.metric", {
    min: formatDecimal(result.healthyWeightRange.minKg, 1),
    max: formatDecimal(result.healthyWeightRange.maxKg, 1)
  });
  dom.heightValue.textContent = t("result.measurements.metric.height", {
    value: formatInputValue(result.metric.heightCm, 1)
  });
  dom.weightValue.textContent = t("result.measurements.metric.weight", {
    value: formatInputValue(result.metric.weightKg, 1)
  });
}

function render() {
  for (const fieldId of FIELD_IDS) {
    renderFieldError(fieldId);
  }

  renderStatus();
  renderResult();
}

async function restoreState() {
  const restoredState = await readPersistedState(storageAdapter, STORAGE_KEY, sanitizePersistedState);
  if (!restoredState) {
    syncDomFromState();
    recompute();
    render();
    return;
  }

  const restoredModel = buildRestoredViewModel(restoredState);
  formState = restoredModel.formState;
  validation = restoredModel.validation;
  result = restoredModel.result;
  touched = createTouchedState(true);
  syncDomFromState();
  render();
}

async function bootstrap() {
  if (!ui) {
    return;
  }

  ui.ensureToolPage();
  await ui.initLocalization({
    defaultLocale: "en",
    supportedLocales: ["en"],
    basePath: "./locales"
  });

  cacheDom();
  storageAdapter = createStorageAdapter(window);

  const runtime = window.UtilivosRuntime;
  if (runtime && typeof runtime.syncState === "function") {
    session = window.UtilivosRuntime.syncState({
      read: getSessionSnapshot,
      write: applySessionSnapshot,
      debounceMs: 400
    });
    if (typeof runtime.registerSessionRestore === "function") {
      runtime.registerSessionRestore((snapshot) => {
        applySessionSnapshot(snapshot);
        session.persistNow();
      });
    }
  }

  bindEvents();

  if (session && window.UtilivosRuntime?.shouldHydrateFromHost?.()) {
    await session.hydrateFromHost();
  } else {
    await restoreState();
  }

  session?.persistNow();
}

bootstrap().catch((error) => {
  console.error(error);
});
