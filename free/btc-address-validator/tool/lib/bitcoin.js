export const STORAGE_KEY = "utilivos.btc-address-validator.v1";
export const STORAGE_SNAPSHOT_VERSION = 1;
export const SESSION_SNAPSHOT_VERSION = 1;

export const STEP_IDS = [
  "step0",
  "step1",
  "step2",
  "step3",
  "step4",
  "step5",
  "step6",
  "step7",
  "step8",
  "step9"
];

const OUTPUT_IDS = ["wif", "nested", "segwit", "legacyScript", "segwitScript"];
const VALIDATOR_FIELD_IDS = [
  "status",
  "encoding",
  "network",
  "type",
  "payload",
  "checksum",
  "details",
  "scriptPubKey"
];

const SECP256K1 = {
  p: BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F"),
  n: BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"),
  gx: BigInt("0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798"),
  gy: BigInt("0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8")
};

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP = Object.create(null);
for (let index = 0; index < BASE58_ALPHABET.length; index += 1) {
  BASE58_MAP[BASE58_ALPHABET[index]] = index;
}

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_MAP = Object.create(null);
for (let index = 0; index < BECH32_CHARSET.length; index += 1) {
  BECH32_MAP[BECH32_CHARSET[index]] = index;
}

const BECH32_CONST = {
  bech32: 1,
  bech32m: 0x2bc830a3
};

const RIPEMD_R1 = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
  3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
  1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
  4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
];

const RIPEMD_R2 = [
  5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
  6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
  15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
  8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
  12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
];

const RIPEMD_S1 = [
  11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
  7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
  11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
  11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
  9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
];

const RIPEMD_S2 = [
  8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
  9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
  9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
  15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
  8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
];

function clampString(value, limit = 512) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function sanitizeTone(value) {
  return value === "success" || value === "error" ? value : "";
}

function sanitizeMessage(rawValue) {
  return {
    text: clampString(rawValue?.text, 1024),
    tone: sanitizeTone(rawValue?.tone)
  };
}

function sanitizeAddressInput(value) {
  return clampString(String(value ?? "").trim(), 128);
}

function sanitizeBuilderSteps(rawValue) {
  const steps = createEmptyBuilderSteps();
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};

  for (const stepId of STEP_IDS) {
    steps[stepId] = clampString(source[stepId], 256);
  }

  return steps;
}

function sanitizeBuilderOutputs(rawValue) {
  const outputs = createEmptyBuilderOutputs();
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};

  for (const outputId of OUTPUT_IDS) {
    outputs[outputId] = clampString(source[outputId], 256);
  }

  return outputs;
}

function sanitizeValidatorFields(rawValue) {
  const fields = createEmptyValidatorFields();
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};

  for (const fieldId of VALIDATOR_FIELD_IDS) {
    fields[fieldId] = clampString(source[fieldId], 1024);
  }

  return fields;
}

function token(key, values = undefined) {
  return values ? { key, values } : { key };
}

function normalizeNetwork(value) {
  return value === "testnet" ? "testnet" : "mainnet";
}

function normalizeCompressed(value) {
  return value !== false;
}

function normalizeBuilderSource(rawValue) {
  return rawValue?.builder && typeof rawValue.builder === "object" ? rawValue.builder : rawValue;
}

function normalizeValidatorSource(rawValue) {
  return rawValue?.validator && typeof rawValue.validator === "object" ? rawValue.validator : rawValue;
}

function getCrypto(host = globalThis) {
  return host?.crypto ?? globalThis.crypto ?? null;
}

function getSubtle(host = globalThis) {
  return getCrypto(host)?.subtle ?? null;
}

export class BitcoinError extends Error {
  constructor(key, values = null, fallback = null) {
    super(typeof fallback === "string" && fallback ? fallback : key);
    this.name = "BitcoinError";
    this.key = key;
    this.values = values;
  }
}

