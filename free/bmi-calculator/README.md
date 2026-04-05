# BMI Calculator

Offline Utilivo adult wellness calculator for estimating body mass index with metric or imperial inputs. The tool keeps calculation, interpretation, and state restore inside the local WebView bundle.

## What it does

- Calculates BMI from either `cm/kg` or `ft/in + lb` inputs.
- Classifies the result using standard adult BMI categories.
- Shows a healthy-weight range for the entered height using BMI `18.5` to `24.9`.
- Restores the last local form state through the declared `storage` permission.

## Main features

- Dual-unit input with conversion when switching between metric and imperial
- Live validation and live recalculation once the active fields are valid
- Localized English copy in `tool/locales/en.json`
- Pure calculator and storage modules with Node-based tests under `tests/`
- Deterministic `.ubb` packaging through the Utilivo CLI

## Project structure

```text
bmi-calculator/
├── manifest.json
├── package.json
├── README.md
├── PLAN.md
├── AGENTS.md
├── tool/
│   ├── index.html
│   ├── main.js
│   ├── style.css
│   ├── lib/
│   │   ├── calculator.js
│   │   └── storage.js
│   ├── locales/
│   │   └── en.json
│   ├── utilivo/
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── layout.css
│   │   └── tool.js
│   └── assets/
├── tests/
└── dist/
```

## Development

```bash
utilivo verify
utilivo test
utilivo build
```

`utilivo test` runs the built-in manifest and structure checks plus `npm test`, which executes the Node test suite in `tests/*.test.mjs`.

## Build and package

`utilivo build` produces the signed bundle flow expected by the marketplace:

- `dist/bmi-calculator-1.0.0.ubb`
- `dist/bmi-calculator-1.0.0.sig`
- `dist/bmi-calculator-1.0.0.sha256`
- `dist/bmi-calculator-1.0.0.manifest.json`

Ship the generated `.ubb` artifact through the Utilivo host app pipeline or local bundle seeding workflow.

## Wellness positioning

- This tool is for adult wellness screening only.
- BMI is one input, not a diagnosis or a full assessment of health.
- The result should not be used for children, pregnancy, or specialized body-composition decisions.

## Assumptions

- The tool runs fully offline with no network calls or analytics.
- The Utilivo runtime may expose a storage bridge; when it is absent, the tool falls back safely to in-WebView local storage.
- Existing icon, thumb, and screenshot assets are retained as placeholders until product art is supplied.
