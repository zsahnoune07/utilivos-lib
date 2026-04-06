import {
  STORAGE_KEY,
  createEmptyValidatorFields,
  isBitcoinError,
  validateBitcoinInput
} from "./lib/bitcoin.js";
import {
  createStorageAdapter,
  readPersistedState,
  writePersistedState
} from "./lib/storage.js";

const SESSION_SNAPSHOT_VERSION = 1;

const ui = window.UtilivosUI;
const dom = {
  valFields: {}
};

let storageAdapter = null;
let session = null;
let persistTimer = 0;
let state = createEmptyState();

function createEmptyState() {
  return {
    addressInput: "",
    fields: createEmptyValidatorFields(),
    message: { text: "", tone: "" }
  };
}

function clampString(value, limit = 512) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function sanitizeTone(value) {
  return value === "success" || value === "error" ? value : "";
}

function sanitizeMessage(rawValue) {
  return {
    text: clampString(rawValue?.text, 1024),
    tone: sanitizeTone(rawValue?.tone)
  };
}

function sanitizeAddressInput(value) {
  return clampString(String(value ?? "").trim(), 128);
}

function sanitizeValidatorFields(rawValue) {
  const fields = createEmptyValidatorFields();
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};

  for (const fieldId of Object.keys(fields)) {
    fields[fieldId] = clampString(source[fieldId], 1024);
  }

  return fields;
}

function sanitizeStorageSnapshot(rawValue) {
  const source =
    rawValue?.validator && typeof rawValue.validator === "object" ? rawValue.validator : rawValue;

  return {
    v: 1,
    addressInput: sanitizeAddressInput(source?.addressInput)
  };
}

function buildStorageSnapshot(currentState) {
  return sanitizeStorageSnapshot(currentState);
}

function sanitizeSessionSnapshot(rawValue) {
  const source =
    rawValue?.validator && typeof rawValue.validator === "object" ? rawValue.validator : rawValue;

  return {
    addressInput: sanitizeAddressInput(source?.addressInput),
    fields: sanitizeValidatorFields(source?.fields),
    message: sanitizeMessage(source?.message)
  };
}

function buildSessionSnapshot(currentState) {
  return {
    v: SESSION_SNAPSHOT_VERSION,
    ...sanitizeSessionSnapshot(currentState)
  };
}

function t(key, values, fallback) {
  const translated = ui?.t?.(key, values);
  return typeof translated === "string" ? translated : fallback ?? key;
}

function emptyValue() {
  return t("common.empty", undefined, "-");
}

function translateError(error) {
  if (isBitcoinError(error)) {
    return t(error.key, error.values, error.message);
  }
  return error?.message || t("errors.unknown", undefined, "Unexpected error.");
}

function translateToken(value) {
  if (!value || typeof value !== "object" || typeof value.key !== "string") {
    return "";
  }
  return t(value.key, value.values, value.key);
}

function translateValidationReport(report) {
  return {
    status: translateToken(report.status),
    encoding: translateToken(report.encoding),
    network: translateToken(report.network),
    type: translateToken(report.type),
    payload: typeof report.payload === "string" ? report.payload : "",
    checksum: translateToken(report.checksum),
    details: translateToken(report.details),
    scriptPubKey: typeof report.scriptPubKey === "string" ? report.scriptPubKey : ""
  };
}

function setMessage(node, message) {
  node.textContent = message.text;
  if (message.tone) {
    node.dataset.tone = message.tone;
    return;
  }
  delete node.dataset.tone;
}

function clearValidatorDisplay() {
  state.fields = createEmptyValidatorFields();
}

function queuePersist() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    void writePersistedState(storageAdapter, STORAGE_KEY, buildStorageSnapshot(state)).catch(() => {});
  }, 120);
  session?.schedulePersist();
}

function persistNow() {
  clearTimeout(persistTimer);
  void writePersistedState(storageAdapter, STORAGE_KEY, buildStorageSnapshot(state)).catch(() => {});
  session?.persistNow();
}

function applySessionSnapshot(snapshot) {
  state = sanitizeSessionSnapshot(snapshot);
  render();
}

function getSessionSnapshot() {
  return buildSessionSnapshot(state);
}

function setValidatorBusy(isBusy) {
  dom.validateAddress.disabled = isBusy;
  dom.clearValidator.disabled = isBusy;
}

function cacheDom() {
  dom.addressInput = document.getElementById("addressInput");
  dom.validateAddress = document.getElementById("validateAddress");
  dom.clearValidator = document.getElementById("clearValidator");
  dom.validatorMessage = document.getElementById("validatorMessage");

  dom.valFields.status = document.getElementById("valStatus");
  dom.valFields.encoding = document.getElementById("valEncoding");
  dom.valFields.network = document.getElementById("valNetwork");
  dom.valFields.type = document.getElementById("valType");
  dom.valFields.payload = document.getElementById("valPayload");
  dom.valFields.checksum = document.getElementById("valChecksum");
  dom.valFields.details = document.getElementById("valDetails");
  dom.valFields.scriptPubKey = document.getElementById("valScript");
}

function syncDomFromState() {
  dom.addressInput.value = state.addressInput;
}

function renderValidator() {
  for (const [fieldId, node] of Object.entries(dom.valFields)) {
    const value = state.fields[fieldId];
    node.textContent = value || emptyValue();
  }

  setMessage(dom.validatorMessage, state.message);
}

function render() {
  syncDomFromState();
  renderValidator();
}

async function restoreState() {
  const restored = await readPersistedState(storageAdapter, STORAGE_KEY, sanitizeStorageSnapshot);
  if (!restored) {
    return;
  }

  state.addressInput = restored.addressInput;
}

async function runValidator() {
  const rawValue = sanitizeAddressInput(state.addressInput);
  if (!rawValue) {
    clearValidatorDisplay();
    state.message = {
      text: t("validator.messages.empty"),
      tone: "error"
    };
    renderValidator();
    queuePersist();
    return;
  }

  setValidatorBusy(true);
  state.message = {
    text: t("validator.messages.validating"),
    tone: ""
  };
  renderValidator();

  try {
    const report = await validateBitcoinInput(rawValue, window);
    state.addressInput = rawValue;
    state.fields = translateValidationReport(report);
    state.message = {
      text: t("validator.messages.success"),
      tone: "success"
    };
    render();
    queuePersist();
  } catch (error) {
    const message = translateError(error);
    clearValidatorDisplay();
    state.addressInput = rawValue;
    state.fields.status = t("validator.report.status.invalid");
    state.fields.details = message;
    state.message = {
      text: message,
      tone: "error"
    };
    render();
    queuePersist();
  } finally {
    setValidatorBusy(false);
  }
}

function bindEvents() {
  dom.validateAddress.addEventListener("click", () => {
    void runValidator();
  });

  dom.clearValidator.addEventListener("click", () => {
    state.addressInput = "";
    clearValidatorDisplay();
    state.message = { text: "", tone: "" };
    render();
    queuePersist();
  });

  dom.addressInput.addEventListener("input", (event) => {
    state.addressInput = event.target.value;
    clearValidatorDisplay();
    state.message = { text: "", tone: "" };
    renderValidator();
    queuePersist();
  });

  dom.addressInput.addEventListener("blur", persistNow);
  dom.addressInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runValidator();
    }
  });
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

  render();
  persistNow();
}

bootstrap().catch((error) => {
  console.error(error);

  if (ui?.mountToolPage && ui?.createErrorState) {
    ui.mountToolPage(
      ui.createErrorState({
        title: "Unable to load BTC Address Validator",
        message: error?.message || "Check the console for details."
      })
    );
  }
});
