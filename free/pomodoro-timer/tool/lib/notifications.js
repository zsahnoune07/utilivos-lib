let audioContext = null;

function getHostBridge() {
  if (typeof window === "undefined" || !window.utilivos || typeof window.utilivos !== "object") {
    return null;
  }
  return window.utilivos;
}

export function canUseNotifications() {
  const host = getHostBridge();
  if (host && typeof host.requestNotificationPermission === "function") {
    return true;
  }
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermissionIfNeeded() {
  const host = getHostBridge();
  if (host && typeof host.requestNotificationPermission === "function") {
    try {
      const permission = await host.requestNotificationPermission();
      if (permission === "granted" || permission === "denied") {
        return permission;
      }
      return "unsupported";
    } catch (_error) {
      return "denied";
    }
  }

  if (!canUseNotifications()) {
    return "unsupported";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  if (Notification.permission === "denied") {
    return "denied";
  }
  try {
    return await Notification.requestPermission();
  } catch (_error) {
    return "denied";
  }
}

export function emitNotification(title, body) {
  const host = getHostBridge();
  if (host && typeof host.sendNotification === "function") {
    return host.sendNotification(title, body).catch(() => false);
  }

  if (!canUseNotifications() || Notification.permission !== "granted") {
    return false;
  }
  try {
    const notification = new Notification(title, { body });
    window.setTimeout(() => notification.close(), 4000);
    return true;
  } catch (_error) {
    return false;
  }
}

export async function playSoundCue() {
  if (typeof window === "undefined") {
    return false;
  }
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) {
    return false;
  }
  try {
    if (!audioContext) {
      audioContext = new Context();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
    return true;
  } catch (_error) {
    return false;
  }
}
