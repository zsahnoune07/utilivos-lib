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
  await writePersistedState(adapter, "state", { age: "52", diabetes: "yes" });
  const restored = await readPersistedState(adapter, "state", sanitizePersistedState);
  assert.equal(restored.age, "52");
  assert.equal(restored.diabetes, "yes");
});

test("falls back to localStorage-style persistence", async () => {
  const adapter = createStorageAdapter({
    localStorage: createMemoryLocalStorage()
  });

  assert.equal(adapter.kind, "localStorage");
  await writePersistedState(adapter, "state", { age: "45", bmi: "28" });
  const restored = await readPersistedState(adapter, "state", sanitizePersistedState);
  assert.equal(restored.age, "45");
  assert.equal(restored.bmi, "28");

  await clearPersistedState(adapter, "state");
  const cleared = await readPersistedState(adapter, "state", sanitizePersistedState);
  assert.equal(cleared, null);
});
