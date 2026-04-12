export const PHASES = {
  WORK: "work",
  SHORT_BREAK: "shortBreak",
  LONG_BREAK: "longBreak",
};

const MINUTES_LIMITS = {
  workMinutes: { min: 1, max: 120, fallback: 25 },
  shortBreakMinutes: { min: 1, max: 60, fallback: 5 },
  longBreakMinutes: { min: 1, max: 90, fallback: 15 },
  sessionsPerLongBreak: { min: 2, max: 12, fallback: 4 },
};

export function createDefaultSettings() {
  return {
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsPerLongBreak: 4,
  };
}

export function createDefaultPreferences() {
  return {
    autoStartNextPhase: true,
    notificationsEnabled: false,
    soundEnabled: false,
  };
}

export function sanitizeSettings(rawSettings) {
  const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const safe = {};
  for (const [key, limits] of Object.entries(MINUTES_LIMITS)) {
    const asNumber = Number(source[key]);
    if (!Number.isFinite(asNumber)) {
      safe[key] = limits.fallback;
      continue;
    }
    const rounded = Math.round(asNumber);
    safe[key] = Math.min(limits.max, Math.max(limits.min, rounded));
  }
  return safe;
}

export function sanitizePreferences(rawPreferences) {
  const source = rawPreferences && typeof rawPreferences === "object" ? rawPreferences : {};
  return {
    autoStartNextPhase: Boolean(source.autoStartNextPhase),
    notificationsEnabled: Boolean(source.notificationsEnabled),
    soundEnabled: Boolean(source.soundEnabled),
  };
}

export function getPhaseDurationSeconds(settings, phase) {
  if (phase === PHASES.SHORT_BREAK) {
    return settings.shortBreakMinutes * 60;
  }
  if (phase === PHASES.LONG_BREAK) {
    return settings.longBreakMinutes * 60;
  }
  return settings.workMinutes * 60;
}

function getNextPhase(currentPhase, completedWorkSessions, settings) {
  if (currentPhase === PHASES.WORK) {
    if (completedWorkSessions > 0 && completedWorkSessions % settings.sessionsPerLongBreak === 0) {
      return PHASES.LONG_BREAK;
    }
    return PHASES.SHORT_BREAK;
  }
  return PHASES.WORK;
}

function phaseLabel(phase) {
  if (phase === PHASES.SHORT_BREAK) {
    return "shortBreak";
  }
  if (phase === PHASES.LONG_BREAK) {
    return "longBreak";
  }
  return "work";
}

function createEvent(type, payload) {
  return {
    type,
    ...payload,
  };
}

export function createInitialState({
  settings = createDefaultSettings(),
  preferences = createDefaultPreferences(),
  nowMs = Date.now(),
} = {}) {
  const safeSettings = sanitizeSettings(settings);
  return {
    stateVersion: 1,
    settings: safeSettings,
    preferences: sanitizePreferences(preferences),
    phase: PHASES.WORK,
    remainingSeconds: getPhaseDurationSeconds(safeSettings, PHASES.WORK),
    isRunning: false,
    lastTickAtMs: null,
    phaseStartedAtMs: nowMs,
    completedWorkSessions: 0,
  };
}

function withPatchedState(state, patch) {
  return {
    ...state,
    ...patch,
  };
}

function recordCompletion(state, { skipped }) {
  const currentDuration = getPhaseDurationSeconds(state.settings, state.phase);
  const shouldCountFocus = state.phase === PHASES.WORK && !skipped;
  const nextCompletedWorkSessions = shouldCountFocus
    ? state.completedWorkSessions + 1
    : state.completedWorkSessions;
  return {
    completedWorkSessions: nextCompletedWorkSessions,
  };
}

