import test from "node:test";
import assert from "node:assert/strict";

import {
  PHASES,
  createInitialState,
  formatClock,
  getPhaseDurationSeconds,
  skipPhase,
  startTimer,
  tickTimer,
  updateSettings,
} from "../tool/lib/timer-engine.js";

test("starts in work phase with default duration", () => {
  const state = createInitialState({ nowMs: 0 });
  assert.equal(state.phase, PHASES.WORK);
  assert.equal(state.remainingSeconds, 1500);
});

test("transitions work to short break when cycle is not complete", () => {
  let state = createInitialState({
    settings: {
      workMinutes: 1,
      shortBreakMinutes: 1,
      longBreakMinutes: 2,
      sessionsPerLongBreak: 3,
    },
    preferences: {
      autoStartNextPhase: true,
      notificationsEnabled: false,
      soundEnabled: false,
    },
    nowMs: 0,
  });

  state = startTimer(state, 0).state;
  const ticked = tickTimer(state, 60000);
  assert.equal(ticked.state.phase, PHASES.SHORT_BREAK);
  assert.equal(ticked.state.completedWorkSessions, 1);
});

test("routes to long break at cycle boundary", () => {
  let state = createInitialState({
    settings: {
      workMinutes: 1,
      shortBreakMinutes: 1,
      longBreakMinutes: 2,
      sessionsPerLongBreak: 2,
    },
    preferences: {
      autoStartNextPhase: true,
      notificationsEnabled: false,
      soundEnabled: false,
    },
    nowMs: 0,
  });

  state = startTimer(state, 0).state;
  state = tickTimer(state, 60000).state;
  state = tickTimer(state, 120000).state;
  const afterSecondWork = tickTimer(state, 180000);
  assert.equal(afterSecondWork.state.phase, PHASES.LONG_BREAK);
  assert.equal(afterSecondWork.state.completedWorkSessions, 2);
});

test("skip transitions directly to next phase", () => {
  const state = createInitialState({ nowMs: 0 });
  const skipped = skipPhase(state, 1000);
  assert.equal(skipped.state.phase, PHASES.SHORT_BREAK);
});

test("updateSettings clamps values and keeps remaining within phase bounds", () => {
  const state = createInitialState({ nowMs: 0 });
  const updated = updateSettings(state, {
    workMinutes: 1000,
    shortBreakMinutes: 0,
    longBreakMinutes: -5,
    sessionsPerLongBreak: 1,
  });
  assert.equal(updated.settings.workMinutes, 120);
  assert.equal(updated.settings.shortBreakMinutes, 1);
  assert.equal(updated.settings.longBreakMinutes, 1);
  assert.equal(updated.settings.sessionsPerLongBreak, 2);
  assert.equal(
    updated.remainingSeconds,
    Math.min(state.remainingSeconds, getPhaseDurationSeconds(updated.settings, PHASES.WORK)),
  );
});

test("formatClock pads minutes and seconds", () => {
  assert.equal(formatClock(5), "00:05");
  assert.equal(formatClock(65), "01:05");
});