function makeError(key, values = null, fallback = null) {
  return new BitcoinError(key, values, fallback);
}

export function isBitcoinError(error) {
  return error instanceof BitcoinError || Boolean(error && typeof error.key === "string");
}

export function sanitizeHex(value) {
  return clampString(String(value ?? ""), 80)
    .replace(/^0x/i, "")
    .replace(/[^a-fA-F0-9]/g, "")
    .toUpperCase();
}

export function sanitizeBuilderPreferences(rawValue) {
  const source = normalizeBuilderSource(rawValue) ?? {};

  return {
    privateKey: sanitizeHex(source.privateKey),
    network: normalizeNetwork(source.network),
    compressed: normalizeCompressed(source.compressed)
  };
}

export function createEmptyBuilderSteps() {
  return STEP_IDS.reduce((accumulator, stepId) => {
    accumulator[stepId] = "";
    return accumulator;
  }, {});
}

export function createEmptyBuilderOutputs() {
  return OUTPUT_IDS.reduce((accumulator, outputId) => {
    accumulator[outputId] = "";
    return accumulator;
  }, {});
}

export function createEmptyValidatorFields() {
  return VALIDATOR_FIELD_IDS.reduce((accumulator, fieldId) => {
    accumulator[fieldId] = "";
    return accumulator;
  }, {});
}

export function createEmptyToolState() {
  return {
    builder: {
      privateKey: "",
      network: "mainnet",
      compressed: true,
      steps: createEmptyBuilderSteps(),
      outputs: createEmptyBuilderOutputs(),
      message: sanitizeMessage()
    },
    validator: {
      addressInput: "",
      fields: createEmptyValidatorFields(),
      message: sanitizeMessage()
    }
  };
}

export function sanitizeStorageState(rawValue) {
  const builder = normalizeBuilderSource(rawValue) ?? {};
  const validator = normalizeValidatorSource(rawValue) ?? {};

  return {
    v: STORAGE_SNAPSHOT_VERSION,
    builder: {
      network: normalizeNetwork(builder.network),
      compressed: normalizeCompressed(builder.compressed)
    },
    validator: {
      addressInput: sanitizeAddressInput(validator.addressInput)
    }
  };
}

export function buildStorageSnapshot(state) {
  return sanitizeStorageState(state);
}

export function sanitizeSessionSnapshot(rawValue) {
  const emptyState = createEmptyToolState();
  if (!rawValue || typeof rawValue !== "object") {
    return emptyState;
  }

  const builder = normalizeBuilderSource(rawValue) ?? {};
  const validator = normalizeValidatorSource(rawValue) ?? {};

  return {
    builder: {
      ...sanitizeBuilderPreferences(builder),
      steps: sanitizeBuilderSteps(builder.steps),
      outputs: sanitizeBuilderOutputs(builder.outputs),
      message: sanitizeMessage(builder.message)
    },
    validator: {
      addressInput: sanitizeAddressInput(validator.addressInput),
      fields: sanitizeValidatorFields(validator.fields),
      message: sanitizeMessage(validator.message)
    }
  };
}

export function buildSessionSnapshot(state) {
  return {
    v: SESSION_SNAPSHOT_VERSION,
    ...sanitizeSessionSnapshot(state)
  };
}

export function parsePrivateKey(rawValue) {
  const normalized = sanitizeHex(rawValue);
  if (!/^[0-9A-F]{64}$/.test(normalized)) {
    throw makeError("errors.privateKeyLength");
  }

  const asBigInt = BigInt(`0x${normalized}`);
  if (asBigInt <= 0n || asBigInt >= SECP256K1.n) {
    throw makeError("errors.privateKeyRange");
  }

  return {
    hex: normalized,
    bytes: hexToBytes(normalized),
    value: asBigInt
  };
}

