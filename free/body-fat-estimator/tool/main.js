import {
  FIELD_IDS,
  STORAGE_KEY,
  buildRestoredViewModel,
  calculateBodyFat,
  createEmptyFormState,
  formatDecimal,
  inchValuesToImperialFormFields,
  inchValuesToMetricFormFields,
  sanitizePersistedState,
  validateFormState
} from "./lib/calculator.js";
import {
  clearPersistedState,
  createStorageAdapter,
  readPersistedState,
  writePersistedState
} from "./lib/storage.js";

const SESSION_SNAPSHOT_VERSION = 1;

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
let formulaErrorKey = null;
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
  if (data.v !== SESSION_SNAPSHOT_VERSION) {
    return;
  }
  formState = sanitizePersistedState(data);
  touched = createTouchedState(true);
  syncDomFromState();
  updateUnitPanels();
  updateSexFieldVisibility();
  recompute();
  render();
}

function cacheDom() {
  dom.form = document.getElementById("calculatorForm");
  dom.formStatus = document.getElementById("formStatus");
  dom.calculateButton = document.getElementById("calculateButton");
  dom.resetButton = document.getElementById("resetButton");
  dom.unitMetric = document.getElementById("unitMetric");
  dom.unitImperial = document.getElementById("unitImperial");
  dom.metricFields = document.getElementById("metricFields");
  dom.imperialFields = document.getElementById("imperialFields");
  dom.sexMale = document.getElementById("sexMale");
  dom.sexFemale = document.getElementById("sexFemale");
  dom.maleMetricAbdomen = document.getElementById("maleMetricAbdomen");
  dom.femaleMetricWaist = document.getElementById("femaleMetricWaist");
  dom.femaleMetricHip = document.getElementById("femaleMetricHip");
  dom.maleImperialAbdomen = document.getElementById("maleImperialAbdomen");
  dom.femaleImperialWaist = document.getElementById("femaleImperialWaist");
  dom.femaleImperialHip = document.getElementById("femaleImperialHip");
  dom.resultCard = document.getElementById("resultCard");
  dom.resultBadge = document.getElementById("resultBadge");
  dom.resultPercent = document.getElementById("resultPercent");
  dom.resultCategory = document.getElementById("resultCategory");
  dom.resultMessage = document.getElementById("resultMessage");
  dom.resultFormulaError = document.getElementById("resultFormulaError");

  for (const fieldId of FIELD_IDS) {
    dom.inputs[fieldId] = document.getElementById(fieldId);
    dom.shells[fieldId] = document.getElementById(`${fieldId}Shell`);
    dom.errors[fieldId] = document.getElementById(`${fieldId}Error`);
  }
}

function syncDomFromState() {
  for (const [fieldId, input] of Object.entries(dom.inputs)) {
    if (input) {
      input.value = formState[fieldId];
    }
  }

  const isMetric = formState.unit === "metric";
  dom.unitMetric.setAttribute("aria-selected", String(isMetric));
  dom.unitImperial.setAttribute("aria-selected", String(!isMetric));
  dom.unitMetric.tabIndex = isMetric ? 0 : -1;
  dom.unitImperial.tabIndex = isMetric ? -1 : 0;

  const isMale = formState.sex === "male";
  dom.sexMale.setAttribute("aria-selected", String(isMale));
  dom.sexFemale.setAttribute("aria-selected", String(!isMale));
  dom.sexMale.tabIndex = isMale ? 0 : -1;
  dom.sexFemale.tabIndex = isMale ? -1 : 0;
}

function updateUnitPanels() {
  const isMetric = formState.unit === "metric";
  dom.metricFields.hidden = !isMetric;
  dom.imperialFields.hidden = isMetric;
}

function updateSexFieldVisibility() {
  const isMale = formState.sex === "male";
  dom.maleMetricAbdomen.hidden = !isMale;
  dom.maleImperialAbdomen.hidden = !isMale;
  dom.femaleMetricWaist.hidden = isMale;
  dom.femaleMetricHip.hidden = isMale;
  dom.femaleImperialWaist.hidden = isMale;
  dom.femaleImperialHip.hidden = isMale;
}

