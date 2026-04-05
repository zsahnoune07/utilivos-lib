# QR Code Scanner

Scan QR codes inside the Utilivo mobile host using the device camera or a photo from the library.

## Behavior

- **Live scan:** `getUserMedia` video preview with throttled frame decoding via [jsQR](https://github.com/cozmo/jsQR) (vendored under `tool/vendor/jsQR.min.js`).
- **Library photo:** “Choose from library” uses `<input type="file" accept="image/*">` plus the host’s Android file-chooser hook (`image_picker`). Free tier consumes a **storage** action (`utilivo.recordStorageAction`) before opening the picker, per host policy.
- **Manifest permissions:** `storage`, `camera` (strings, SDK-compatible).
- **Session state:** Last decoded text is persisted with `UtilivoRuntime.syncState` when the host allows it.

## Quick start

```bash
utilivo verify
utilivo test
utilivo run
```

Maintainers run `utilivo build` after review to produce signed `.ubb` artifacts.

## Assets

Refresh `tool/assets/screenshots/home.png` after major UI changes so catalog previews stay accurate.

## Plugin details

- Slug: `qr-code-scanner`
- Entry: `tool/index.html`
- Locales: `tool/locales/en.json`

## Development

User-facing strings live in `tool/locales/`. Styling uses utilivo-ui tokens from `tool/utilivo/*.css` and `style.css` only—no hardcoded product palette.