export function generateRandomPrivateKeyHex(host = globalThis) {
  const crypto = getCrypto(host);
  if (!crypto || typeof crypto.getRandomValues !== "function") {
    throw makeError("errors.randomUnavailable");
  }

  const bytes = new Uint8Array(32);
  let value = 0n;

  do {
    crypto.getRandomValues(bytes);
    value = bytesToBigInt(bytes);
  } while (value === 0n || value >= SECP256K1.n);

  return bytesToHex(bytes).toUpperCase();
}

export async function buildAddressBundle(privateKeyInput, config = {}, host = globalThis) {
  const privateKey =
    privateKeyInput &&
    typeof privateKeyInput === "object" &&
    privateKeyInput.bytes instanceof Uint8Array &&
    typeof privateKeyInput.value === "bigint"
      ? privateKeyInput
      : parsePrivateKey(privateKeyInput);

  const network = normalizeNetwork(config.network);
  const compressed = normalizeCompressed(config.compressed);
  const networkByte = network === "mainnet" ? 0x00 : 0x6f;
  const wifPrefix = network === "mainnet" ? 0x80 : 0xef;
  const p2shPrefix = network === "mainnet" ? 0x05 : 0xc4;
  const hrp = network === "mainnet" ? "bc" : "tb";

  const publicKey = publicKeyFromPrivate(privateKey.value, compressed);
  const step2Bytes = await sha256(publicKey, host);
  const step3Bytes = ripemd160(step2Bytes);
  const step4Bytes = concatBytes(Uint8Array.of(networkByte), step3Bytes);
  const step5Bytes = await sha256(step4Bytes, host);
  const step6Bytes = await sha256(step5Bytes, host);
  const checksum = step6Bytes.slice(0, 4);
  const step8Bytes = concatBytes(step4Bytes, checksum);
  const legacyAddress = base58Encode(step8Bytes);

  const wifPayload = compressed
    ? concatBytes(Uint8Array.of(wifPrefix), privateKey.bytes, Uint8Array.of(0x01))
    : concatBytes(Uint8Array.of(wifPrefix), privateKey.bytes);
  const wif = await base58CheckEncode(wifPayload, host);

  const redeemScript = concatBytes(Uint8Array.of(0x00, 0x14), step3Bytes);
  const redeemHash = await hash160(redeemScript, host);
  const nested = await base58CheckEncode(concatBytes(Uint8Array.of(p2shPrefix), redeemHash), host);

  const witnessData = convertBits(step3Bytes, 8, 5, true);
  if (!witnessData) {
    throw makeError("errors.witnessData");
  }

  const segwit = bech32Encode(hrp, [0, ...witnessData], "bech32");
  const step3Hex = bytesToHex(step3Bytes).toUpperCase();

  return {
    steps: {
      step0: privateKey.hex,
      step1: bytesToHex(publicKey).toUpperCase(),
      step2: bytesToHex(step2Bytes).toUpperCase(),
      step3: step3Hex,
      step4: bytesToHex(step4Bytes).toUpperCase(),
      step5: bytesToHex(step5Bytes).toUpperCase(),
      step6: bytesToHex(step6Bytes).toUpperCase(),
      step7: bytesToHex(checksum).toUpperCase(),
      step8: bytesToHex(step8Bytes).toUpperCase(),
      step9: legacyAddress
    },
    outputs: {
      wif,
      nested,
      segwit,
      legacyScript: `76A914${step3Hex}88AC`,
      segwitScript: `0014${step3Hex}`
    }
  };
}

export async function validateBitcoinInput(input, host = globalThis) {
  const text = sanitizeAddressInput(input);
  const lower = text.toLowerCase();
  const looksLikeSegwit =
    lower.startsWith("bc1") || lower.startsWith("tb1") || lower.startsWith("bcrt1");

  if (looksLikeSegwit) {
    return parseSegwitAddress(text);
  }

  try {
    return await parseBase58CheckValue(text, host);
  } catch (base58Error) {
    try {
      return parseSegwitAddress(text);
    } catch {
      throw base58Error;
    }
  }
}

