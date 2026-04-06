import {
  FIELD_IDS,
  STORAGE_KEY,
  buildRestoredViewModel,
  calculateFib4,
  createEmptyFormState,
  formatDecimal,
  sanitizePersistedState,
  validateFormState
} from "./lib/calculator.js";
import {
  clearPersistedState,
  createStorageAdapter,
  readPersistedState,
  writePersistedState
} from "./lib/storage.js";

const ui = window.UtilivosUI;
const dom = {
  inputs: {},
  shells: {},
  errors: {}
};

let storageAdapter = null;
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

function cacheDom() {
  dom.form = document.getElementById("calculatorForm");
  dom.status = document.getElementById("formStatus");
  dom.calculateButton = document.getElementById("calculateButton");
  dom.resetButton = document.getElementById("resetButton");
  dom.resultCard = document.getElementById("resultCard");
  dom.resultBadge = document.getElementById("resultBadge");
  dom.resultScore = document.getElementById("resultScore");
  dom.resultCategory = document.getElementById("resultCategory");
  dom.resultInterpretation = document.getElementById("resultInterpretation");
  dom.sqrtAltValue = document.getElementById("sqrtAltValue");
  dom.thresholdValue = document.getElementById("thresholdValue");

  for (const fieldId of FIELD_IDS) {
    dom.inputs[fieldId] = document.getElementById(fieldId);
    dom.shells[fieldId] = document.getElementById(`${fieldId}Shell`);
    dom.errors[fieldId] = document.getElementById(`${fieldId}Error`);
  }
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
    });
  }

  dom.form.addEventListener("submit", (event) => {
    event.preventDefault();
    markAllTouched();
    recompute();
    render();

    if (!validation.isValid) {
      focusFirstInvalidField();
      return;
    }

    dom.resultCard.scrollIntoView({
      block: "start",
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
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
  });
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function syncDomFromState() {
  for (const [fieldId, input] of Object.entries(dom.inputs)) {
    input.value = formState[fieldId];
  }
}

function recompute() {
  validation = validateFormState(formState);
  result = validation.isValid ? calculateFib4(validation.values) : null;
}

function queuePersist() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    void writePersistedState(storageAdapter, STORAGE_KEY, sanitizePersistedState(formState)).catch(
      () => {},
    );
  }, 120);
}

function markAllTouched() {
  for (const fieldId of FIELD_IDS) {
    touched[fieldId] = true;
  }
}

function focusFirstInvalidField() {
  for (const fieldId of FIELD_IDS) {
    if (!validation.errors[fieldId]) {
      continue;
    }
    dom.inputs[fieldId]?.focus();
    return;
  }
}

function renderFieldError(fieldId) {
  const errorNode = dom.errors[fieldId];
  const container = dom.shells[fieldId];
  const control = dom.inputs[fieldId];
  const shouldShowError = Boolean(validation.errors[fieldId] && touched[fieldId]);
  const errorMessage = shouldShowError ? t(validation.errors[fieldId]) : "";

  errorNode.textContent = errorMessage;
  container.dataset.invalid = shouldShowError ? "true" : "false";
  control.setAttribute("aria-invalid", shouldShowError ? "true" : "false");
}

function renderStatus() {
  let statusKey = "status.empty";
  if (validation.isValid) {
    statusKey = "status.ready";
  } else if (validation.hasAnyValue) {
    statusKey = "status.incomplete";
  }
  dom.status.textContent = t(statusKey);
}

function renderResult() {
  dom.resultCard.classList.remove(
    "f4-result--empty",
    "f4-result--low",
    "f4-result--indeterminate",
    "f4-result--high",
  );

  if (!result) {
    dom.resultCard.classList.add("f4-result--empty");
    dom.resultBadge.textContent = t("result.badges.waiting");
    dom.resultScore.textContent = t("common.emptyValue");
    dom.resultCategory.textContent = t("result.empty.category");
    dom.resultInterpretation.textContent = t("result.empty.body");
    dom.sqrtAltValue.textContent = t("common.emptyValue");
    dom.thresholdValue.textContent = t("common.emptyValue");
    return;
  }

  const tone = result.interpretation.tone;
  dom.resultCard.classList.add(`f4-result--${tone}`);
  dom.resultBadge.textContent = t(result.interpretation.badgeKey);
  dom.resultScore.textContent = formatDecimal(result.score);
  dom.resultCategory.textContent = t(result.interpretation.categoryKey);
  dom.resultInterpretation.textContent = t(result.interpretation.messageKey);
  dom.sqrtAltValue.textContent = formatDecimal(result.sqrtAlt);
  dom.thresholdValue.textContent = t(result.interpretation.thresholdKey);
}

function render() {
  for (const fieldId of FIELD_IDS) {
    renderFieldError(fieldId);
  }

  dom.calculateButton.disabled = !validation.isValid;
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
  touched = FIELD_IDS.reduce((accumulator, fieldId) => {
    accumulator[fieldId] = String(formState[fieldId] ?? "").trim().length > 0;
    return accumulator;
  }, {});
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
  bindEvents();
  await restoreState();
}

bootstrap().catch((error) => {
  console.error(error);
});
