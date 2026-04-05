import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAddressBundle,
  parsePrivateKey,
  publicKeyFromPrivate
} from "../tool/lib/bitcoin.js";

const PRIVATE_KEY_ONE = "0000000000000000000000000000000000000000000000000000000000000001";
const GENERATOR_PUBLIC_KEY_COMPRESSED =
  "0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798";

test("derives the secp256k1 generator public key and known compressed P2PKH address", async () => {
  const parsed = parsePrivateKey(PRIVATE_KEY_ONE);
  const publicKey = publicKeyFromPrivate(parsed.value, true);

  assert.equal(Buffer.from(publicKey).toString("hex").toUpperCase(), GENERATOR_PUBLIC_KEY_COMPRESSED);

  const bundle = await buildAddressBundle(PRIVATE_KEY_ONE, {
    network: "mainnet",
    compressed: true
  });

  assert.equal(bundle.steps.step0, PRIVATE_KEY_ONE);
  assert.equal(bundle.steps.step1, GENERATOR_PUBLIC_KEY_COMPRESSED);
  assert.equal(bundle.steps.step9, "1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH");
});

test("produces stable WIF, nested SegWit, native SegWit, and script outputs", async () => {
  const bundle = await buildAddressBundle(PRIVATE_KEY_ONE, {
    network: "mainnet",
    compressed: true
  });

  assert.equal(bundle.outputs.wif, "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn");
  assert.equal(bundle.outputs.nested, "3JvL6Ymt8MVWiCNHC7oWU6nLeHNJKLZGLN");
  assert.equal(bundle.outputs.segwit, "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
  assert.equal(bundle.outputs.legacyScript, "76A914751E76E8199196D454941C45D1B3A323F1433BD688AC");
  assert.equal(bundle.outputs.segwitScript, "0014751E76E8199196D454941C45D1B3A323F1433BD6");
});

test("supports uncompressed testnet derivation", async () => {
  const bundle = await buildAddressBundle(PRIVATE_KEY_ONE, {
    network: "testnet",
    compressed: false
  });

  assert.equal(bundle.steps.step9, "mtoKs9V381UAhUia3d7Vb9GNak8Qvmcsme");
  assert.equal(bundle.outputs.wif, "91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx");
  assert.equal(bundle.outputs.nested, "2MuPEmnCFNGnbNKQkicF4VGhED2Kzo8GTYh");
  assert.equal(bundle.outputs.segwit, "tb1qjxeyh7049zzn99s2c6r6hvp4zfa362995t605y");
});
