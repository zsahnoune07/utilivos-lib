# BTC Generator

Browser-based Bitcoin address generator plugin for the Utilivo host app. It derives Bitcoin address outputs from raw private keys locally and exposes the intermediate steps for inspection.

## What it does

- Builds legacy P2PKH addresses from a 32-byte private key with a full step-by-step derivation trace.
- Derives related outputs from the same key: WIF, nested SegWit (P2SH-P2WPKH), native SegWit (bech32), and script templates.
- Preserves in-progress builder sessions through `UtilivoRuntime.syncState` while keeping long-lived storage limited to non-sensitive preferences.

## Main features

- Mainnet and testnet support
- Compressed and uncompressed public key handling
- Full derivation trace from private key to Base58Check address
- WIF, nested SegWit, native SegWit, and scriptPubKey outputs
- Local-only crypto execution in the browser or host webview

## Security notes

- All derivation runs locally.
- Private keys are not written to long-lived plugin storage.
- Do not use production wallet secrets in untrusted environments.
- The tool is educational and diagnostic. It does not sign transactions or broadcast funds.

## Development

```bash
utilivo verify
utilivo test
utilivo build
```

Runtime sources live under `tool/`. Shared host styles stay in `tool/utilivo/`, plugin-specific styling stays in `tool/style.css`, and tests live under `tests/`.
