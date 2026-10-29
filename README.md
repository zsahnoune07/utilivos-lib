# utilivos-lib

First-party plugin catalog for Utilivos.

This repository holds the source for Utilivos tools that ship as sandboxed WebView bundles (`.ubb`). The mobile app discovers them via the API, installs them locally, and runs them offline inside the host runtime.

## Layout

```text
utilivos-lib/
└── free/                 # free-tier plugins
    └── <plugin-slug>/
        ├── manifest.json
        ├── package.json
        ├── tool/         # HTML/CSS/JS + locales + assets
        ├── tests/
        └── README.md
```

Each plugin is a self-contained project scaffolded and packaged with [`utilivos-sdk`](https://github.com/zsahnoune07/utilivos-sdk).

## Free plugins

| Slug | Notes |
|------|--------|
| `1rm-calculator` | One-rep max estimator |
| `baby-growth` | Baby growth helpers |
| `bmi-calculator` | Adult BMI with metric/imperial input |
| `body-fat-estimator` | Body fat estimate |
| `btc-address-validator` | Bitcoin address / WIF validation |
| `btc-generator` | Bitcoin address derivation helpers |
| `fib4-calculator` | FIB-4 fibrosis index |
| `heart-rate-zones` | Karvonen training zones |
| `nafld-fibrosis-score` | NAFLD fibrosis score |
| `pace-converter` | Pace conversion |
| `pomodoro-timer` | Focus timer |
| `qr-code-scanner` | Camera / library QR decode |
| `water-intake-calculator` | Daily fluid target estimate |

## Plugin conventions

- Manifest-driven metadata (`manifest.json`) for slug, tier, category, permissions, and entry HTML
- UI built with the shared `tool/utilivos/` design-system kit (host-injected theme tokens)
- User-facing copy in `tool/locales/` (English default)
- Local/offline by default; host bridge APIs only when permissions are declared
- Deterministic `.ubb` packaging via `utilivos build` / `utilivos pack`

## Build a plugin

From a plugin directory (requires [`utilivos-sdk`](https://github.com/zsahnoune07/utilivos-sdk) on your `PATH`):

```bash
cd free/bmi-calculator
utilivos verify
utilivos test
utilivos build
```

Publish the resulting `.ubb` through the admin API / CLI (`utilivos-admin` or `utilivos-cli`).

## Related repos

- [utilivos-sdk](https://github.com/zsahnoune07/utilivos-sdk) — plugin scaffold, verify, test, pack, sign
- [utilivos-mobile](https://github.com/zsahnoune07/utilivos-mobile) — Flutter host that installs and runs bundles
- [utilivos-api](https://github.com/zsahnoune07/utilivos-api) — catalog, publish, and download API

## License

MIT — see [LICENSE](LICENSE).