async function parseBase58CheckValue(text, host) {
  const { payload, checksum, expectedChecksum } = await base58CheckDecode(text, host);
  const details = classifyBase58Payload(payload);

  return {
    status: token("validator.report.status.valid"),
    encoding: token("validator.report.encoding.base58check"),
    network: details.network,
    type: details.type,
    payload: details.payload,
    checksum: token("validator.report.checksum.base58", {
      checksum: bytesToHex(checksum).toUpperCase(),
      expected: bytesToHex(expectedChecksum).toUpperCase()
    }),
    details: details.details,
    scriptPubKey: details.scriptPubKey
  };
}

function classifyBase58Payload(payload) {
  if (payload.length < 2) {
    throw makeError("errors.base58PayloadShort");
  }

  const version = payload[0];
  const body = payload.slice(1);
  const versionHex = `0x${version.toString(16).padStart(2, "0").toUpperCase()}`;

  if (payload.length === 21) {
    const hashHex = bytesToHex(body).toUpperCase();

    if (version === 0x00 || version === 0x6f) {
      return {
        network: token(
          version === 0x00
            ? "validator.report.networks.mainnet"
            : "validator.report.networks.testnet"
        ),
        type: token("validator.report.types.p2pkh"),
        payload: hashHex,
        details: token("validator.report.details.base58Hash", { version: versionHex }),
        scriptPubKey: `76A914${hashHex}88AC`
      };
    }

    if (version === 0x05 || version === 0xc4) {
      return {
        network: token(
          version === 0x05
            ? "validator.report.networks.mainnet"
            : "validator.report.networks.testnet"
        ),
        type: token("validator.report.types.p2sh"),
        payload: hashHex,
        details: token("validator.report.details.base58ScriptHash", { version: versionHex }),
        scriptPubKey: `A914${hashHex}87`
      };
    }

    return {
      network: token("validator.report.networks.unknown"),
      type: token("validator.report.types.unknownBase58"),
      payload: hashHex,
      details: token("validator.report.details.base58UnknownVersion", { version: versionHex }),
      scriptPubKey: ""
    };
  }

  if (version === 0x80 || version === 0xef) {
    if (payload.length !== 33 && payload.length !== 34) {
      throw makeError("errors.wifLength");
    }

    const compressed = payload.length === 34;
    if (compressed && payload[33] !== 0x01) {
      throw makeError("errors.wifCompressionMarker");
    }

    const keyBytes = compressed ? payload.slice(1, 33) : payload.slice(1);
    return {
      network: token(
        version === 0x80 ? "validator.report.networks.mainnet" : "validator.report.networks.testnet"
      ),
      type: token(
        compressed
          ? "validator.report.types.wifCompressed"
          : "validator.report.types.wifUncompressed"
      ),
      payload: bytesToHex(keyBytes).toUpperCase(),
      details: token("validator.report.details.wif", {
        version: versionHex,
        length: compressed ? 33 : 32
      }),
      scriptPubKey: ""
    };
  }

  return {
    network: token("validator.report.networks.unknown"),
    type: token("validator.report.types.unknownBase58"),
    payload: bytesToHex(body).toUpperCase(),
    details: token("validator.report.details.base58UnknownPayload", {
      version: versionHex,
      length: body.length
    }),
    scriptPubKey: ""
  };
}

