# Heart Rate Zones

Utilivo plugin that estimates five training heart rate zones from **age** and **resting heart rate** using the **Karvonen method** (heart rate reserve) and the common **max HR = 220 − age** estimate.

## Quick start

```bash
npm test
utilivo verify
utilivo test
```

## Plugin details

- Slug: heart-rate-zones
- Entry: tool/index.html
- Locales: `tool/locales/en.json`

## For maintainers

- Run `utilivo build` when ready to produce signed `.ubb` artifacts (not required for day-to-day development).
- See [AGENTS.md](AGENTS.md) for UI and localization rules.
