import {
  STORAGE_KEY,
  buildGrowthChartRows,
  cmToFtIn,
  computeGrowth,
  createEmptyFormState,
  formatPercentileDisplay,
  getTodayLocalYmd,
  metricToImperialWeight,
  parseLocalYmd,
  sanitizePersistedState,
  validateFormState,
  weightToKg,
  lengthToCm
} from "./lib/growth-calculator.js";
import {
  clearPersistedState,
  createStorageAdapter,
  readPersistedState,
  writePersistedState
} from "./lib/storage.js";

const SESSION_SNAPSHOT_VERSION = 3;

const ui = window.UtilivosUI;

const INPUT_IDS = [
  "birthDate",
  "weightKg",
  "weightLb",
  "weightOz",
  "lengthCm",
  "lengthFt",
  "lengthIn",
  "headCm"
];

const dom = {
  inputs: {},
  shells: {},
  errors: {}
};

let storageAdapter = null;
let session = null;
let formState = createEmptyFormState();
let touched = createTouchedState();
let validation = validateFormState(formState, () => "");
let growthOutcome = null;
let persistTimer = 0;

function t(key, values) {
  return ui.t(key, values);
}

function createTouchedState(markFilled = false) {
  const next = { sex: markFilled };
  for (const fieldId of INPUT_IDS) {
    const currentValue = String(formState[fieldId] ?? "").trim();
    next[fieldId] = markFilled ? currentValue.length > 0 : false;
  }
  return next;
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

function formatLocaleMediumYmd(ymd) {
  const d = parseLocalYmd(ymd);
  if (!d) {
    return ymd;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium"
    }).format(d);
  } catch (_) {
    return ymd;
  }
}

function formatLocaleNumber(n, maxFractionDigits = 2) {
  if (!Number.isFinite(n)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: maxFractionDigits
    }).format(n);
  } catch (_) {
    return String(Math.round(n * 100) / 100);
  }
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

  dom.sexGirl = document.getElementById("sexGirl");
  dom.sexBoy = document.getElementById("sexBoy");
  dom.sexPick = document.getElementById("sexPick");

  dom.resultCard = document.getElementById("resultCard");
  dom.resultBadge = document.getElementById("resultBadge");
  dom.resultAge = document.getElementById("resultAge");
  dom.resultEmpty = document.getElementById("resultEmpty");
  dom.resultRows = document.getElementById("resultRows");
  dom.rowHead = document.getElementById("rowHead");

  dom.pctWeight = document.getElementById("pctWeight");
  dom.pctLength = document.getElementById("pctLength");
  dom.pctHead = document.getElementById("pctHead");
  dom.barWeight = document.getElementById("barWeight");
  dom.barLength = document.getElementById("barLength");
  dom.barHead = document.getElementById("barHead");
  dom.capWeight = document.getElementById("capWeight");
  dom.capLength = document.getElementById("capLength");
  dom.capHead = document.getElementById("capHead");
  dom.zWeight = document.getElementById("zWeight");
  dom.zLength = document.getElementById("zLength");
  dom.zHead = document.getElementById("zHead");

  dom.chartCard = document.getElementById("chartCard");
  dom.chartBody = document.getElementById("chartBody");

  for (const fieldId of INPUT_IDS) {
    dom.inputs[fieldId] = document.getElementById(fieldId);
    dom.shells[fieldId] = document.getElementById(`${fieldId}Shell`);
    dom.errors[fieldId] = document.getElementById(`${fieldId}Error`);
  }
}

function syncSexButtons() {
  const girl = formState.sex === "girl";
  if (dom.sexGirl) {
    dom.sexGirl.setAttribute("aria-checked", String(girl));
    dom.sexGirl.classList.toggle("bg-sex-btn--selected", girl);
  }
  if (dom.sexBoy) {
    dom.sexBoy.setAttribute("aria-checked", String(!girl));
    dom.sexBoy.classList.toggle("bg-sex-btn--selected", !girl);
  }
}