function parseSegwitAddress(address) {
  const decoded = bech32Decode(address);
  if (decoded.data.length === 0) {
    throw makeError("errors.segwitMissingVersion");
  }

  const witnessVersion = decoded.data[0];
  if (witnessVersion < 0 || witnessVersion > 16) {
    throw makeError("errors.witnessVersionRange");
  }

  const witnessProgram = convertBits(decoded.data.slice(1), 5, 8, false);
  if (!witnessProgram) {
    throw makeError("errors.segwitPadding");
  }

  const program = Uint8Array.from(witnessProgram);
  if (program.length < 2 || program.length > 40) {
    throw makeError("errors.witnessProgramLength");
  }

  if (witnessVersion === 0) {
    if (decoded.encoding !== "bech32") {
      throw makeError("errors.witnessV0Encoding");
    }
    if (program.length !== 20 && program.length !== 32) {
      throw makeError("errors.witnessV0ProgramLength");
    }
  } else if (decoded.encoding !== "bech32m") {
    throw makeError("errors.witnessV1Encoding");
  }

  const network =
    decoded.hrp === "bc"
      ? token("validator.report.networks.mainnet")
      : decoded.hrp === "tb"
        ? token("validator.report.networks.testnet")
        : decoded.hrp === "bcrt"
          ? token("validator.report.networks.regtest")
          : token("validator.report.networks.unknownHrp", { hrp: decoded.hrp });

  return {
    status: token("validator.report.status.valid"),
    encoding: token(
      decoded.encoding === "bech32"
        ? "validator.report.encoding.bech32"
        : "validator.report.encoding.bech32m"
    ),
    network,
    type: identifyWitnessType(witnessVersion, program.length),
    payload: bytesToHex(program).toUpperCase(),
    checksum: token("validator.report.checksum.embedded"),
    details: token("validator.report.details.segwit", {
      hrp: decoded.hrp,
      version: witnessVersion,
      length: program.length
    }),
    scriptPubKey: witnessScriptPubKey(witnessVersion, program)
  };
}

function identifyWitnessType(version, programLength) {
  if (version === 0 && programLength === 20) {
    return token("validator.report.types.p2wpkh");
  }
  if (version === 0 && programLength === 32) {
    return token("validator.report.types.p2wsh");
  }
  if (version === 1 && programLength === 32) {
    return token("validator.report.types.p2tr");
  }
  return token("validator.report.types.witness", { version });
}

function witnessScriptPubKey(version, program) {
  const opcode = version === 0 ? 0x00 : 0x50 + version;
  return bytesToHex(concatBytes(Uint8Array.of(opcode, program.length), program)).toUpperCase();
}

function mod(a, m) {
  const result = a % m;
  return result >= 0n ? result : result + m;
}

function modInverse(value, modulo) {
  let tValue = 0n;
  let newTValue = 1n;
  let rValue = modulo;
  let newRValue = mod(value, modulo);

  while (newRValue !== 0n) {
    const quotient = rValue / newRValue;

    const tempT = tValue - quotient * newTValue;
    tValue = newTValue;
    newTValue = tempT;

    const tempR = rValue - quotient * newRValue;
    rValue = newRValue;
    newRValue = tempR;
  }

  if (rValue !== 1n) {
    throw makeError("errors.modInverse");
  }

  return tValue < 0n ? tValue + modulo : tValue;
}

function pointDouble(point) {
  if (!point || point.y === 0n) {
    return null;
  }

  const slope = mod(
    3n * point.x * point.x * modInverse(2n * point.y, SECP256K1.p),
    SECP256K1.p
  );
  const x = mod(slope * slope - 2n * point.x, SECP256K1.p);
  const y = mod(slope * (point.x - x) - point.y, SECP256K1.p);

  return { x, y };
}

function pointAdd(a, b) {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  if (a.x === b.x) {
    if (mod(a.y + b.y, SECP256K1.p) === 0n) {
      return null;
    }
    return pointDouble(a);
  }

  const slope = mod((b.y - a.y) * modInverse(b.x - a.x, SECP256K1.p), SECP256K1.p);
  const x = mod(slope * slope - a.x - b.x, SECP256K1.p);
  const y = mod(slope * (a.x - x) - a.y, SECP256K1.p);

  return { x, y };
}

