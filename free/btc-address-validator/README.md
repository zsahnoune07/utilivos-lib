# BTC Address Validator

Browser-based Bitcoin address validation plugin for the Utilivos host app. It validates Bitcoin addresses and WIF keys locally and exposes their decoded network, payload, checksum, and script details.

## What it does

- Validates Base58Check addresses, WIF keys, and Bech32/Bech32m SegWit addresses.
- Reports network, encoding, payload, checksum state, and inferred scriptPubKey.
- Preserves the in-progress validation session through `UtilivosRuntime.syncState` and stores the last input locally through the declared `storage` permission.

## Main features

- Mainnet, testnet, and regtest SegWit recognition
- P2PKH, P2SH, WIF, P2WPKH, P2WSH, and P2TR validation coverage
- Local-only checksum and payload diagnostics
- Host-aligned session restore and storage-backed last-input persistence

## Security notes

- All validation runs locally.
- Validation proves format and checksum, not spendability or ownership.
- Do not use production wallet secrets in untrusted environments.

## Development

```bash
utilivos verify
utilivos test
utilivos build
```

Runtime sources live under `tool/`. Shared host styles stay in `tool/utilivos/`, plugin-specific styling stays in `tool/style.css`, and tests live under `tests/`.