function syncDomFromState() {
  for (const fieldId of INPUT_IDS) {
    const el = dom.inputs[fieldId];
    if (el) {
      el.value = formState[fieldId];
    }
  }

  const isMetric = formState.unitSystem === "metric";
  dom.unitMetric.setAttribute("aria-selected", String(isMetric));
  dom.unitImperial.setAttribute("aria-selected", String(!isMetric));
  dom.metricFields.hidden = !isMetric;
  dom.imperialFields.hidden = isMetric;

  syncSexButtons();
}

function readFormFromDom() {
  const next = { ...formState };
  for (const fieldId of INPUT_IDS) {
    const el = dom.inputs[fieldId];
    if (el) {
      next[fieldId] = el.value;
    }
  }
  formState = next;
}

function recompute() {
  validation = validateFormState(formState, t);
  growthOutcome = validation.isValid ? computeGrowth(formState, t) : null;
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

function errorTextForField(fieldId) {
  let key = validation.errors[fieldId];
  if (fieldId === "weightOz" && !key) {
    key = validation.errors.weightLb;
  }
  if (fieldId === "lengthIn" && !key) {
    key = validation.errors.lengthFt;
  }
  return key ? t(key) : "";
}

function renderFieldError(fieldId) {
  const input = dom.inputs[fieldId];
  const shell = dom.shells[fieldId];
  const errorNode = dom.errors[fieldId];
  if (!input || !shell || !errorNode) {
    return;
  }

  const message = errorTextForField(fieldId);
  const shouldShowError = Boolean(message && touched[fieldId]);

  input.setAttribute("aria-invalid", shouldShowError ? "true" : "false");
  shell.dataset.invalid = shouldShowError ? "true" : "false";
  errorNode.textContent = shouldShowError ? message : "";
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

function formatPercentilePhrase(p) {
  if (!Number.isFinite(p)) {
    return t("common.emptyValue");
  }
  if (p < 0.5) {
    return t("result.percentile_value_low");
  }
  if (p > 99.5) {
    return t("result.percentile_value_high");
  }
  return t("result.percentile_value", { value: formatPercentileDisplay(p) });
}

function barWidthPercent(p) {
  if (!Number.isFinite(p)) {
    return 0;
  }
  return Math.min(100, Math.max(1, p));
}

function renderIndicatorRow(prefix, data) {
  const pctEl = dom[`pct${prefix}`];
  const barEl = dom[`bar${prefix}`];
  const capEl = dom[`cap${prefix}`];
  const zEl = dom[`z${prefix}`];
  if (!data || !pctEl || !barEl || !capEl || !zEl) {
    return;
  }
  pctEl.textContent = formatPercentilePhrase(data.p);
  barEl.style.width = `${barWidthPercent(data.p)}%`;
  capEl.textContent = t(data.labelKey);
  zEl.textContent = Number.isFinite(data.z)
    ? t("result.z_label", { z: data.z.toFixed(2) })
    : "";
}

function chartTitleKey(rowId) {
  if (rowId === "weight") {
    return "result.weight_label";
  }
  if (rowId === "length") {
    return "result.length_label";
  }
  return "result.head_label";
}

function chartSvgX(v, minV, maxV, pad, innerW) {
  const span = maxV - minV || 1;
  const u = (v - minV) / span;
  return pad + Math.max(0, Math.min(1, u)) * innerW;
}

function renderChart() {
  if (!dom.chartCard || !dom.chartBody) {
    return;
  }
  if (!growthOutcome?.ok || !growthOutcome.result) {
    dom.chartCard.hidden = true;
    dom.chartBody.innerHTML = "";
    return;
  }

  const r = growthOutcome.result;
  const rows = buildGrowthChartRows(formState.sex, r.ageMonths, {
    weightKg: r.weightKg,
    lengthCm: r.lengthCm,
    headCm: r.headCm
  });

  dom.chartBody.innerHTML = "";
  if (!rows.length) {
    dom.chartCard.hidden = true;
    return;
  }

  dom.chartCard.hidden = false;

  const vbW = 320;
  const vbH = 44;
  const pad = 20;
  const innerW = vbW - 2 * pad;

  for (const row of rows) {
    const plotMin = Math.min(row.low, row.value, row.mid);
    const plotMax = Math.max(row.high, row.value, row.mid);
    const xL = chartSvgX(row.low, plotMin, plotMax, pad, innerW);
    const xM = chartSvgX(row.mid, plotMin, plotMax, pad, innerW);
    const xH = chartSvgX(row.high, plotMin, plotMax, pad, innerW);
    const xV = chartSvgX(row.value, plotMin, plotMax, pad, innerW);

    const article = document.createElement("article");
    article.className = "bg-chart-row";

    const h3 = document.createElement("h3");
    h3.className = "bg-chart-row__title";
    h3.textContent = t(chartTitleKey(row.id));
    article.appendChild(h3);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "bg-chart-svg");
    svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", t("chart.svg_aria", { label: t(chartTitleKey(row.id)) }));

    const baseY = 22;
    const band = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    band.setAttribute("class", "bg-chart-band");
    band.setAttribute("x", String(Math.min(xL, xH)));
    band.setAttribute("y", String(baseY - 6));
    band.setAttribute("width", String(Math.abs(xH - xL)));
    band.setAttribute("height", "12");
    band.setAttribute("rx", "4");
    svg.appendChild(band);

    const med = document.createElementNS("http://www.w3.org/2000/svg", "line");
    med.setAttribute("class", "bg-chart-median");
    med.setAttribute("x1", String(xM));
    med.setAttribute("x2", String(xM));
    med.setAttribute("y1", String(baseY - 10));
    med.setAttribute("y2", String(baseY + 10));
    med.setAttribute("stroke-width", "2");
    svg.appendChild(med);

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", "bg-chart-you");
    dot.setAttribute("cx", String(xV));
    dot.setAttribute("cy", String(baseY));
    dot.setAttribute("r", "6");
    svg.appendChild(dot);

    article.appendChild(svg);

    const dl = document.createElement("dl");
    dl.className = "bg-chart-scale";

    const addItem = (termKey, val) => {
      const wrap = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = t(termKey);
      const dd = document.createElement("dd");
      dd.textContent = formatLocaleNumber(val) + " " + t(row.unitKey);
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      dl.appendChild(wrap);
    };

    addItem("chart.labels.p3", row.low);
    addItem("chart.labels.median", row.mid);
    addItem("chart.labels.you", row.value);
    addItem("chart.labels.p97", row.high);

    article.appendChild(dl);
    dom.chartBody.appendChild(article);
  }
}

function renderResult() {
  dom.resultCard.classList.remove("bg-result--empty", "bg-result--ready");
  dom.resultRows.hidden = true;
  dom.rowHead.hidden = true;

  if (!growthOutcome?.ok || !growthOutcome.result) {
    dom.resultCard.classList.add("bg-result--empty");
    setBadgeVariant(dom.resultBadge, "info");
    dom.resultBadge.textContent = t("result.badges.waiting");
    dom.resultAge.textContent = "";
    dom.resultRows.hidden = true;
    dom.resultEmpty.hidden = false;
    renderChart();
    return;
  }

  const { result } = growthOutcome;
  dom.resultCard.classList.add("bg-result--ready");
  setBadgeVariant(dom.resultBadge, "success");
  dom.resultBadge.textContent = t("status.ready");
  dom.resultRows.hidden = false;
  dom.resultEmpty.hidden = true;

  const monthsStr = result.ageMonths.toFixed(1);
  dom.resultAge.textContent = t("result.age", {
    days: String(result.ageDays),
    months: monthsStr,
    today: formatLocaleMediumYmd(result.asOfYmd || getTodayLocalYmd())
  });

  renderIndicatorRow("Weight", result.weight);
  renderIndicatorRow("Length", result.length);

  if (result.head) {
    dom.rowHead.hidden = false;
    renderIndicatorRow("Head", result.head);
  }

  dom.resultEmpty.hidden = true;
  renderChart();
}

function switchUnit(nextSystem) {
  if (nextSystem === formState.unitSystem) {
    return;
  }

  readFormFromDom();
  const prev = validateFormState(formState, t);
  let nextState = { ...formState, unitSystem: nextSystem };

  if (prev.isValid) {
    const kg = weightToKg(formState);
    const cm = lengthToCm(formState);
    if (kg != null && cm != null) {
      if (nextSystem === "imperial") {
        const w = metricToImperialWeight(kg);
        const hi = cmToFtIn(cm);
        nextState = {
          ...nextState,
          weightKg: "",
          lengthCm: "",
          weightLb: w.lb,
          weightOz: w.oz,
          lengthFt: hi.ft,
          lengthIn: hi.inch
        };
      } else {
        nextState = {
          ...nextState,
          weightLb: "",
          weightOz: "",
          lengthFt: "",
          lengthIn: "",
          weightKg: String(Math.round(kg * 1000) / 1000),
          lengthCm: String(Math.round(cm * 10) / 10)
        };
      }
    }
  }

  formState = sanitizePersistedState(nextState);
  touched = createTouchedState();
  syncDomFromState();
  recompute();
  render();
  queuePersist();
}

function markActiveFieldsTouched() {
  for (const fieldId of validation.activeFieldIds) {
    if (fieldId === "sex") {
      touched.sex = true;
    } else if (touched[fieldId] !== undefined) {
      touched[fieldId] = true;
    }
  }
}

function focusFirstInvalidField() {
  const order = [
    "birthDate",
    "weightKg",
    "weightLb",
    "weightOz",
    "lengthCm",
    "lengthFt",
    "lengthIn",
    "headCm"
  ];
  for (const fieldId of order) {
    if (validation.errors[fieldId]) {
      dom.inputs[fieldId]?.focus();
      return;
    }
  }
  if (validation.errors.birthDate) {
    dom.inputs.birthDate?.focus();
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function isSmallViewport() {
  return window.matchMedia?.("(max-width: 840px)")?.matches ?? false;
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

function bindEvents() {
  for (const fieldId of INPUT_IDS) {
    const input = dom.inputs[fieldId];
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

  dom.sexGirl?.addEventListener("click", () => {
    if (formState.sex === "girl") {
      return;
    }
    readFormFromDom();
    formState = { ...formState, sex: "girl" };
    touched.sex = true;
    syncSexButtons();
    recompute();
    render();
    queuePersist();
  });

  dom.sexBoy?.addEventListener("click", () => {
    if (formState.sex === "boy") {
      return;
    }
    readFormFromDom();
    formState = { ...formState, sex: "boy" };
    touched.sex = true;
    syncSexButtons();
    recompute();
    render();
    queuePersist();
  });

  dom.unitMetric.addEventListener("click", () => switchUnit("metric"));
  dom.unitImperial.addEventListener("click", () => switchUnit("imperial"));

  dom.form.addEventListener("submit", (event) => {
    event.preventDefault();
    readFormFromDom();
    markActiveFieldsTouched();
    recompute();
    render();

    if (!validation.isValid) {
      focusFirstInvalidField();
      return;
    }

    const outcome = computeGrowth(formState, t);
    growthOutcome = outcome;
    render();
    focusResultCard();
    queuePersist();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    readFormFromDom();
    recompute();
    render();
  });

  dom.resetButton.addEventListener("click", () => {
    formState = createEmptyFormState();
    touched = createTouchedState();
    growthOutcome = null;
    syncDomFromState();
    recompute();
    render();
    clearTimeout(persistTimer);
    void clearPersistedState(storageAdapter, STORAGE_KEY).catch(() => {});
    session?.persistNow();
  });
}

function render() {
  for (const fieldId of INPUT_IDS) {
    renderFieldError(fieldId);
  }
  renderStatus();
  renderResult();
}

async function restoreFormState() {
  const restored = await readPersistedState(storageAdapter, STORAGE_KEY, sanitizePersistedState);
  if (restored) {
    formState = sanitizePersistedState(restored);
  }
  touched = createTouchedState(true);
  syncDomFromState();
  recompute();
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

  if (typeof navigator !== "undefined" && navigator.language) {
    document.documentElement.lang = navigator.language;
  }

  cacheDom();
  storageAdapter = createStorageAdapter(window);

  const runtime = window.UtilivosRuntime;
  if (runtime && typeof window.UtilivosRuntime.syncState === "function") {
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

  if (session && runtime?.shouldHydrateFromHost?.()) {
    await session.hydrateFromHost();
  } else {
    await restoreFormState();
  }

  recompute();
  render();
  session?.persistNow();
}

bootstrap().catch((error) => {
  console.error(error);
});
