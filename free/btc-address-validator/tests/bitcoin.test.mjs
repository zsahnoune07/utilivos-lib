import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAddressBundle,
  validateBitcoinInput
} from "../tool/lib/bitcoin.js";

const PRIVATE_KEY_ONE = "0000000000000000000000000000000000000000000000000000000000000001";

test("validates derived WIF, nested SegWit, and native SegWit outputs", async () => {
  const bundle = await buildAddressBundle(PRIVATE_KEY_ONE, {
    network: "mainnet",
    compressed: true
  });

  const wif = await validateBitcoinInput(bundle.outputs.wif);
  assert.equal(wif.network.key, "validator.report.networks.mainnet");
  assert.equal(wif.type.key, "validator.report.types.wifCompressed");

  const nested = await validateBitcoinInput(bundle.outputs.nested);
  assert.equal(nested.network.key, "validator.report.networks.mainnet");
  assert.equal(nested.type.key, "validator.report.types.p2sh");

  const segwit = await validateBitcoinInput(bundle.outputs.segwit);
  assert.equal(segwit.network.key, "validator.report.networks.mainnet");
  assert.equal(segwit.encoding.key, "validator.report.encoding.bech32");
  assert.equal(segwit.type.key, "validator.report.types.p2wpkh");
});

test("classifies representative mainnet Base58 addresses", async () => {
  const p2pkh = await validateBitcoinInput("1BoatSLRHtKNngkdXEeobR76b53LETtpyT");
  assert.equal(p2pkh.encoding.key, "validator.report.encoding.base58check");
  assert.equal(p2pkh.network.key, "validator.report.networks.mainnet");
  assert.equal(p2pkh.type.key, "validator.report.types.p2pkh");

  const p2sh = await validateBitcoinInput("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy");
  assert.equal(p2sh.network.key, "validator.report.networks.mainnet");
  assert.equal(p2sh.type.key, "validator.report.types.p2sh");
});

test("rejects invalid Base58 checksum data", async () => {
  await assert.rejects(
    validateBitcoinInput("1BoatSLRHtKNngkdXEeobR76b53LETtpyU"),
    (error) => error?.key === "errors.base58Checksum"
  );
});
