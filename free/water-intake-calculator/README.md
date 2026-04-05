# Water Intake Calculator

Utilivo plugin that estimates a daily **fluid** target from weight (metric or imperial), optional sex-based ml/kg baseline, activity add-ons, climate, and pregnancy or breastfeeding adjustments.

## What this plugin does

- Computes a transparent breakdown (base from weight, plus activity, hot climate, and pregnancy or lactation where selected).
- Persists form state via the host bridge (`storage` permission) and `UtilivoRuntime.syncState` when available.
- Ships English copy under `tool/locales/en.json` and follows utilivo-ui primitives only.

## Main features

- Weight in kg or lb with unit toggle and validation (20–300 kg range).
- Activity tiers with fixed daily add-ons; temperate vs hot climate; optional pregnancy or breastfeeding bump.
- Results in ml/day, L/day, and approximate 8 oz cups and 250 ml glasses.
- Educational disclaimer throughout.

## Quick start

```bash
utilivo run
utilivo verify
utilivo test
npm test
utilivo build
```

## For AI and automated agents

- Run utilivo verify and utilivo test when useful to validate changes.
- Do not run utilivo build after implementing unless the user explicitly asks; the maintainer builds and reviews release artifacts.

## Plugin details

- Slug: water-intake-calculator
- Entry: tool/index.html
- Icon: tool/assets/icon.png
- Thumbnail: tool/assets/thumb.png
- Screenshots: tool/assets/screenshots/home.png

## Environment variables

See .env.example. Add project-specific values only when the plugin needs runtime configuration.

## Build and deploy

- Build a signed package with utilivo build.
- Ship the generated dist/<slug>-<version>.ubb artifact to the host app pipeline.
- Use build.ignore for source-only files that should stay out of the final .ubb payload.

## Assumptions

- Plugin runs in the Utilivo host bridge sandbox.
- Distribution target is a signed .ubb bundle.

## Development

Edit source files in tool/ and update manifest.json carefully.
Always consume design tokens from tool/utilivo/base.css and shared components from tool/utilivo/components.css.
Run utilivo run for a browser-based dev shell with live refresh and runtime metadata injection.
Store every user-facing string in tool/locales/*.json, even when the plugin only ships English.
