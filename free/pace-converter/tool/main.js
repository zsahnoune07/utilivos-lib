import {
  createEmptyFormState,
  formCompletelyEmpty,
  inferMpsFromForm,
  sanitizeFormState,
  stateFromMps,
} from "./lib/pace-math.js";

const SESSION_SNAPSHOT_VERSION = 2;

const ui = window.UtilivosUI;

let session = null;
let updating = false;

/** @type {HTMLInputElement | null} */
let mphEl = null;
/** @type {HTMLInputElement | null} */
let kphEl = null;
/** @type {HTMLInputElement | null} */
let mpsEl = null;
/** @type {HTMLInputElement | null} */
let paceMileMinEl = null;
/** @type {HTMLInputElement | null} */
let paceMileSecEl = null;
/** @type {HTMLInputElement | null} */
let paceKmMinEl = null;
/** @type {HTMLInputElement | null} */
let paceKmSecEl = null;

const raceEls = {
  km5: { h: null, m: null, s: null },
  km10: { h: null, m: null, s: null },
  half: { h: null, m: null, s: null },
  marathon: { h: null, m: null, s: null },
};

function cacheDom() {
  mphEl = document.getElementById("mph");
  kphEl = document.getElementById("kph");
  mpsEl = document.getElementById("mps");
  paceMileMinEl = document.getElementById("paceMileMin");
  paceMileSecEl = document.getElementById("paceMileSec");
  paceKmMinEl = document.getElementById("paceKmMin");
  paceKmSecEl = document.getElementById("paceKmSec");

  raceEls.km5.h = document.getElementById("raceKm5H");
  raceEls.km5.m = document.getElementById("raceKm5M");
  raceEls.km5.s = document.getElementById("raceKm5S");
  raceEls.km10.h = document.getElementById("raceKm10H");
  raceEls.km10.m = document.getElementById("raceKm10M");
  raceEls.km10.s = document.getElementById("raceKm10S");
  raceEls.half.h = document.getElementById("raceHalfH");
  raceEls.half.m = document.getElementById("raceHalfM");
  raceEls.half.s = document.getElementById("raceHalfS");
  raceEls.marathon.h = document.getElementById("raceMarathonH");
  raceEls.marathon.m = document.getElementById("raceMarathonM");
  raceEls.marathon.s = document.getElementById("raceMarathonS");
}

/** @param {EventTarget | null} el */
function inferOriginFromTarget(el) {
  if (!el || !(el instanceof HTMLInputElement)) {
    return null;
  }
  const id = el.id;
  if (id === "mph") return { type: "speed", field: "mph" };
  if (id === "kph") return { type: "speed", field: "kph" };
  if (id === "mps") return { type: "speed", field: "mps" };
  if (id === "paceMileMin" || id === "paceMileSec") return { type: "paceMile" };
  if (id === "paceKmMin" || id === "paceKmSec") return { type: "paceKm" };
  if (id === "raceKm5H" || id === "raceKm5M" || id === "raceKm5S") {
    return { type: "race", raceKey: "km5" };
  }
  if (id === "raceKm10H" || id === "raceKm10M" || id === "raceKm10S") {
    return { type: "race", raceKey: "km10" };
  }
  if (id === "raceHalfH" || id === "raceHalfM" || id === "raceHalfS") {
    return { type: "race", raceKey: "half" };
  }
  if (id === "raceMarathonH" || id === "raceMarathonM" || id === "raceMarathonS") {
    return { type: "race", raceKey: "marathon" };
  }
  return null;
}

function readDomState() {
  const s = createEmptyFormState();
  s.mph = mphEl?.value ?? "";
  s.kph = kphEl?.value ?? "";
  s.mps = mpsEl?.value ?? "";
  s.paceMileMin = paceMileMinEl?.value ?? "";
  s.paceMileSec = paceMileSecEl?.value ?? "";
  s.paceKmMin = paceKmMinEl?.value ?? "";
  s.paceKmSec = paceKmSecEl?.value ?? "";

  for (const key of Object.keys(raceEls)) {
    const els = raceEls[key];
    s[`race_${key}`] = {
      h: els.h?.value ?? "",
      m: els.m?.value ?? "",
      s: els.s?.value ?? "",
    };
  }
  return s;
}

