import {
  STEP_IDS,
  STORAGE_KEY,
  buildAddressBundle,
  createEmptyBuilderOutputs,
  createEmptyBuilderSteps,
  generateRandomPrivateKeyHex,
  isBitcoinError,
  sanitizeHex
} from "./lib/bitcoin.js";
import {
  createStorageAdapter,
  readPersistedState,
  writePersistedState
} from "./lib/storage.js";

const SESSION_SNAPSHOT_VERSION = 1;

const ui = window.UtilivosUI;
const dom = {
  steps: {}
};

let storageAdapter = null;
let session = null;
let persistTimer = 0;
let state = createEmptyState();

function createEmptyState() {
  return {
    privateKey: "",
    network: "mainnet",
    compressed: true,
    steps: createEmptyBuilderSteps(),
    outputs: createEmptyBuilderOutputs(),
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

function sanitizeSteps(rawValue) {
  const steps = createEmptyBuilderSteps();
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};

  for (const stepId of STEP_IDS) {
    steps[stepId] = clampString(source[stepId], 256);
  }

  return steps;
}

function sanitizeOutputs(rawValue) {
  const outputs = createEmptyBuilderOutputs();
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};

  for (const outputId of Object.keys(outputs)) {
    outputs[outputId] = clampString(source[outputId], 256);
  }

  return outputs;
}

function sanitizeStorageSnapshot(rawValue) {
  const source =
    rawValue?.builder && typeof rawValue.builder === "object" ? rawValue.builder : rawValue;

  return {
    v: 1,
    network: source?.network === "testnet" ? "testnet" : "mainnet",
    compressed: source?.compressed !== false
  };
}

function buildStorageSnapshot(currentState) {
  return sanitizeStorageSnapshot(currentState);
}

function sanitizeSessionSnapshot(rawValue) {
  const source =
    rawValue?.builder && typeof rawValue.builder === "object" ? rawValue.builder : rawValue;

  return {
    privateKey: sanitizeHex(source?.privateKey),
    network: source?.network === "testnet" ? "testnet" : "mainnet",
    compressed: source?.compressed !== false,
    steps: sanitizeSteps(source?.steps),
    outputs: sanitizeOutputs(source?.outputs),
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

function translateError(error) {
  if (isBitcoinError(error)) {
    return t(error.key, error.values, error.message);
  }
  return error?.message || t("errors.unknown", undefined, "Unexpected error.");
}

function setMessage(node, message) {
  node.textContent = message.text;
  if (message.tone) {
    node.dataset.tone = message.tone;
    return;
  }
  delete node.dataset.tone;
}

function clearBuilderDisplay() {
  state.steps = createEmptyBuilderSteps();
  state.outputs = createEmptyBuilderOutputs();
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

function setBuilderBusy(isBusy) {
  dom.randomKey.disabled = isBusy;
  dom.runBuilder.disabled = isBusy;
  dom.clearBuilder.disabled = isBusy;
}

function cacheDom() {
  dom.privateKey = document.getElementById("privateKey");
  dom.network = document.getElementById("network");
  dom.compressed = document.getElementById("compressed");
  dom.uncompressed = document.getElementById("uncompressed");

  dom.randomKey = document.getElementById("randomKey");
  dom.runBuilder = document.getElementById("runBuilder");
  dom.clearBuilder = document.getElementById("clearBuilder");
  dom.builderMessage = document.getElementById("builderMessage");

  dom.wifOutput = document.getElementById("wifOutput");
  dom.nestedOutput = document.getElementById("nestedOutput");
  dom.segwitOutput = document.getElementById("segwitOutput");
  dom.legacyScriptOutput = document.getElementById("legacyScriptOutput");
  dom.segwitScriptOutput = document.getElementById("segwitScriptOutput");

  for (const stepId of STEP_IDS) {
    dom.steps[stepId] = document.getElementById(stepId);
  }
}

function syncDomFromState() {
  dom.privateKey.value = state.privateKey;
  dom.network.value = state.network;
  dom.compressed.checked = state.compressed;
  dom.uncompressed.checked = !state.compressed;
}

function renderBuilder() {
  for (const stepId of STEP_IDS) {
    dom.steps[stepId].value = state.steps[stepId];
  }

  dom.wifOutput.value = state.outputs.wif;
  dom.nestedOutput.value = state.outputs.nested;
  dom.segwitOutput.value = state.outputs.segwit;
  dom.legacyScriptOutput.value = state.outputs.legacyScript;
  dom.segwitScriptOutput.value = state.outputs.segwitScript;
  setMessage(dom.builderMessage, state.message);
}

function render() {
  syncDomFromState();
  renderBuilder();
}

async function restoreState() {
  const restored = await readPersistedState(storageAdapter, STORAGE_KEY, sanitizeStorageSnapshot);
  if (!restored) {
    return;
  }

  state.network = restored.network;
  state.compressed = restored.compressed;
}

async function handleRandomKey() {
  try {
    state.privateKey = generateRandomPrivateKeyHex(window);
    clearBuilderDisplay();
    state.message = { text: "", tone: "" };
    render();
    queuePersist();
    await runBuilder();
  } catch (error) {
    clearBuilderDisplay();
    state.message = {
      text: translateError(error),
      tone: "error"
    };
    renderBuilder();
    session?.schedulePersist();
  }
}

async function runBuilder() {
  setBuilderBusy(true);
  state.message = {
    text: t("builder.messages.computing"),
    tone: ""
  };
  renderBuilder();

  try {
    const result = await buildAddressBundle(
      state.privateKey,
      { network: state.network, compressed: state.compressed },
      window
    );

    state.privateKey = result.steps.step0;
    state.steps = result.steps;
    state.outputs = result.outputs;
    state.message = {
      text: t("builder.messages.success"),
      tone: "success"
    };
    render();
    queuePersist();
  } catch (error) {
    clearBuilderDisplay();
    state.message = {
      text: translateError(error),
      tone: "error"
    };
    renderBuilder();
    session?.schedulePersist();
  } finally {
    setBuilderBusy(false);
  }
}

function bindEvents() {
  dom.randomKey.addEventListener("click", () => {
    void handleRandomKey();
  });

  dom.runBuilder.addEventListener("click", () => {
    void runBuilder();
  });

  dom.clearBuilder.addEventListener("click", () => {
    state.privateKey = "";
    clearBuilderDisplay();
    state.message = { text: "", tone: "" };
    render();
    queuePersist();
  });

  dom.privateKey.addEventListener("input", (event) => {
    state.privateKey = event.target.value;
    clearBuilderDisplay();
    state.message = { text: "", tone: "" };
    renderBuilder();
    queuePersist();
  });

  dom.network.addEventListener("change", (event) => {
    state.network = event.target.value === "testnet" ? "testnet" : "mainnet";
    clearBuilderDisplay();
    state.message = { text: "", tone: "" };
    renderBuilder();
    queuePersist();
  });

  dom.compressed.addEventListener("change", () => {
    state.compressed = true;
    clearBuilderDisplay();
    state.message = { text: "", tone: "" };
    renderBuilder();
    queuePersist();
  });

  dom.uncompressed.addEventListener("change", () => {
    state.compressed = false;
    clearBuilderDisplay();
    state.message = { text: "", tone: "" };
    renderBuilder();
    queuePersist();
  });

  dom.privateKey.addEventListener("blur", persistNow);
  dom.privateKey.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void runBuilder();
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
        title: "Unable to load BTC Generator",
        message: error?.message || "Check the console for details."
      })
    );
  }
});
