import {
  FIELD_IDS,
  STORAGE_KEY,
  buildRestoredViewModel,
  computeHeartRateZones,
  createEmptyFormState,
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
  recompute();
  render();
}

function cacheDom() {
  dom.form = document.getElementById("calculatorForm");
  dom.formStatus = document.getElementById("formStatus");
  dom.calculateButton = document.getElementById("calculateButton");
  dom.resetButton = document.getElementById("resetButton");
  dom.resultCard = document.getElementById("resultCard");
  dom.resultBadge = document.getElementById("resultBadge");
  dom.resultMaxHr = document.getElementById("resultMaxHr");
  dom.resultHrr = document.getElementById("resultHrr");
  dom.zonesWrap = document.getElementById("zonesWrap");
  dom.zonesBody = document.getElementById("zonesBody");
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

function recompute() {
  validation = validateFormState(formState);
  formulaErrorKey = null;
  if (!validation.isValid || !validation.values) {
    result = null;
    return;
  }

  const calc = computeHeartRateZones(validation.values);
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
    statusKey = "status.ready";
  } else if (validation.hasAnyValue) {
    statusKey = "status.incomplete";
  }

  dom.formStatus.textContent = t(statusKey);
  dom.calculateButton.disabled = !validation.isValid;
}

function setBadgeVariant(node, variant) {
  node.classList.remove("uv-badge--info", "uv-badge--success", "uv-badge--warning", "uv-badge--error");
  node.classList.add(`uv-badge--${variant}`);
}

function renderZonesTable() {
  dom.zonesBody.innerHTML = "";

  if (!result) {
    dom.zonesWrap.hidden = true;
    return;
  }

  dom.zonesWrap.hidden = false;

  for (const zone of result.zones) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    nameCell.textContent = t(`result.zones.${zone.id}.name`);

    const pctCell = document.createElement("td");
    pctCell.textContent = t("result.zones.percentRange", {
      low: Math.round(zone.pctLow * 100),
      high: Math.round(zone.pctHigh * 100)
    });

    const bpmCell = document.createElement("td");
    bpmCell.textContent = t("result.zones.bpmRange", {
      low: String(zone.bpmLow),
      high: String(zone.bpmHigh)
    });

    row.appendChild(nameCell);
    row.appendChild(pctCell);
    row.appendChild(bpmCell);
    dom.zonesBody.appendChild(row);
  }
}

function renderResult() {
  dom.resultCard.classList.remove("hrz-result--empty", "hrz-result--ready");
  dom.resultFormulaError.hidden = true;
  dom.resultFormulaError.textContent = "";

  if (formulaErrorKey) {
    dom.resultCard.classList.add("hrz-result--empty");
    setBadgeVariant(dom.resultBadge, "warning");
    dom.resultBadge.textContent = t("result.badges.checkInputs");
    dom.resultMaxHr.textContent = t("common.emptyValue");
    dom.resultHrr.textContent = t("common.emptyValue");
    renderZonesTable();
    dom.resultFormulaError.hidden = false;
    dom.resultFormulaError.textContent = t(formulaErrorKey);
    return;
  }

  if (!result) {
    dom.resultCard.classList.add("hrz-result--empty");
    setBadgeVariant(dom.resultBadge, "info");
    dom.resultBadge.textContent = t("result.badges.waiting");
    dom.resultMaxHr.textContent = t("common.emptyValue");
    dom.resultHrr.textContent = t("common.emptyValue");
    renderZonesTable();
    return;
  }

  dom.resultCard.classList.add("hrz-result--ready");
  setBadgeVariant(dom.resultBadge, "success");
  dom.resultBadge.textContent = t("result.badges.ready");
  dom.resultMaxHr.textContent = t("result.summary.bpmValue", { value: String(result.maxHr) });
  dom.resultHrr.textContent = t("result.summary.bpmValue", { value: String(result.hrr) });
  renderZonesTable();
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
  formulaErrorKey = null;
  if (validation.isValid && validation.values && !result) {
    const calc = computeHeartRateZones(validation.values);
    if (!calc.ok) {
      formulaErrorKey = calc.errorKey;
    }
  }
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

  recompute();
  render();
  session?.persistNow();
}

bootstrap().catch((error) => {
  console.error(error);
});
