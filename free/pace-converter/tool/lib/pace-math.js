/**
 * Running pace / speed conversions (same unit relationships as runbundle.com).
 * Mile = 1609.344 m; mile ↔ km factor 1.609344.
 */

/** IAAF / common road race distances in meters. */
export const RACE_DISTANCE_M = {
  km5: 5000,
  km10: 10000,
  /** Half marathon */
  half: 21097.5,
  marathon: 42195,
};

export const METERS_PER_MILE = 1609.344;
export const KM_PER_MILE = 1.609344;

const SPEED_DECIMALS = 2;

/**
 * @param {string|undefined|null} str
 * @returns {number | null} positive finite number or null
 */
export function parsePositiveNumber(str) {
  const t = String(str ?? "").trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Speed field: empty, "0", or trailing "." / "," only → skip (treat as cleared while editing).
 * @returns {{ kind: 'skip' } | { kind: 'invalid' } | { kind: 'ok', value: number }}
 */
function parseSpeedFieldToken(str) {
  const raw = String(str ?? "").trim();
  if (raw === "") return { kind: "skip" };
  const normalized = raw.replace(",", ".");
  if (normalized === "." || /^\d*\.$/.test(normalized)) return { kind: "skip" };
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return { kind: "invalid" };
  if (n === 0) return { kind: "skip" };
  return { kind: "ok", value: n };
}

/**
 * Non-negative integer string for time fields (pace min/sec, race h/m/s). Empty → null (caller uses 0).
 * @returns {number | null} integer, or null if empty, or NaN signal via invalid check
 */
function parseTimeIntToken(str) {
  const t = String(str ?? "").trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return Number.NaN;
  return Number(t);
}

export function mpsFromMph(mph) {
  return (mph * METERS_PER_MILE) / 3600;
}

export function mpsFromKph(kph) {
  return (kph * 1000) / 3600;
}

export function mpsFromPacePerMileSeconds(secPerMile) {
  return METERS_PER_MILE / secPerMile;
}

export function mpsFromPacePerKmSeconds(secPerKm) {
  return 1000 / secPerKm;
}

/**
 * @param {string|undefined|null} minStr
 * @param {string|undefined|null} secStr
 * @returns {Object} Result with type 'empty' | 'invalid' | 'ok' and optional totalSec.
 */
export function parsePaceMinSecParts(minStr, secStr) {
  const minT = String(minStr ?? "").trim();
  const secT = String(secStr ?? "").trim();
  if (minT === "" && secT === "") {
    return { type: "empty" };
  }
  let min = 0;
  if (minT !== "") {
    const m = parseTimeIntToken(minT);
    if (m == null || Number.isNaN(m) || m < 0) {
      return { type: "invalid" };
    }
    min = m;
  }
  let sec = 0;
  if (secT !== "") {
    const s = parseTimeIntToken(secT);
    if (s == null || Number.isNaN(s) || s < 0 || s >= 60) {
      return { type: "invalid" };
    }
    sec = s;
  }
  const totalSec = min * 60 + sec;
  if (totalSec <= 0) {
    return { type: "invalid" };
  }
  return { type: "ok", totalSec };
}

/**
 * @param {string|undefined|null} hStr
 * @param {string|undefined|null} mStr
 * @param {string|undefined|null} sStr
 * @returns {Object} Result with type 'empty' | 'invalid' | 'ok' and optional totalSec.
 */
export function parseRaceHmsParts(hStr, mStr, sStr) {
  const hT = String(hStr ?? "").trim();
  const mT = String(mStr ?? "").trim();
  const sT = String(sStr ?? "").trim();
  if (hT === "" && mT === "" && sT === "") {
    return { type: "empty" };
  }
  const h = hT === "" ? 0 : parseTimeIntToken(hT);
  const m = mT === "" ? 0 : parseTimeIntToken(mT);
  const s = sT === "" ? 0 : parseTimeIntToken(sT);
  if (
    h == null ||
    m == null ||
    s == null ||
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    Number.isNaN(s)
  ) {
    return { type: "invalid" };
  }
  if (h < 0 || m < 0 || m >= 60 || s < 0 || s >= 60) {
    return { type: "invalid" };
  }
  const totalSec = h * 3600 + m * 60 + s;
  if (totalSec <= 0) {
    return { type: "invalid" };
  }
  return { type: "ok", totalSec };
}

const SPEED_FIELD_ORDER_DEFAULT = ["mph", "kph", "mps"];

/**
 * @param {Object} g mph, kph, mps string fields
 * @param {string[]} fieldOrder try first non-empty field in this order (e.g. focus kph → kph before mph)
 * @returns {number | null} mps if a valid speed is found, null if empty or invalid non-empty in order
 */
export function parseSpeedGroupOrdered(g, fieldOrder) {
  const order = Array.isArray(fieldOrder) && fieldOrder.length > 0 ? fieldOrder : SPEED_FIELD_ORDER_DEFAULT;
  for (const key of order) {
    const raw = String(g[key] ?? "").trim();
    if (raw === "") continue;
    const tok = parseSpeedFieldToken(g[key]);
    if (tok.kind === "skip") continue;
    if (tok.kind === "invalid") return null;
    const n = tok.value;
    if (key === "mph") return mpsFromMph(n);
    if (key === "kph") return mpsFromKph(n);
    return n;
  }
  return null;
}

/**
 * @param {Object} g mph, kph, mps string fields
 * @returns {number | null} mps if a valid speed is present, else null
 */
export function parseSpeedGroup(g) {
  return parseSpeedGroupOrdered(g, SPEED_FIELD_ORDER_DEFAULT);
}

export function speedGroupHasAnyInput(g) {
  return [g.mph, g.kph, g.mps].some((s) => String(s ?? "").trim() !== "");
}

/** True if any speed field has invalid text (blocks inference; unlike all-zero / trailing dot). */
function speedGroupHasBlockingError(state) {
  for (const k of SPEED_FIELD_ORDER_DEFAULT) {
    const raw = String(state[k] ?? "").trim();
    if (raw === "") continue;
    const tok = parseSpeedFieldToken(state[k]);
    if (tok.kind === "invalid") return true;
  }
  return false;
}

/**
 * @returns {number | null | undefined} mps, null if blocked by invalid speed, undefined if no usable speed (fall through)
 */
function tryParseSpeedOrFallThrough(state, speedOrder) {
  if (!speedGroupHasAnyInput(state)) return undefined;
  const mpsSpeed = parseSpeedGroupOrdered(state, speedOrder);
  if (mpsSpeed != null) return mpsSpeed;
  if (speedGroupHasBlockingError(state)) return null;
  return undefined;
}

const RACE_STATE_KEYS = ["km5", "km10", "half", "marathon"];

function speedGroupSkippableOnly(state) {
  let foundNonEmpty = false;
  for (const k of SPEED_FIELD_ORDER_DEFAULT) {
    const raw = String(state[k] ?? "").trim();
    if (raw === "") continue;
    foundNonEmpty = true;
    if (parseSpeedFieldToken(state[k]).kind !== "skip") return false;
  }
  return foundNonEmpty;
}

export function formCompletelyEmpty(state) {
  const s = state;
  const speedCleared = !speedGroupHasAnyInput(s) || speedGroupSkippableOnly(s);
  if (!speedCleared) return false;
  if (paceGroupHasAnyInput(s.paceMileMin, s.paceMileSec)) return false;
  if (paceGroupHasAnyInput(s.paceKmMin, s.paceKmSec)) return false;
  for (const key of RACE_STATE_KEYS) {
    if (raceGroupHasAnyInput(s[`race_${key}`])) return false;
  }
  return true;
}

function paceGroupHasAnyInput(minStr, secStr) {
  return String(minStr ?? "").trim() !== "" || String(secStr ?? "").trim() !== "";
}

function raceGroupHasAnyInput(r) {
  if (!r) return false;
  return (
    String(r.h ?? "").trim() !== "" ||
    String(r.m ?? "").trim() !== "" ||
    String(r.s ?? "").trim() !== ""
  );
}

/**
 * @typedef {Object} InferOrigin
 * @property {'speed'} [type]
 * @property {'mph'|'kph'|'mps'} [field] when type==='speed'
 * @property {'paceMile'} [type]
 * @property {'paceKm'} [type]
 * @property {'race'} [type]
 * @property {'km5'|'km10'|'half'|'marathon'} [raceKey] when type==='race'
 */

function speedFieldOrderForOrigin(origin) {
  if (origin?.type === "speed" && SPEED_FIELD_ORDER_DEFAULT.includes(origin.field)) {
    return [origin.field, ...SPEED_FIELD_ORDER_DEFAULT.filter((x) => x !== origin.field)];
  }
  return [...SPEED_FIELD_ORDER_DEFAULT];
}

function inferMpsFromPacesAndRaces(state) {
  if (paceGroupHasAnyInput(state.paceMileMin, state.paceMileSec)) {
    const pm = parsePaceMinSecParts(state.paceMileMin, state.paceMileSec);
    if (pm.type === "ok") return mpsFromPacePerMileSeconds(pm.totalSec);
    return null;
  }

  if (paceGroupHasAnyInput(state.paceKmMin, state.paceKmSec)) {
    const pk = parsePaceMinSecParts(state.paceKmMin, state.paceKmSec);
    if (pk.type === "ok") return mpsFromPacePerKmSeconds(pk.totalSec);
    return null;
  }

  for (const key of RACE_STATE_KEYS) {
    const r = state[`race_${key}`];
    if (!raceGroupHasAnyInput(r)) continue;
    const t = parseRaceHmsParts(r.h, r.m, r.s);
    if (t.type === "ok") {
      return RACE_DISTANCE_M[key] / t.totalSec;
    }
    return null;
  }

  return null;
}

/**
 * Prefer the field/group the user is editing so synced mph does not override typing in kph (etc.).
 * @param {FormState} state
 * @param {InferOrigin | null | undefined} origin
 * @returns {number | null}
 */
export function inferMpsFromForm(state, origin) {
  const speedOrder = speedFieldOrderForOrigin(origin);

  if (origin?.type === "paceMile") {
    if (paceGroupHasAnyInput(state.paceMileMin, state.paceMileSec)) {
      const pm = parsePaceMinSecParts(state.paceMileMin, state.paceMileSec);
      if (pm.type === "ok") return mpsFromPacePerMileSeconds(pm.totalSec);
      if (pm.type === "invalid") return null;
    }
    const sp = tryParseSpeedOrFallThrough(state, speedOrder);
    if (sp !== undefined) return sp;
    return inferMpsFromPacesAndRaces(state);
  }

  if (origin?.type === "paceKm") {
    if (paceGroupHasAnyInput(state.paceKmMin, state.paceKmSec)) {
      const pk = parsePaceMinSecParts(state.paceKmMin, state.paceKmSec);
      if (pk.type === "ok") return mpsFromPacePerKmSeconds(pk.totalSec);
      if (pk.type === "invalid") return null;
    }
    const sp = tryParseSpeedOrFallThrough(state, speedOrder);
    if (sp !== undefined) return sp;
    return inferMpsFromPacesAndRaces(state);
  }

  if (origin?.type === "race" && origin.raceKey && RACE_STATE_KEYS.includes(origin.raceKey)) {
    const r = state[`race_${origin.raceKey}`];
    if (raceGroupHasAnyInput(r)) {
      const t = parseRaceHmsParts(r.h, r.m, r.s);
      if (t.type === "ok") return RACE_DISTANCE_M[origin.raceKey] / t.totalSec;
      if (t.type === "invalid") return null;
    }
    const sp = tryParseSpeedOrFallThrough(state, speedOrder);
    if (sp !== undefined) return sp;
    return inferMpsFromPacesAndRaces(state);
  }

  const spDefault = tryParseSpeedOrFallThrough(state, speedOrder);
  if (spDefault !== undefined) return spDefault;

  if (paceGroupHasAnyInput(state.paceMileMin, state.paceMileSec)) {
    const pm = parsePaceMinSecParts(state.paceMileMin, state.paceMileSec);
    if (pm.type === "ok") return mpsFromPacePerMileSeconds(pm.totalSec);
    return null;
  }

  if (paceGroupHasAnyInput(state.paceKmMin, state.paceKmSec)) {
    const pk = parsePaceMinSecParts(state.paceKmMin, state.paceKmSec);
    if (pk.type === "ok") return mpsFromPacePerKmSeconds(pk.totalSec);
    return null;
  }

  for (const key of RACE_STATE_KEYS) {
    const r = state[`race_${key}`];
    if (!raceGroupHasAnyInput(r)) continue;
    const t = parseRaceHmsParts(r.h, r.m, r.s);
    if (t.type === "ok") {
      return RACE_DISTANCE_M[key] / t.totalSec;
    }
    return null;
  }

  return null;
}

/**
 * @typedef {Object} RaceFields
 * @property {string} [h]
 * @property {string} [m]
 * @property {string} [s]
 */

/**
 * @typedef {Object} FormState
 * @property {string} [mph]
 * @property {string} [kph]
 * @property {string} [mps]
 * @property {string} [paceMileMin]
 * @property {string} [paceMileSec]
 * @property {string} [paceKmMin]
 * @property {string} [paceKmSec]
 * @property {RaceFields} race_km5
 * @property {RaceFields} race_km10
 * @property {RaceFields} race_half
 * @property {RaceFields} race_marathon
 */

export function createEmptyFormState() {
  const emptyRace = () => ({ h: "", m: "", s: "" });
  return {
    mph: "",
    kph: "",
    mps: "",
    paceMileMin: "",
    paceMileSec: "",
    paceKmMin: "",
    paceKmSec: "",
    race_km5: emptyRace(),
    race_km10: emptyRace(),
    race_half: emptyRace(),
    race_marathon: emptyRace(),
  };
}

function roundDecimals(value, decimals) {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}

export function formatMph(mps) {
  if (mps == null || !Number.isFinite(mps) || mps <= 0) return "";
  const mph = (mps * 3600) / METERS_PER_MILE;
  return String(roundDecimals(mph, SPEED_DECIMALS));
}

export function formatKph(mps) {
  if (mps == null || !Number.isFinite(mps) || mps <= 0) return "";
  const kph = mps * 3.6;
  return String(roundDecimals(kph, SPEED_DECIMALS));
}

export function formatMps(mps) {
  if (mps == null || !Number.isFinite(mps) || mps <= 0) return "";
  return String(roundDecimals(mps, SPEED_DECIMALS));
}

/**
 * @param {number} secPerUnit
 * @returns {Object} min and sec string properties
 */
export function formatPaceMinSec(secPerUnit) {
  if (!Number.isFinite(secPerUnit) || secPerUnit <= 0) {
    return { min: "", sec: "" };
  }
  const totalRounded = Math.round(secPerUnit);
  let min = Math.floor(totalRounded / 60);
  let sec = totalRounded % 60;
  if (sec >= 60) {
    min += 1;
    sec = 0;
  }
  return { min: String(min), sec: String(sec) };
}

/**
 * @param {number} totalSec
 * @returns {Object} h, m, s string properties
 */
export function formatRaceHms(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec <= 0) {
    return { h: "", m: "", s: "" };
  }
  const totalRounded = Math.round(totalSec);
  const h = Math.floor(totalRounded / 3600);
  const m = Math.floor((totalRounded % 3600) / 60);
  const s = totalRounded - h * 3600 - m * 60;
  return { h: String(h), m: String(m), s: String(s) };
}

