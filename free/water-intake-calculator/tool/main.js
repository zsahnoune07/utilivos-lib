import {
  FIELD_IDS,
  STORAGE_KEY,
  buildRestoredViewModel,
  calculateWaterIntake,
  createEmptyFormState,
  formatDecimal,
  formatInputValue,
  kgToPounds,
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
const ML_PER_8OZ = 236.5882365;
const ML_PER_GLASS = 250;

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
  dom.calculateButton = document.getElementById("calculateButton");
  dom.resetButton = document.getElementById("resetButton");
  dom.unitMetric = document.getElementById("unitMetric");
  dom.unitImperial = document.getElementById("unitImperial");
  dom.metricFields = document.getElementById("metricFields");
  dom.imperialFields = document.getElementById("imperialFields");
  dom.sex = document.getElementById("sex");
  dom.activity = document.getElementById("activity");
  dom.climate = document.getElementById("climate");
  dom.pregnancy = document.getElementById("pregnancy");
  dom.resultCard = document.getElementById("resultCard");
  dom.resultBadge = document.getElementById("resultBadge");
  dom.resultTotalMl = document.getElementById("resultTotalMl");
  dom.resultLiters = document.getElementById("resultLiters");
  dom.resultCups = document.getElementById("resultCups");
  dom.resultGlasses = document.getElementById("resultGlasses");
  dom.resultCategory = document.getElementById("resultCategory");
  dom.resultMessage = document.getElementById("resultMessage");
  dom.breakdownBlock = document.getElementById("breakdownBlock");
  dom.breakdownList = document.getElementById("breakdownList");

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

  dom.sex.value = formState.sex;
  dom.activity.value = formState.activity;
  dom.climate.value = formState.climate;
  dom.pregnancy.value = formState.pregnancy;

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

  for (const select of [dom.sex, dom.activity, dom.climate, dom.pregnancy]) {
    select.addEventListener("change", (event) => {
      const { id, value } = event.target;
      if (id === "sex") {
        formState.sex = value;
      } else if (id === "activity") {
        formState.activity = value;
      } else if (id === "climate") {
        formState.climate = value;
      } else if (id === "pregnancy") {
        formState.pregnancy = value;
      }
      recompute();
      render();
      queuePersist();
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
    const wkg = currentValidation.values.weightKg;
    if (nextUnit === "imperial") {
      const lb = kgToPounds(wkg);
      nextState = {
        ...formState,
        unit: nextUnit,
        weightLb: formatInputValue(lb, 1),
        weightKg: formState.weightKg
      };
    } else {
      nextState = {
        ...formState,
        unit: nextUnit,
        weightKg: formatInputValue(wkg, 1),
        weightLb: formState.weightLb
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
  result = validation.isValid ? calculateWaterIntake(validation.values) : null;
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
  const errorMessage = shouldShowError ? t(validation.errors[fieldId]) : "";

  input.setAttribute("aria-invalid", shouldShowError ? "true" : "false");
  shell.dataset.invalid = shouldShowError ? "true" : "false";
  errorNode.textContent = errorMessage;
}

function renderStatus() {
  let statusKey = "form.status.empty";
  if (validation.isValid) {
    statusKey = "form.status.ready";
  } else if (validation.hasAnyValue) {
    statusKey = "form.status.incomplete";
  }
  dom.formStatus.textContent = t(statusKey);
  dom.calculateButton.disabled = !validation.isValid;
}

function setBadgeVariant(node, variant) {
  node.classList.remove("uv-badge--info", "uv-badge--success", "uv-badge--warning", "uv-badge--error");
  node.classList.add(`uv-badge--${variant}`);
}

function renderBreakdown() {
  dom.breakdownList.innerHTML = "";
  if (!result) {
    dom.breakdownBlock.hidden = true;
    return;
  }

  dom.breakdownBlock.hidden = false;
  const { breakdown } = result;
  const items = [
    t("result.breakdown.base", {
      mlPerKg: String(breakdown.mlPerKg),
      value: String(breakdown.baseMl)
    }),
    t("result.breakdown.activity", { value: String(breakdown.activityMl) }),
    t("result.breakdown.climate", { value: String(breakdown.climateMl) }),
    t("result.breakdown.pregnancy", { value: String(breakdown.pregnancyMl) })
  ];

  for (const text of items) {
    const li = document.createElement("li");
    li.textContent = text;
    dom.breakdownList.appendChild(li);
  }
}

function renderResult() {
  dom.resultCard.classList.remove("wi-result--empty", "wi-result--ready");

  if (!result) {
    dom.resultCard.classList.add("wi-result--empty");
    setBadgeVariant(dom.resultBadge, "info");
    dom.resultBadge.textContent = t("result.badges.waiting");
    dom.resultTotalMl.textContent = t("common.emptyValue");
    dom.resultLiters.textContent = "";
    dom.resultCups.textContent = "";
    dom.resultGlasses.textContent = "";
    dom.resultCategory.textContent = t("result.empty.category");
    dom.resultMessage.textContent = t("result.empty.body");
    renderBreakdown();
    return;
  }

  dom.resultCard.classList.add("wi-result--ready");
  setBadgeVariant(dom.resultBadge, "success");
  dom.resultBadge.textContent = t("result.badges.ready");

  const total = result.totalMl;
  const liters = total / 1000;
  const cups = Math.round(total / ML_PER_8OZ);
  const glasses = Math.round(total / ML_PER_GLASS);

  dom.resultTotalMl.textContent = t("result.metrics.ml.value", {
    value: String(total.toLocaleString("en-US"))
  });
  dom.resultLiters.textContent = t("result.metrics.liters.value", {
    value: formatDecimal(liters, 2)
  });
  dom.resultCups.textContent = t("result.metrics.cups.value", { value: String(cups) });
  dom.resultGlasses.textContent = t("result.metrics.glasses.value", { value: String(glasses) });
  dom.resultCategory.textContent = "";
  dom.resultMessage.textContent = "";

  renderBreakdown();
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
