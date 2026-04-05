import test from "node:test";
import assert from "node:assert/strict";

import {
  createStorageAdapter,
  readPersistedState,
  writePersistedState
} from "../tool/lib/storage.js";

function createMemoryLocalStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function sanitizeBuilderPreferences(rawValue) {
  return {
    network: rawValue?.network === "testnet" ? "testnet" : "mainnet",
    compressed: rawValue?.compressed !== false
  };
}

test("prefers a host storage bridge when present", async () => {
  const bridgeState = new Map();
  const adapter = createStorageAdapter({
    UtilivoBridge: {
      storage: {
        getItem(key) {
          return bridgeState.get(key) ?? null;
        },
        setItem(key, value) {
          bridgeState.set(key, value);
        },
        removeItem(key) {
          bridgeState.delete(key);
        }
      }
    }
  });

  assert.equal(adapter.kind, "bridge");

  await writePersistedState(adapter, "state", {
    network: "testnet",
    compressed: false
  });

  const restored = await readPersistedState(adapter, "state", sanitizeBuilderPreferences);
  assert.deepEqual(restored, {
    network: "testnet",
    compressed: false
  });
});

test("falls back to localStorage-style persistence", async () => {
  const adapter = createStorageAdapter({
    localStorage: createMemoryLocalStorage()
  });

  assert.equal(adapter.kind, "localStorage");

  await writePersistedState(adapter, "state", {
    network: "mainnet",
    compressed: true
  });

  const restored = await readPersistedState(adapter, "state", sanitizeBuilderPreferences);
  assert.equal(restored.network, "mainnet");
  assert.equal(restored.compressed, true);
});