/**
 * Fill all fields from mps (strings for inputs).
 * @param {number | null} mps
 * @returns {FormState}
 */
export function stateFromMps(mps) {
  const empty = createEmptyFormState();
  if (mps == null || !Number.isFinite(mps) || mps <= 0) {
    return empty;
  }
  empty.mph = formatMph(mps);
  empty.kph = formatKph(mps);
  empty.mps = formatMps(mps);

  const secMile = METERS_PER_MILE / mps;
  const pm = formatPaceMinSec(secMile);
  empty.paceMileMin = pm.min;
  empty.paceMileSec = pm.sec;

  const secKm = 1000 / mps;
  const pk = formatPaceMinSec(secKm);
  empty.paceKmMin = pk.min;
  empty.paceKmSec = pk.sec;

  for (const key of Object.keys(RACE_DISTANCE_M)) {
    const dist = RACE_DISTANCE_M[key];
    const t = dist / mps;
    empty[`race_${key}`] = formatRaceHms(t);
  }

  return empty;
}

/**
 * Read state from flat persisted object (snapshot payload).
 * @param {Record<string, unknown>} raw
 * @returns {FormState}
 */
export function sanitizeFormState(raw) {
  const out = createEmptyFormState();
  if (!raw || typeof raw !== "object") return out;

  const str = (v) => (typeof v === "string" ? v : v != null ? String(v) : "");

  out.mph = str(raw.mph);
  out.kph = str(raw.kph);
  out.mps = str(raw.mps);
  out.paceMileMin = str(raw.paceMileMin);
  out.paceMileSec = str(raw.paceMileSec);
  out.paceKmMin = str(raw.paceKmMin);
  out.paceKmSec = str(raw.paceKmSec);

  function raceFrom(prefix) {
    const obj = raw[prefix];
    if (!obj || typeof obj !== "object") return { h: "", m: "", s: "" };
    return {
      h: str(obj.h),
      m: str(obj.m),
      s: str(obj.s),
    };
  }

  out.race_km5 = raceFrom("race_km5");
  out.race_km10 = raceFrom("race_km10");
  out.race_half = raceFrom("race_half");
  out.race_marathon = raceFrom("race_marathon");

  return out;
}