function scalarMultiply(scalar) {
  if (scalar <= 0n || scalar >= SECP256K1.n) {
    throw makeError("errors.scalarRange");
  }

  let result = null;
  let addend = { x: SECP256K1.gx, y: SECP256K1.gy };
  let k = scalar;

  while (k > 0n) {
    if ((k & 1n) === 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointDouble(addend);
    k >>= 1n;
  }

  if (!result) {
    throw makeError("errors.publicKeyDerivation");
  }

  return result;
}

export function publicKeyFromPrivate(privateKey, compressed = true) {
  const point = scalarMultiply(privateKey);
  const x = bigIntToBytes(point.x, 32);
  const y = bigIntToBytes(point.y, 32);

  if (compressed) {
    return concatBytes(Uint8Array.of(point.y % 2n === 0n ? 0x02 : 0x03), x);
  }

  return concatBytes(Uint8Array.of(0x04), x, y);
}

async function sha256(bytes, host = globalThis) {
  const subtle = getSubtle(host);
  if (!subtle || typeof subtle.digest !== "function") {
    throw makeError("errors.cryptoUnavailable");
  }

  const digest = await subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

async function hash160(bytes, host = globalThis) {
  return ripemd160(await sha256(bytes, host));
}

async function checksum4(bytes, host = globalThis) {
  const first = await sha256(bytes, host);
  const second = await sha256(first, host);
  return second.slice(0, 4);
}

async function base58CheckEncode(payload, host = globalThis) {
  const checksum = await checksum4(payload, host);
  return base58Encode(concatBytes(payload, checksum));
}

async function base58CheckDecode(text, host = globalThis) {
  const decoded = base58Decode(text);
  if (decoded.length < 5) {
    throw makeError("errors.base58CheckShort");
  }

  const payload = decoded.slice(0, decoded.length - 4);
  const checksum = decoded.slice(decoded.length - 4);
  const expectedChecksum = await checksum4(payload, host);

  if (!equalBytes(checksum, expectedChecksum)) {
    throw makeError("errors.base58Checksum", {
      got: bytesToHex(checksum).toUpperCase(),
      expected: bytesToHex(expectedChecksum).toUpperCase()
    });
  }

  return { payload, checksum, expectedChecksum };
}

function base58Encode(bytes) {
  if (bytes.length === 0) {
    return "";
  }

  let value = bytesToBigInt(bytes);
  let encoded = "";

  while (value > 0n) {
    const remainder = Number(value % 58n);
    value /= 58n;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }

  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) {
    leadingZeroes += 1;
  }

  if (leadingZeroes > 0) {
    encoded = "1".repeat(leadingZeroes) + encoded;
  }

  return encoded || "1";
}

function base58Decode(text) {
  if (!text) {
    throw makeError("errors.base58Empty");
  }

  let value = 0n;
  for (const character of text) {
    const digit = BASE58_MAP[character];
    if (digit === undefined) {
      throw makeError("errors.base58Character", { char: character });
    }
    value = value * 58n + BigInt(digit);
  }

  const reversed = [];
  while (value > 0n) {
    reversed.push(Number(value & 0xffn));
    value >>= 8n;
  }
  reversed.reverse();

  let leadingOnes = 0;
  while (leadingOnes < text.length && text[leadingOnes] === "1") {
    leadingOnes += 1;
  }

  const output = new Uint8Array(leadingOnes + reversed.length);
  output.set(reversed, leadingOnes);
  return output;
}

function bech32Polymod(values) {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;

  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;

    for (let index = 0; index < 5; index += 1) {
      if ((top >>> index) & 1) {
        checksum ^= generators[index];
      }
    }
  }

  return checksum >>> 0;
}

function bech32HrpExpand(hrp) {
  const expanded = [];

  for (let index = 0; index < hrp.length; index += 1) {
    expanded.push(hrp.charCodeAt(index) >> 5);
  }

  expanded.push(0);

  for (let index = 0; index < hrp.length; index += 1) {
    expanded.push(hrp.charCodeAt(index) & 31);
  }

  return expanded;
}

