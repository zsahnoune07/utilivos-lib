import {
  createInitialState,
  sanitizePreferences,
  sanitizeSettings,
  getPhaseDurationSeconds,
  PHASES,
} from "./timer-engine.js";

export const PERSISTENCE_VERSION = 1;

export function createSerializableState(state) {
  return {
    v: PERSISTENCE_VERSION,
    settings: state.settings,
    preferences: state.preferences,
    phase: state.phase,
    remainingSeconds: state.remainingSeconds,
    isRunning: state.isRunning,
    lastTickAtMs: state.lastTickAtMs,
    phaseStartedAtMs: state.phaseStartedAtMs,
    completedWorkSessions: state.completedWorkSessions,
  };
}

function sanitizePhase(rawPhase) {
  if (rawPhase === PHASES.WORK || rawPhase === PHASES.SHORT_BREAK || rawPhase === PHASES.LONG_BREAK) {
    return rawPhase;
  }
  return PHASES.WORK;
}

export function restoreState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return createInitialState();
  }
  if (rawState.v !== PERSISTENCE_VERSION) {
    return createInitialState();
  }

  const base = createInitialState({
    settings: sanitizeSettings(rawState.settings),
    preferences: sanitizePreferences(rawState.preferences),
    nowMs: Date.now(),
  });
  const phase = sanitizePhase(rawState.phase);
  const maxDuration = getPhaseDurationSeconds(base.settings, phase);

  return {
    ...base,
    phase,
    remainingSeconds: Math.min(
      maxDuration,
      Math.max(1, Math.floor(Number(rawState.remainingSeconds) || maxDuration)),
    ),
    isRunning: Boolean(rawState.isRunning),
    lastTickAtMs: Number.isFinite(rawState.lastTickAtMs) ? Number(rawState.lastTickAtMs) : null,
    phaseStartedAtMs: Number.isFinite(rawState.phaseStartedAtMs)
      ? Number(rawState.phaseStartedAtMs)
      : base.phaseStartedAtMs,
    completedWorkSessions: Math.max(0, Math.floor(Number(rawState.completedWorkSessions) || 0)),
  };
}
