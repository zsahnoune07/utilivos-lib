import test from "node:test";
import assert from "node:assert/strict";

import { sanitizePersistedState } from "../tool/lib/calculator.js";
import {
  clearPersistedState,
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
  await writePersistedState(adapter, "state", { unit: "metric", heightCm: "180", weightKg: "75" });
  const restored = await readPersistedState(adapter, "state", sanitizePersistedState);
  assert.equal(restored.unit, "metric");
  assert.equal(restored.heightCm, "180");
  assert.equal(restored.weightKg, "75");
});

test("falls back to localStorage-style persistence and clears stored state", async () => {
  const adapter = createStorageAdapter({
    localStorage: createMemoryLocalStorage()
  });

  assert.equal(adapter.kind, "localStorage");
  await writePersistedState(adapter, "state", { unit: "imperial", heightFt: "5", heightIn: "10", weightLb: "170" });
  const restored = await readPersistedState(adapter, "state", sanitizePersistedState);
  assert.equal(restored.unit, "imperial");
  assert.equal(restored.heightFt, "5");
  assert.equal(restored.heightIn, "10");
  assert.equal(restored.weightLb, "170");

  await clearPersistedState(adapter, "state");
  const cleared = await readPersistedState(adapter, "state", sanitizePersistedState);
  assert.equal(cleared, null);
});