function bech32CreateChecksum(hrp, data, encoding) {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ BECH32_CONST[encoding];
  const checksum = [];

  for (let index = 0; index < 6; index += 1) {
    checksum.push((polymod >>> (5 * (5 - index))) & 31);
  }

  return checksum;
}

function bech32VerifyChecksum(hrp, data) {
  const value = bech32Polymod([...bech32HrpExpand(hrp), ...data]);
  if (value === BECH32_CONST.bech32) {
    return "bech32";
  }
  if (value === BECH32_CONST.bech32m) {
    return "bech32m";
  }
  return null;
}

function bech32Encode(hrp, data, encoding) {
  const checksum = bech32CreateChecksum(hrp, data, encoding);
  const words = [...data, ...checksum];
  let output = `${hrp}1`;

  for (const word of words) {
    output += BECH32_CHARSET[word];
  }

  return output;
}

function bech32Decode(value) {
  if (value.length < 8 || value.length > 90) {
    throw makeError("errors.bech32Length");
  }

  let lower = false;
  let upper = false;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 33 || code > 126) {
      throw makeError("errors.bech32Characters");
    }
    if (code >= 97 && code <= 122) {
      lower = true;
    }
    if (code >= 65 && code <= 90) {
      upper = true;
    }
  }

  if (lower && upper) {
    throw makeError("errors.bech32Case");
  }

  const normalized = value.toLowerCase();
  const separator = normalized.lastIndexOf("1");
  if (separator < 1 || separator + 7 > normalized.length) {
    throw makeError("errors.bech32Separator");
  }

  const hrp = normalized.slice(0, separator);
  const data = [];

  for (let index = separator + 1; index < normalized.length; index += 1) {
    const character = normalized[index];
    const mapped = BECH32_MAP[character];
    if (mapped === undefined) {
      throw makeError("errors.bech32Character", { char: character });
    }
    data.push(mapped);
  }

  const encoding = bech32VerifyChecksum(hrp, data);
  if (!encoding) {
    throw makeError("errors.bech32Checksum");
  }

  return {
    hrp,
    data: data.slice(0, -6),
    encoding
  };
}

function convertBits(data, fromBits, toBits, pad) {
  let accumulator = 0;
  let bits = 0;
  const output = [];
  const maxValue = (1 << toBits) - 1;
  const maxAccumulator = (1 << (fromBits + toBits - 1)) - 1;

  for (const value of data) {
    if (value < 0 || (value >> fromBits) !== 0) {
      return null;
    }

    accumulator = ((accumulator << fromBits) | value) & maxAccumulator;
    bits += fromBits;

    while (bits >= toBits) {
      bits -= toBits;
      output.push((accumulator >> bits) & maxValue);
    }
  }

  if (pad) {
    if (bits > 0) {
      output.push((accumulator << (toBits - bits)) & maxValue);
    }
  } else {
    if (bits >= fromBits) {
      return null;
    }
    if (((accumulator << (toBits - bits)) & maxValue) !== 0) {
      return null;
    }
  }

  return output;
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    throw makeError("errors.hexEvenLength");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    const parsed = Number.parseInt(hex.slice(index, index + 2), 16);
    if (Number.isNaN(parsed)) {
      throw makeError("errors.hexInvalid");
    }
    bytes[index / 2] = parsed;
  }

  return bytes;
}