function transitionToNextPhase(state, nowMs, skipped = false) {
  const completionUpdate = recordCompletion(state, { skipped });
  const completedWork = completionUpdate.completedWorkSessions;
  const nextPhase = getNextPhase(state.phase, completedWork, state.settings);
  const nextDuration = getPhaseDurationSeconds(state.settings, nextPhase);
  const staysRunning = state.preferences.autoStartNextPhase;

  const nextState = withPatchedState(state, {
    ...completionUpdate,
    phase: nextPhase,
    remainingSeconds: nextDuration,
    isRunning: staysRunning,
    lastTickAtMs: staysRunning ? nowMs : null,
    phaseStartedAtMs: nowMs,
  });

  return {
    state: nextState,
    events: [
      createEvent("phaseCompleted", {
        phase: phaseLabel(state.phase),
        skipped,
      }),
      createEvent("phaseStarted", {
        phase: phaseLabel(nextPhase),
      }),
    ],
  };
}

export function updateSettings(state, updates) {
  const safeSettings = sanitizeSettings({
    ...state.settings,
    ...(updates && typeof updates === "object" ? updates : {}),
  });
  const duration = getPhaseDurationSeconds(safeSettings, state.phase);
  return withPatchedState(state, {
    settings: safeSettings,
    remainingSeconds: Math.min(Math.max(state.remainingSeconds, 1), duration),
  });
}

export function updatePreferences(state, updates) {
  const safePreferences = sanitizePreferences({
    ...state.preferences,
    ...(updates && typeof updates === "object" ? updates : {}),
  });
  return withPatchedState(state, { preferences: safePreferences });
}

export function startTimer(state, nowMs = Date.now()) {
  if (state.isRunning) {
    return { state, events: [] };
  }
  return {
    state: withPatchedState(state, { isRunning: true, lastTickAtMs: nowMs }),
    events: [createEvent("timerStarted", { atMs: nowMs })],
  };
}

export function pauseTimer(state) {
  if (!state.isRunning) {
    return { state, events: [] };
  }
  return {
    state: withPatchedState(state, { isRunning: false, lastTickAtMs: null }),
    events: [createEvent("timerPaused", {})],
  };
}

export function skipPhase(state, nowMs = Date.now()) {
  return transitionToNextPhase(state, nowMs, true);
}

export function resetTimer(state, nowMs = Date.now()) {
  const workDuration = getPhaseDurationSeconds(state.settings, PHASES.WORK);
  return {
    state: withPatchedState(state, {
      phase: PHASES.WORK,
      remainingSeconds: workDuration,
      isRunning: false,
      lastTickAtMs: null,
      phaseStartedAtMs: nowMs,
    }),
    events: [createEvent("timerReset", {})],
  };
}

export function tickTimer(state, nowMs = Date.now()) {
  if (!state.isRunning || !Number.isFinite(state.lastTickAtMs)) {
    return { state, events: [] };
  }
  if (nowMs <= state.lastTickAtMs) {
    return { state, events: [] };
  }

  let nextState = { ...state };
  let elapsed = Math.floor((nowMs - state.lastTickAtMs) / 1000);
  let anchorMs = state.lastTickAtMs;
  const events = [];

  while (elapsed > 0 && nextState.isRunning) {
    if (elapsed < nextState.remainingSeconds) {
      nextState = withPatchedState(nextState, {
        remainingSeconds: nextState.remainingSeconds - elapsed,
      });
      anchorMs += elapsed * 1000;
      elapsed = 0;
      break;
    }

    const consumed = nextState.remainingSeconds;
    elapsed -= consumed;
    anchorMs += consumed * 1000;

    const transitioned = transitionToNextPhase(
      withPatchedState(nextState, {
        remainingSeconds: 0,
      }),
      anchorMs,
      false,
    );
    nextState = transitioned.state;
    events.push(...transitioned.events);

    if (!nextState.isRunning) {
      break;
    }
  }

  if (nextState.isRunning) {
    nextState = withPatchedState(nextState, {
      lastTickAtMs: anchorMs,
    });
  }

  return { state: nextState, events };
}

export function formatClock(totalSeconds) {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(normalized % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}
