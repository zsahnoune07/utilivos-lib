function resolveStorageBridge(host) {
  const candidates = [
    host?.UtilivoBridge?.storage,
    host?.utilivoBridge?.storage,
    host?.__UTILIVO_BRIDGE__?.storage,
    host?.Utilivo?.storage
  ];

  return candidates.find((candidate) => candidate && typeof candidate === "object") ?? null;
}

function createNoopStorage() {
  return {
    kind: "memory",
    async getItem() {
      return null;
    },
    async setItem() {},
    async removeItem() {}
  };
}

export function createStorageAdapter(host = globalThis) {
  const bridge = resolveStorageBridge(host);
  if (bridge) {
    return {
      kind: "bridge",
      async getItem(key) {
        if (typeof bridge.getItem === "function") {
          return bridge.getItem(key);
        }
        if (typeof bridge.get === "function") {
          return bridge.get(key);
        }
        return null;
      },
      async setItem(key, value) {
        if (typeof bridge.setItem === "function") {
          await bridge.setItem(key, value);
          return;
        }
        if (typeof bridge.set === "function") {
          await bridge.set(key, value);
        }
      },
      async removeItem(key) {
        if (typeof bridge.removeItem === "function") {
          await bridge.removeItem(key);
          return;
        }
        if (typeof bridge.remove === "function") {
          await bridge.remove(key);
        }
      }
    };
  }

  const localStorage = host?.localStorage;
  if (localStorage && typeof localStorage.getItem === "function") {
    return {
      kind: "localStorage",
      async getItem(key) {
        return localStorage.getItem(key);
      },
      async setItem(key, value) {
        localStorage.setItem(key, value);
      },
      async removeItem(key) {
        localStorage.removeItem(key);
      }
    };
  }

  return createNoopStorage();
}

export async function readPersistedState(adapter, key, sanitize) {
  try {
    const rawValue = await adapter.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(String(rawValue));
    return typeof sanitize === "function" ? sanitize(parsed) : parsed;
  } catch (_) {
    return null;
  }
}

export async function writePersistedState(adapter, key, state) {
  await adapter.setItem(key, JSON.stringify(state));
}

export async function clearPersistedState(adapter, key) {
  await adapter.removeItem(key);
}
