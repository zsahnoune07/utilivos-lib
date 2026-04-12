import {
  PHASES,
  createInitialState,
  formatClock,
  getPhaseDurationSeconds,
  pauseTimer,
  resetTimer,
  skipPhase,
  startTimer,
  tickTimer,
  updatePreferences,
  updateSettings,
} from "./lib/timer-engine.js";
import { createSerializableState, restoreState } from "./lib/persistence.js";
import {
  emitNotification,
  playSoundCue,
  requestNotificationPermissionIfNeeded,
} from "./lib/notifications.js";

const ui = window.UtilivosUI;
const runtime = window.UtilivosRuntime;

const dom = {
  phaseLabel: document.getElementById("phaseLabel"),
  clock: document.getElementById("clock"),
  phaseMeta: document.getElementById("phaseMeta"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  statusText: document.getElementById("statusText"),
  startPauseButton: document.getElementById("startPauseButton"),
  skipButton: document.getElementById("skipButton"),
  resetButton: document.getElementById("resetButton"),
  workMinutes: document.getElementById("workMinutes"),
  shortBreakMinutes: document.getElementById("shortBreakMinutes"),
  longBreakMinutes: document.getElementById("longBreakMinutes"),
  sessionsPerLongBreak: document.getElementById("sessionsPerLongBreak"),
  autoStartNextPhase: document.getElementById("autoStartNextPhase"),
  notificationsEnabled: document.getElementById("notificationsEnabled"),
  soundEnabled: document.getElementById("soundEnabled"),
};

if (!ui || !runtime || Object.values(dom).some((node) => !node)) {
  throw new Error("Pomodoro timer cannot bootstrap without required host/runtime nodes.");
}

let appState = createInitialState();
let lastStatusKey = "timer.status.ready";
let timerId = 0;
let session = null;
let lastTickPersistMs = 0;

function t(key, values) {
  return ui.t(key, values);
}

function phaseToLocaleKey(phase) {
  if (phase === PHASES.SHORT_BREAK) return "timer.phases.short_break";
  if (phase === PHASES.LONG_BREAK) return "timer.phases.long_break";
  return "timer.phases.work";
}

function setStatus(key, values) {
  lastStatusKey = key;
  dom.statusText.textContent = t(key, values);
}

function getStartButtonKey() {
  if (appState.isRunning) {
    return "timer.actions.pause";
  }
  const isFreshWorkSession =
    appState.phase === PHASES.WORK &&
    appState.remainingSeconds === getPhaseDurationSeconds(appState.settings, appState.phase) &&
    appState.completedWorkSessions === 0;
  return isFreshWorkSession ? "timer.actions.start" : "timer.actions.resume";
}

function renderSettings() {
  dom.workMinutes.value = String(appState.settings.workMinutes);
  dom.shortBreakMinutes.value = String(appState.settings.shortBreakMinutes);
  dom.longBreakMinutes.value = String(appState.settings.longBreakMinutes);
  dom.sessionsPerLongBreak.value = String(appState.settings.sessionsPerLongBreak);
  dom.autoStartNextPhase.checked = appState.preferences.autoStartNextPhase;
  dom.notificationsEnabled.checked = appState.preferences.notificationsEnabled;
  dom.soundEnabled.checked = appState.preferences.soundEnabled;
}

function renderTimer() {
  const totalPhaseSeconds = getPhaseDurationSeconds(appState.settings, appState.phase);
  const consumed = totalPhaseSeconds - appState.remainingSeconds;
  const progressRatio = totalPhaseSeconds > 0 ? consumed / totalPhaseSeconds : 0;
  dom.phaseLabel.textContent = t(phaseToLocaleKey(appState.phase));
  dom.clock.textContent = formatClock(appState.remainingSeconds);
  dom.phaseMeta.textContent = t("timer.phase_meta", {
    sessions: String(appState.completedWorkSessions),
    cycle: String(appState.settings.sessionsPerLongBreak),
  });
  dom.progressBar.style.width = `${Math.max(0, Math.min(100, progressRatio * 100)).toFixed(2)}%`;
  dom.progressText.textContent = t("timer.progress", {
    elapsed: formatClock(Math.max(0, consumed)),
    total: formatClock(totalPhaseSeconds),
  });
  dom.startPauseButton.textContent = t(getStartButtonKey());
  if (lastStatusKey) {
    dom.statusText.textContent = t(lastStatusKey);
  }
}

function renderAll() {
  renderSettings();
  renderTimer();
}

function persistState() {
  session?.schedulePersist();
}

function persistImmediately() {
  session?.persistNow();
}

async function processEvents(events) {
  if (!events.length) {
    return;
  }
  for (const event of events) {
    if (event.type === "phaseCompleted") {
      const completedLabel = t(phaseToLocaleKey(event.phase));
      setStatus(
        event.skipped ? "timer.status.phase_skipped" : "timer.status.phase_completed",
        { phase: completedLabel },
      );
      if (appState.preferences.notificationsEnabled) {
        const title = t("notifications.phase_completed.title");
        const body = t("notifications.phase_completed.body", { phase: completedLabel });
        await emitNotification(title, body);
      }
      if (appState.preferences.soundEnabled) {
        await playSoundCue();
      }
    }
    if (event.type === "phaseStarted") {
      const startedLabel = t(phaseToLocaleKey(event.phase));
      setStatus("timer.status.phase_started", { phase: startedLabel });
      if (appState.preferences.notificationsEnabled) {
        await emitNotification(
          t("notifications.phase_started.title"),
          t("notifications.phase_started.body", { phase: startedLabel }),
        );
      }
    }
  }
}

async function updateState(result, persistNow = false) {
  appState = result.state;
  await processEvents(result.events || []);
  renderAll();
  if (persistNow) {
    persistImmediately();
  } else {
    persistState();
  }
}

function bindSettings() {
  const onNumericSettingsChange = () => {
    appState = updateSettings(appState, {
      workMinutes: Number(dom.workMinutes.value),
      shortBreakMinutes: Number(dom.shortBreakMinutes.value),
      longBreakMinutes: Number(dom.longBreakMinutes.value),
      sessionsPerLongBreak: Number(dom.sessionsPerLongBreak.value),
    });
    setStatus("timer.status.settings_saved");
    renderAll();
    persistState();
  };

  [dom.workMinutes, dom.shortBreakMinutes, dom.longBreakMinutes, dom.sessionsPerLongBreak].forEach((node) => {
    node.addEventListener("change", onNumericSettingsChange);
  });

  dom.autoStartNextPhase.addEventListener("change", () => {
    appState = updatePreferences(appState, {
      autoStartNextPhase: dom.autoStartNextPhase.checked,
    });
    setStatus("timer.status.settings_saved");
    renderAll();
    persistState();
  });

  dom.notificationsEnabled.addEventListener("change", async () => {
    let enabled = dom.notificationsEnabled.checked;
    if (enabled) {
      const permission = await requestNotificationPermissionIfNeeded();
      if (permission !== "granted") {
        enabled = false;
        dom.notificationsEnabled.checked = false;
        setStatus("timer.status.notifications_denied");
      }
    }
    appState = updatePreferences(appState, {
      notificationsEnabled: enabled,
    });
    renderAll();
    persistState();
  });

  dom.soundEnabled.addEventListener("change", () => {
    appState = updatePreferences(appState, {
      soundEnabled: dom.soundEnabled.checked,
    });
    renderAll();
    persistState();
  });
}

function bindActions() {
  dom.startPauseButton.addEventListener("click", async () => {
    const result = appState.isRunning ? pauseTimer(appState) : startTimer(appState, Date.now());
    setStatus(appState.isRunning ? "timer.status.paused" : "timer.status.running");
    await updateState(result);
  });

  dom.skipButton.addEventListener("click", async () => {
    await updateState(skipPhase(appState, Date.now()), true);
  });

  dom.resetButton.addEventListener("click", async () => {
    setStatus("timer.status.reset");
    await updateState(resetTimer(appState, Date.now()), true);
  });
}

function startTickLoop() {
  timerId = window.setInterval(async () => {
    const result = tickTimer(appState, Date.now());
    const changed =
      result.state.remainingSeconds !== appState.remainingSeconds ||
      result.state.phase !== appState.phase ||
      result.state.isRunning !== appState.isRunning ||
      result.events.length > 0;
    if (!changed) {
      return;
    }
    appState = result.state;
    await processEvents(result.events);
    renderAll();
    const now = Date.now();
    if (now - lastTickPersistMs > 5000 || result.events.length > 0) {
      persistState();
      lastTickPersistMs = now;
    }
  }, 250);
}

async function bootstrap() {
  ui.ensureToolPage();
  await ui.initLocalization({
    defaultLocale: "en",
    supportedLocales: ["en"],
    basePath: "./locales",
  });

  session = window.UtilivosRuntime.syncState({
    read: () => createSerializableState(appState),
    write: (rawState) => {
      appState = restoreState(rawState);
      renderAll();
    },
    debounceMs: 300,
  });
  await session.hydrateFromHost();
  setStatus("timer.status.ready");
  renderAll();
  bindSettings();
  bindActions();
  startTickLoop();
}

window.addEventListener("beforeunload", () => {
  if (timerId) {
    window.clearInterval(timerId);
  }
});

bootstrap().catch((error) => {
  console.error(error);
});
