import {
  computeEstimatesKg,
  createEmptyFormState,
  formatMass,
  fromKg,
  sanitizePersistedState,
  validateFormState,
} from "./lib/one-rep-math.js";

const SESSION_SNAPSHOT_VERSION = 1;

const ui = window.UtilivoUI;

let formStateFull = createEmptyFormState();

/** @type {Record<string, boolean>} */
let touched = { weight: false, reps: false };

/** @type {ReturnType<NonNullable<typeof window.UtilivoRuntime>["syncState"]> | null} */
let session = null;

let persistTimer = 0;

let validation = validateFormState(createEmptyFormState());

const dom = {
  /** @type {HTMLInputElement | null} */
  weight: null,
  /** @type {HTMLInputElement | null} */
  reps: null,
  /** @type {HTMLButtonElement | null} */
  unitKg: null,
  /** @type {HTMLButtonElement | null} */
  unitLb: null,
  /** @type {HTMLElement | null} */
  weightUnitSuffix: null,
  /** @type {HTMLElement | null} */
  weightError: null,
  /** @type {HTMLElement | null} */
  repsError: null,
  /** @type {HTMLElement | null} */
  formStatus: null,
  /** @type {HTMLElement | null} */
  resultCard: null,
  /** @type {HTMLElement | null} */
  formulaList: null,
  /** @type {HTMLElement | null} */
  resultEmpty: null,
  /** @type {HTMLElement | null} */
  resultSummary: null,
  /** @type {HTMLElement | null} */
  resultLiveBadge: null,
  /** @type {HTMLButtonElement | null} */
  resetButton: null,
};

function t(key, values) {
  return ui.t(key, values);
}

function normalizePositiveDecimalString(s) {
  let decimalSeen = false;
  let out = "";
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if (!decimalSeen && (ch === "." || ch === ",")) {
      out += ".";
      decimalSeen = true;
    }
  }
  return out;
}

/**
 * @param {HTMLInputElement} el
 */
function stripNonDigitsPreserveCursor(el) {
  const raw = el.value;
  const clean = raw.replace(/\D/g, "").slice(0, 2);
  if (raw === clean) return;
  const selStart = typeof el.selectionStart === "number" ? el.selectionStart : clean.length;
  const before = raw.slice(0, selStart);
  const pos = Math.min(before.replace(/\D/g, "").length, clean.length);
  el.value = clean;
  try {
    el.setSelectionRange(pos, pos);
  } catch (_) {}
}

/**
 * @param {HTMLInputElement} el
 */
function sanitizeWeightDecimalPreserveCursor(el) {
  const raw = el.value;
  const clean = normalizePositiveDecimalString(raw);
  if (raw === clean) return;
  el.value = clean;
}

function readFormStateFromDom() {
  return {
    weight: dom.weight?.value ?? "",
    reps: dom.reps?.value ?? "",
    unit: formStateFull.unit,
  };
}

function syncDomFromState() {
  if (dom.weight) dom.weight.value = formStateFull.weight;
  if (dom.reps) dom.reps.value = formStateFull.reps;
  updateUnitTabs();
  updateWeightSuffix();
}

function updateUnitTabs() {
  const isKg = formStateFull.unit === "kg";
  if (dom.unitKg) {
    dom.unitKg.setAttribute("aria-selected", String(isKg));
    dom.unitKg.tabIndex = isKg ? 0 : -1;
  }
  if (dom.unitLb) {
    dom.unitLb.setAttribute("aria-selected", String(!isKg));
    dom.unitLb.tabIndex = isKg ? -1 : 0;
  }
}

function updateWeightSuffix() {
  if (!dom.weightUnitSuffix) return;
  dom.weightUnitSuffix.textContent = t(
    formStateFull.unit === "lb" ? "form.units.lb_abbr" : "form.units.kg_abbr",
  );
}

/**
 * @param {import("./lib/one-rep-math.js").MassUnit} newUnit
 */
function applyUnitChange(newUnit) {
  if (formStateFull.unit === newUnit) return;

  const prev = { ...formStateFull };
  const interim = validateFormState(prev);
  if (interim.isValid && interim.values) {
    const display = fromKg(interim.values.weightKg, newUnit);
    formStateFull = {
      unit: newUnit,
      weight: formatMass(display, 1),
      reps: prev.reps,
    };
  } else {
    formStateFull = { ...prev, unit: newUnit };
  }

  syncDomFromState();
  recompute();
  render();
  queuePersist();
}

function recompute() {
  formStateFull = readFormStateFromDom();
  validation = validateFormState(formStateFull);
}

function queuePersist() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    session?.schedulePersist?.();
  }, 120);
}

function getSessionSnapshot() {
  const s = sanitizePersistedState(readFormStateFromDom());
  return { v: SESSION_SNAPSHOT_VERSION, ...s };
}

