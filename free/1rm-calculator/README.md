# 1RM calculator

Utilivo plugin that estimates **one-rep max (1RM)** from a submax set using three common formulas, with **kg / lb** input and host session restore.

## Formulas

| Name     | Expression (W = weight lifted, r = reps) |
|----------|----------------------------------------|
| Brzycki  | W × 36 ÷ (37 − r); if r = 1, 1RM = W  |
| Epley    | W × (1 + r ÷ 30)                       |
| Lombardi | W × r^0.10                             |

Reps are limited to **1–15** so estimates stay in a typical submax range and avoid Brzycki instability near very high rep counts.

## Quick start

```bash
cd utilivo-lib/free/1rm-calculator
utilivo verify
utilivo test
npm test
```

Maintainers run `utilivo build` after review to produce signed `.ubb` artifacts.

## Plugin details

- Slug: `1rm-calculator`
- Entry: `tool/index.html`
- Icon: `tool/assets/icon.png`
- Thumbnail: `tool/assets/thumb.png`
- Screenshots: `tool/assets/screenshots/home.png`

## Development

- UI strings live in `tool/locales/en.json`.
- Core math and validation: `tool/lib/one-rep-math.js`.
- Unit tests: `tests/one-rep-math.test.mjs`.

## Environment

See `.env.example` if you add runtime configuration later.