function bytesToHex(bytes) {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function concatBytes(...parts) {
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function bytesToBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return value;
}

function bigIntToBytes(value, size) {
  let remaining = value;
  const output = new Uint8Array(size);

  for (let index = size - 1; index >= 0; index -= 1) {
    output[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  if (remaining !== 0n) {
    throw makeError("errors.integerSize");
  }

  return output;
}

function equalBytes(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a[index] ^ b[index];
  }

  return mismatch === 0;
}

function rotl32(value, shift) {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function add32(...values) {
  let total = 0;
  for (const value of values) {
    total = (total + value) >>> 0;
  }
  return total;
}

function fLeft(index, x, y, z) {
  if (index <= 15) {
    return (x ^ y ^ z) >>> 0;
  }
  if (index <= 31) {
    return ((x & y) | (~x & z)) >>> 0;
  }
  if (index <= 47) {
    return ((x | ~y) ^ z) >>> 0;
  }
  if (index <= 63) {
    return ((x & z) | (y & ~z)) >>> 0;
  }
  return (x ^ (y | ~z)) >>> 0;
}

function fRight(index, x, y, z) {
  if (index <= 15) {
    return (x ^ (y | ~z)) >>> 0;
  }
  if (index <= 31) {
    return ((x & z) | (y & ~z)) >>> 0;
  }
  if (index <= 47) {
    return ((x | ~y) ^ z) >>> 0;
  }
  if (index <= 63) {
    return ((x & y) | (~x & z)) >>> 0;
  }
  return (x ^ y ^ z) >>> 0;
}

function kLeft(index) {
  if (index <= 15) {
    return 0x00000000;
  }
  if (index <= 31) {
    return 0x5a827999;
  }
  if (index <= 47) {
    return 0x6ed9eba1;
  }
  if (index <= 63) {
    return 0x8f1bbcdc;
  }
  return 0xa953fd4e;
}

function kRight(index) {
  if (index <= 15) {
    return 0x50a28be6;
  }
  if (index <= 31) {
    return 0x5c4dd124;
  }
  if (index <= 47) {
    return 0x6d703ef3;
  }
  if (index <= 63) {
    return 0x7a6d76e9;
  }
  return 0x00000000;
}

function ripemd160(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const bitLength = BigInt(bytes.length) * 8n;
  const paddingLength = ((56 - ((bytes.length + 1) % 64)) + 64) % 64;
  const totalLength = bytes.length + 1 + paddingLength + 8;

  const padded = new Uint8Array(totalLength);
  padded.set(bytes, 0);
  padded[bytes.length] = 0x80;

  let mutableLength = bitLength;
  for (let index = 0; index < 8; index += 1) {
    padded[totalLength - 8 + index] = Number(mutableLength & 0xffn);
    mutableLength >>= 8n;
  }

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(16);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const wordIndex = offset + index * 4;
      words[index] = (
        padded[wordIndex] |
        (padded[wordIndex + 1] << 8) |
        (padded[wordIndex + 2] << 16) |
        (padded[wordIndex + 3] << 24)
      ) >>> 0;
    }

    let al = h0;
    let bl = h1;
    let cl = h2;
    let dl = h3;
    let el = h4;
    let ar = h0;
    let br = h1;
    let cr = h2;
    let dr = h3;
    let er = h4;

    for (let index = 0; index < 80; index += 1) {
      const tl = add32(
        rotl32(add32(al, fLeft(index, bl, cl, dl), words[RIPEMD_R1[index]], kLeft(index)), RIPEMD_S1[index]),
        el
      );
      al = el;
      el = dl;
      dl = rotl32(cl, 10);
      cl = bl;
      bl = tl;

      const tr = add32(
        rotl32(add32(ar, fRight(index, br, cr, dr), words[RIPEMD_R2[index]], kRight(index)), RIPEMD_S2[index]),
        er
      );
      ar = er;
      er = dr;
      dr = rotl32(cr, 10);
      cr = br;
      br = tr;
    }

    const temp = add32(h1, cl, dr);
    h1 = add32(h2, dl, er);
    h2 = add32(h3, el, ar);
    h3 = add32(h4, al, br);
    h4 = add32(h0, bl, cr);
    h0 = temp;
  }

  const output = new Uint8Array(20);
  writeUint32LE(output, 0, h0);
  writeUint32LE(output, 4, h1);
  writeUint32LE(output, 8, h2);
  writeUint32LE(output, 12, h3);
  writeUint32LE(output, 16, h4);
  return output;
}

function writeUint32LE(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}