/**
 * @param {unknown} data
 */
function applySessionSnapshot(data) {
  if (!data || typeof data !== "object") {
    return;
  }
  const o = /** @type {Record<string, unknown>} */ (data);
  const payload =
    o.v === SESSION_SNAPSHOT_VERSION
      ? o
      : o.payload && typeof o.payload === "object" && /** @type {Record<string, unknown>} */ (o.payload).v === SESSION_SNAPSHOT_VERSION
        ? /** @type {Record<string, unknown>} */ (o.payload)
        : null;
  if (!payload) {
    return;
  }
  formStateFull = sanitizePersistedState(payload);
  touched = { weight: true, reps: true };
  syncDomFromState();
  recompute();
  render();
}

function renderFieldErrors() {
  if (dom.weightError) {
    const show = touched.weight && validation.errors.weight;
    dom.weightError.textContent = show ? t(validation.errors.weight) : "";
  }
  if (dom.repsError) {
    const show = touched.reps && validation.errors.reps;
    dom.repsError.textContent = show ? t(validation.errors.reps) : "";
  }
}

function renderStatus() {
  if (!dom.formStatus) return;
  if (!validation.isValid) {
    const hasInput =
      String(formStateFull.weight ?? "").trim() || String(formStateFull.reps ?? "").trim();
    dom.formStatus.textContent = hasInput ? t("form.status.invalid") : "";
    return;
  }
  dom.formStatus.textContent = t("form.status.valid");
}

function renderResults() {
  if (!dom.resultCard || !dom.formulaList || !dom.resultEmpty) return;

  if (!validation.isValid || !validation.values) {
    dom.resultCard.classList.add("rm-result--empty");
    dom.formulaList.innerHTML = "";
    dom.formulaList.hidden = true;
    dom.resultEmpty.hidden = false;
    if (dom.resultSummary) {
      dom.resultSummary.textContent = "";
      dom.resultSummary.hidden = true;
    }
    if (dom.resultLiveBadge) {
      dom.resultLiveBadge.hidden = true;
    }
    return;
  }

  const { weightKg, reps } = validation.values;
  const est = computeEstimatesKg(weightKg, reps);
  const u = formStateFull.unit;
  const unitLabel = t(u === "lb" ? "form.units.lb_abbr" : "form.units.kg_abbr");

  if (dom.resultSummary) {
    dom.resultSummary.textContent = t("result.summary", {
      weight: String(formStateFull.weight ?? "").trim(),
      unit: unitLabel,
      reps: String(reps),
    });
    dom.resultSummary.hidden = false;
  }
  if (dom.resultLiveBadge) {
    dom.resultLiveBadge.hidden = false;
  }

  const rows = [
    { key: "brzycki", kg: est.brzyckiKg },
    { key: "epley", kg: est.epleyKg },
    { key: "lombardi", kg: est.lombardiKg },
  ];

  const badgeVariants = /** @type {const} */ (["info", "success", "warning"]);

  dom.formulaList.innerHTML = "";
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const display = fromKg(row.kg, u);
    const val = formatMass(display, 1);

    const article = document.createElement("article");
    article.className = "uv-pattern-dashboard__stat rm-stat";

    let badge =
      typeof ui.createBadge === "function"
        ? ui.createBadge({
            variant: badgeVariants[i % badgeVariants.length],
            label: t(`result.formulas.${row.key}.name`),
          })
        : null;
    if (!badge) {
      badge = document.createElement("span");
      badge.className = `uv-badge uv-badge--${badgeVariants[i % badgeVariants.length]}`;
      badge.textContent = t(`result.formulas.${row.key}.name`);
    }
    article.appendChild(badge);

    const measure = document.createElement("div");
    measure.className = "rm-stat__measure";
    const num = document.createElement("span");
    num.className = "rm-stat__number uv-text-headline-md";
    num.textContent = val;
    const unitEl = document.createElement("span");
    unitEl.className = "rm-stat__unit uv-text-body-lg uv-text-muted";
    unitEl.textContent = t("result.formulas.unit_lead", { unit: unitLabel });
    measure.appendChild(num);
    measure.appendChild(unitEl);

    const note = document.createElement("p");
    note.className = "rm-stat__note uv-text-body-sm uv-text-muted";
    note.textContent = t(`result.formulas.${row.key}.note`);

    article.appendChild(measure);
    article.appendChild(note);
    dom.formulaList.appendChild(article);
  }

  dom.resultCard.classList.remove("rm-result--empty");
  dom.formulaList.hidden = false;
  dom.resultEmpty.hidden = true;
}

function render() {
  renderFieldErrors();
  renderStatus();
  renderResults();
}

