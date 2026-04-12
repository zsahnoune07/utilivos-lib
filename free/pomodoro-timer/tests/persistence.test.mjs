import test from "node:test";
import assert from "node:assert/strict";

import { createInitialState } from "../tool/lib/timer-engine.js";
import { createSerializableState, restoreState } from "../tool/lib/persistence.js";

test("serializes and restores persisted state", () => {
  const state = createInitialState({
    settings: {
      workMinutes: 30,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsPerLongBreak: 4,
    },
    preferences: {
      autoStartNextPhase: true,
      notificationsEnabled: true,
      soundEnabled: true,
    },
    nowMs: 0,
  });
  const serialized = createSerializableState(state);
  const restored = restoreState(serialized);
  assert.equal(restored.settings.workMinutes, 30);
  assert.equal(restored.preferences.notificationsEnabled, true);
  assert.equal(restored.remainingSeconds, 1800);
});

test("falls back to defaults for invalid payload versions", () => {
  const restored = restoreState({
    v: 999,
    settings: {
      workMinutes: 60,
    },
  });
  assert.equal(restored.settings.workMinutes, 25);
  assert.equal(restored.completedWorkSessions, 0);
});

test("sanitizes malformed payload fields", () => {
  const restored = restoreState({
    v: 1,
    settings: {
      workMinutes: "bad",
      shortBreakMinutes: 0,
      longBreakMinutes: 999,
      sessionsPerLongBreak: -2,
    },
    preferences: {
      notificationsEnabled: "yes",
      autoStartNextPhase: 1,
    },
    remainingSeconds: -100,
  });

  assert.equal(restored.settings.workMinutes, 25);
  assert.equal(restored.settings.shortBreakMinutes, 1);
  assert.equal(restored.settings.longBreakMinutes, 90);
  assert.equal(restored.settings.sessionsPerLongBreak, 2);
  assert.equal(restored.preferences.notificationsEnabled, true);
  assert.equal(restored.remainingSeconds >= 1, true);
});