/** @param {string | null} [preserveSpeedInputId] do not overwrite this speed field (so decimals like "10." stay while typing) */
function applyDomState(next, preserveSpeedInputId) {
  if (!mphEl) return;
  updating = true;
  try {
    if (preserveSpeedInputId !== "mph") mphEl.value = next.mph;
    if (preserveSpeedInputId !== "kph") kphEl.value = next.kph;
    if (preserveSpeedInputId !== "mps") mpsEl.value = next.mps;
    paceMileMinEl.value = next.paceMileMin;
    paceMileSecEl.value = next.paceMileSec;
    paceKmMinEl.value = next.paceKmMin;
    paceKmSecEl.value = next.paceKmSec;

    for (const key of Object.keys(raceEls)) {
      const els = raceEls[key];
      const r = next[`race_${key}`];
      if (els.h) els.h.value = r.h;
      if (els.m) els.m.value = r.m;
      if (els.s) els.s.value = r.s;
    }
  } finally {
    updating = false;
  }
}

/** @param {EventTarget | null} [inputTarget] input that fired the event (preferred over activeElement) */
function recompute(inputTarget) {
  if (updating) return;

  const raw = readDomState();

  if (formCompletelyEmpty(raw)) {
    applyDomState(createEmptyFormState());
    session?.schedulePersist();
    return;
  }

  const activeEl =
    inputTarget instanceof HTMLInputElement
      ? inputTarget
      : document.activeElement instanceof HTMLInputElement
        ? document.activeElement
        : null;
  const origin = inferOriginFromTarget(activeEl);

  const mps = inferMpsFromForm(raw, origin);
  if (mps != null) {
    const preserveSpeedId =
      origin?.type === "speed" && activeEl && ["mph", "kph", "mps"].includes(activeEl.id)
        ? activeEl.id
        : null;
    applyDomState(stateFromMps(mps), preserveSpeedId);
  }
  session?.schedulePersist();
}

function getSessionSnapshot() {
  return { v: SESSION_SNAPSHOT_VERSION, ...readDomState() };
}

const DIGITS_ONLY_CLASS = "pace-input--digits-only";
const SPEED_DECIMAL_CLASS = "pace-input--speed-decimal";

/**
 * Digits and at most one decimal point (. or , → .). Strips signs, letters, and extra separators.
 * @param {string} s
 */
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
 * @param {string} raw
 * @param {number} cutIndex exclusive end index in raw
 */
function speedDecimalCursorPosAfterNormalize(raw, cutIndex) {
  let decimalSeen = false;
  let outLen = 0;
  const end = Math.min(Math.max(0, cutIndex), raw.length);
  for (let i = 0; i < end; i++) {
    const ch = raw[i];
    if (ch >= "0" && ch <= "9") {
      outLen += 1;
    } else if (!decimalSeen && (ch === "." || ch === ",")) {
      decimalSeen = true;
      outLen += 1;
    }
  }
  return outLen;
}

/**
 * @param {HTMLInputElement} el
 * @returns {boolean} true if value changed
 */
function sanitizeSpeedDecimalPreserveCursor(el) {
  const raw = el.value;
  const clean = normalizePositiveDecimalString(raw);
  const selStart = typeof el.selectionStart === "number" ? el.selectionStart : clean.length;
  const selEnd = typeof el.selectionEnd === "number" ? el.selectionEnd : selStart;
  if (raw === clean) return false;
  const posA = speedDecimalCursorPosAfterNormalize(raw, selStart);
  const posB = speedDecimalCursorPosAfterNormalize(raw, selEnd);
  el.value = clean;
  try {
    const a = Math.min(posA, clean.length);
    const b = Math.min(posB, clean.length);
    el.setSelectionRange(a, b);
  } catch (_) {}
  return true;
}

/**
 * @param {HTMLInputElement} el
 * @returns {boolean} true if value changed
 */
function stripNonDigitsPreserveCursor(el) {
  const raw = el.value;
  const clean = raw.replace(/\D/g, "");
  if (raw === clean) return false;
  const selStart = typeof el.selectionStart === "number" ? el.selectionStart : clean.length;
  const before = raw.slice(0, selStart);
  const pos = Math.min(before.replace(/\D/g, "").length, clean.length);
  el.value = clean;
  try {
    el.setSelectionRange(pos, pos);
  } catch (_) {
    // Some hosts omit selection support on hidden inputs.
  }
  return true;
}

function applySessionSnapshot(data) {
  if (!data || typeof data !== "object") {
    return;
  }
  const payload =
    data.v === SESSION_SNAPSHOT_VERSION
      ? data
      : data.payload && typeof data.payload === "object" && data.payload.v === SESSION_SNAPSHOT_VERSION
        ? data.payload
        : null;
  if (!payload) {
    return;
  }
  const next = sanitizeFormState(payload);
  applyDomState(next);
}