function bindEvents() {
  for (const [fieldId, input] of Object.entries(dom.inputs)) {
    if (!input) {
      continue;
    }
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

  dom.sexMale.addEventListener("click", () => {
    switchSex("male");
  });

  dom.sexFemale.addEventListener("click", () => {
    switchSex("female");
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
    updateSexFieldVisibility();
    updateUnitPanels();
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

  if (currentValidation.isValid && currentValidation.values) {
    const sex = formState.sex === "female" ? "female" : "male";
    const converted =
      nextUnit === "imperial"
        ? inchValuesToImperialFormFields(currentValidation.values, sex)
        : inchValuesToMetricFormFields(currentValidation.values, sex);
    nextState = { ...formState, unit: nextUnit, ...converted };
  }

  formState = sanitizePersistedState(nextState);
  touched = createTouchedState();
  syncDomFromState();
  updateUnitPanels();
  recompute();
  render();
  queuePersist();
}

function switchSex(nextSex) {
  if (nextSex === formState.sex) {
    return;
  }

  const nextState = { ...formState, sex: nextSex };
  if (nextSex === "male") {
    nextState.waistCm = "";
    nextState.waistIn = "";
    nextState.hipCm = "";
    nextState.hipIn = "";
  } else {
    nextState.abdomenCm = "";
    nextState.abdomenIn = "";
  }

  formState = sanitizePersistedState(nextState);
  touched = createTouchedState();
  syncDomFromState();
  updateSexFieldVisibility();
  recompute();
  render();
  queuePersist();
}

function recompute() {
  validation = validateFormState(formState);
  formulaErrorKey = null;
  if (!validation.isValid || !validation.values) {
    result = null;
    return;
  }

  const calc = calculateBodyFat(validation.values, formState.sex);
  if (calc.ok) {
    result = calc;
  } else {
    result = null;
    formulaErrorKey = calc.errorKey;
  }
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
  if (!input || !errorNode) {
    return;
  }

  const shouldShowError = Boolean(validation.errors[fieldId] && touched[fieldId]);
  input.setAttribute("aria-invalid", shouldShowError ? "true" : "false");
  if (shell) {
    shell.dataset.invalid = shouldShowError ? "true" : "false";
  }
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
  const canCalculate = validation.isValid;
  dom.calculateButton.disabled = !canCalculate;
}

function setBadgeVariant(node, variant) {
  node.classList.remove("uv-badge--info", "uv-badge--success", "uv-badge--warning", "uv-badge--error");
  node.classList.add(`uv-badge--${variant}`);
}

function renderResult() {
  dom.resultCard.classList.remove(
    "bfe-result--empty",
    "bfe-result--essential",
    "bfe-result--athletic",
    "bfe-result--fitness",
    "bfe-result--average",
    "bfe-result--obese"
  );

  dom.resultFormulaError.hidden = true;
  dom.resultFormulaError.textContent = "";

  if (formulaErrorKey) {
    dom.resultCard.classList.add("bfe-result--empty");
    setBadgeVariant(dom.resultBadge, "warning");
    dom.resultBadge.textContent = t("result.badges.checkInputs");
    dom.resultPercent.textContent = t("common.emptyValue");
    dom.resultCategory.textContent = t("result.empty.category");
    dom.resultMessage.textContent = t("result.empty.body");
    dom.resultFormulaError.hidden = false;
    dom.resultFormulaError.textContent = t(formulaErrorKey);
    return;
  }

  if (!result) {
    dom.resultCard.classList.add("bfe-result--empty");
    setBadgeVariant(dom.resultBadge, "info");
    dom.resultBadge.textContent = t("result.badges.waiting");
    dom.resultPercent.textContent = t("common.emptyValue");
    dom.resultCategory.textContent = t("result.empty.category");
    dom.resultMessage.textContent = t("result.empty.body");
    return;
  }

  const interpretation = result.interpretation;
  dom.resultCard.classList.add(`bfe-result--${interpretation.tone}`);
  setBadgeVariant(dom.resultBadge, interpretation.badgeVariant);
  dom.resultBadge.textContent = t(interpretation.badgeKey);
  dom.resultPercent.textContent = t("result.percentValue", {
    value: formatDecimal(result.bodyFatPercent, 1)
  });
  dom.resultCategory.textContent = t(interpretation.categoryKey);
  dom.resultMessage.textContent = t(interpretation.messageKey);
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
    updateSexFieldVisibility();
    updateUnitPanels();
    recompute();
    render();
    return;
  }

  const restoredModel = buildRestoredViewModel(restoredState);
  formState = restoredModel.formState;
  validation = restoredModel.validation;
  result = restoredModel.result;
  formulaErrorKey = null;
  if (validation.isValid && validation.values && !result) {
    const calc = calculateBodyFat(validation.values, formState.sex);
    if (!calc.ok) {
      formulaErrorKey = calc.errorKey;
    }
  }
  touched = createTouchedState(true);
  syncDomFromState();
  updateSexFieldVisibility();
  updateUnitPanels();
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
  updateSexFieldVisibility();
  updateUnitPanels();

  if (session && window.UtilivosRuntime?.shouldHydrateFromHost?.()) {
    await session.hydrateFromHost();
  } else {
    await restoreState();
  }

  recompute();
  render();
  session?.persistNow();
}

bootstrap().catch((error) => {
  console.error(error);
});
