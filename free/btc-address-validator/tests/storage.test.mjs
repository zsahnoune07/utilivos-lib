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

function sanitizeValidatorState(rawValue) {
  return {
    addressInput: typeof rawValue?.addressInput === "string" ? rawValue.addressInput.trim() : ""
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
    addressInput: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
  });

  const restored = await readPersistedState(adapter, "state", sanitizeValidatorState);
  assert.deepEqual(restored, {
    addressInput: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
  });
});

test("falls back to localStorage-style persistence", async () => {
  const adapter = createStorageAdapter({
    localStorage: createMemoryLocalStorage()
  });

  assert.equal(adapter.kind, "localStorage");

  await writePersistedState(adapter, "state", {
    addressInput: "  1BoatSLRHtKNngkdXEeobR76b53LETtpyT  "
  });

  const restored = await readPersistedState(adapter, "state", sanitizeValidatorState);
  assert.equal(restored.addressInput, "1BoatSLRHtKNngkdXEeobR76b53LETtpyT");
});