function bindInputs() {
  const inputs = document.querySelectorAll(
    "#mph, #kph, #mps, #paceMileMin, #paceMileSec, #paceKmMin, #paceKmSec, " +
      "#raceKm5H, #raceKm5M, #raceKm5S, #raceKm10H, #raceKm10M, #raceKm10S, " +
      "#raceHalfH, #raceHalfM, #raceHalfS, #raceMarathonH, #raceMarathonM, #raceMarathonS",
  );

  inputs.forEach((el) => {
    el.addEventListener("beforeinput", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.classList.contains(DIGITS_ONLY_CLASS)) {
        if (e.inputType === "insertText" && e.data != null && /\D/.test(e.data)) {
          e.preventDefault();
        }
        return;
      }
      if (t.classList.contains(SPEED_DECIMAL_CLASS)) {
        if (e.inputType === "insertText" && e.data != null && /[^\d.,]/.test(e.data)) {
          e.preventDefault();
        }
      }
    });
    el.addEventListener("paste", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.classList.contains(DIGITS_ONLY_CLASS)) {
        e.preventDefault();
        const text = e.clipboardData?.getData("text/plain") ?? "";
        const digits = text.replace(/\D/g, "");
        const start = t.selectionStart ?? 0;
        const end = t.selectionEnd ?? 0;
        const v = t.value;
        const merged = `${v.slice(0, start)}${digits}${v.slice(end)}`.replace(/\D/g, "");
        t.value = merged;
        const pos = Math.min(start + digits.length, merged.length);
        try {
          t.setSelectionRange(pos, pos);
        } catch (_) {}
        if (!updating) {
          recompute(t);
        }
        return;
      }
      if (t.classList.contains(SPEED_DECIMAL_CLASS)) {
        e.preventDefault();
        const text = e.clipboardData?.getData("text/plain") ?? "";
        const ins = normalizePositiveDecimalString(text);
        const start = t.selectionStart ?? 0;
        const end = t.selectionEnd ?? 0;
        const v = t.value;
        const intermediate = `${v.slice(0, start)}${ins}${v.slice(end)}`;
        const merged = normalizePositiveDecimalString(intermediate);
        const pos = speedDecimalCursorPosAfterNormalize(intermediate, start + ins.length);
        t.value = merged;
        try {
          const p = Math.min(pos, merged.length);
          t.setSelectionRange(p, p);
        } catch (_) {}
        if (!updating) {
          recompute(t);
        }
      }
    });
    el.addEventListener("input", (event) => {
      const t = event.target;
      if (t instanceof HTMLInputElement && t.classList.contains(DIGITS_ONLY_CLASS)) {
        stripNonDigitsPreserveCursor(t);
      }
      if (t instanceof HTMLInputElement && t.classList.contains(SPEED_DECIMAL_CLASS)) {
        sanitizeSpeedDecimalPreserveCursor(t);
      }
      if (!updating) {
        recompute(event.target);
      }
    });
    el.addEventListener("blur", (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && ["mph", "kph", "mps"].includes(t.id) && !updating) {
        const raw = readDomState();
        const mps = inferMpsFromForm(raw, inferOriginFromTarget(t));
        if (mps != null) {
          applyDomState(stateFromMps(mps), null);
        }
      }
      session?.persistNow();
    });
  });

  const clearBtn = document.getElementById("clearAll");
  clearBtn?.addEventListener("click", () => {
    applyDomState(createEmptyFormState());
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
  if (!mphEl || !kphEl || !mpsEl) {
    return;
  }

  const runtime = window.UtilivosRuntime;
  if (runtime && typeof window.UtilivosRuntime.syncState === "function") {
    session = window.UtilivosRuntime.syncState({
      read: getSessionSnapshot,
      write: applySessionSnapshot,
      debounceMs: 400,
    });
    if (typeof window.UtilivosRuntime.registerSessionRestore === "function") {
      window.UtilivosRuntime.registerSessionRestore((snapshot) => {
        applySessionSnapshot(snapshot);
        session.persistNow();
      });
    }
  }

  bindInputs();

  if (session && runtime?.shouldHydrateFromHost?.()) {
    await session.hydrateFromHost();
  }

  recompute();
  session?.persistNow();
}

bootstrap().catch((error) => {
  console.error(error);
});