function cacheDom() {
  dom.weight = document.getElementById("weight");
  dom.reps = document.getElementById("reps");
  dom.unitKg = document.getElementById("unitKg");
  dom.unitLb = document.getElementById("unitLb");
  dom.weightUnitSuffix = document.getElementById("weightUnitSuffix");
  dom.weightError = document.getElementById("weightError");
  dom.repsError = document.getElementById("repsError");
  dom.formStatus = document.getElementById("formStatus");
  dom.resultCard = document.getElementById("resultCard");
  dom.formulaList = document.getElementById("formulaList");
  dom.resultEmpty = document.getElementById("resultEmpty");
  dom.resultSummary = document.getElementById("resultSummary");
  dom.resultLiveBadge = document.getElementById("resultLiveBadge");
  dom.resetButton = document.getElementById("resetButton");
}

function bindEvents() {
  dom.weight?.addEventListener("beforeinput", (e) => {
    const tEl = e.target;
    if (!(tEl instanceof HTMLInputElement)) return;
    if (e.inputType === "insertText" && e.data != null && /[^\d.,]/.test(e.data)) {
      e.preventDefault();
    }
  });

  dom.weight?.addEventListener("paste", (e) => {
    const tEl = e.target;
    if (!(tEl instanceof HTMLInputElement)) return;
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    const ins = normalizePositiveDecimalString(text);
    const start = tEl.selectionStart ?? 0;
    const end = tEl.selectionEnd ?? 0;
    const merged = normalizePositiveDecimalString(`${tEl.value.slice(0, start)}${ins}${tEl.value.slice(end)}`);
    tEl.value = merged;
    try {
      const pos = Math.min(start + ins.length, merged.length);
      tEl.setSelectionRange(pos, pos);
    } catch (_) {}
    formStateFull.weight = merged;
    recompute();
    render();
    queuePersist();
  });

  dom.weight?.addEventListener("input", () => {
    if (dom.weight) sanitizeWeightDecimalPreserveCursor(dom.weight);
    formStateFull.weight = dom.weight?.value ?? "";
    recompute();
    render();
    queuePersist();
  });

  dom.weight?.addEventListener("blur", () => {
    touched.weight = true;
    recompute();
    render();
    session?.persistNow();
  });

  dom.reps?.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertText" && e.data != null && /\D/.test(e.data)) {
      e.preventDefault();
    }
  });

  dom.reps?.addEventListener("paste", (e) => {
    const tEl = e.target;
    if (!(tEl instanceof HTMLInputElement)) return;
    e.preventDefault();
    const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/\D/g, "").slice(0, 2);
    const start = tEl.selectionStart ?? 0;
    const end = tEl.selectionEnd ?? 0;
    tEl.value = `${tEl.value.slice(0, start)}${text}${tEl.value.slice(end)}`.replace(/\D/g, "").slice(0, 2);
    try {
      tEl.setSelectionRange(tEl.value.length, tEl.value.length);
    } catch (_) {}
    formStateFull.reps = tEl.value;
    recompute();
    render();
    queuePersist();
  });

  dom.reps?.addEventListener("input", () => {
    if (dom.reps) stripNonDigitsPreserveCursor(dom.reps);
    formStateFull.reps = dom.reps?.value ?? "";
    recompute();
    render();
    queuePersist();
  });

  dom.reps?.addEventListener("blur", () => {
    touched.reps = true;
    recompute();
    render();
    session?.persistNow();
  });

  dom.unitKg?.addEventListener("click", () => applyUnitChange("kg"));
  dom.unitLb?.addEventListener("click", () => applyUnitChange("lb"));

  dom.resetButton?.addEventListener("click", () => {
    formStateFull = createEmptyFormState();
    touched = { weight: false, reps: false };
    syncDomFromState();
    recompute();
    render();
    clearTimeout(persistTimer);
    session?.persistNow();
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
    basePath: "./locales",
  });

  cacheDom();
  if (!dom.weight || !dom.reps) {
    return;
  }

  formStateFull = createEmptyFormState();
  touched = { weight: false, reps: false };
  syncDomFromState();

  if (window.UtilivoRuntime && typeof window.UtilivoRuntime.syncState === "function") {
    session = window.UtilivoRuntime.syncState({
      read: getSessionSnapshot,
      write: applySessionSnapshot,
      debounceMs: 400,
    });
    if (typeof window.UtilivoRuntime.registerSessionRestore === "function") {
      window.UtilivoRuntime.registerSessionRestore((snapshot) => {
        applySessionSnapshot(snapshot);
        session?.persistNow();
      });
    }
  }

  bindEvents();

  if (session && window.UtilivoRuntime?.shouldHydrateFromHost?.()) {
    await session.hydrateFromHost();
  }

  recompute();
  render();
  session?.persistNow();
}

bootstrap().catch((error) => {
  console.error(error);
});
