# NAFLD Fibrosis Score

Utilivo plugin: NAFLD Fibrosis Score (NFS) calculator with validation, live results, and optional storage persistence.

## What this plugin does
Estimates advanced fibrosis risk in NAFLD using the published NFS equation, with low / indeterminate / high bands and local-only persistence.

## Main features
- Manifest-driven runtime metadata
- utilivo-ui components and host design tokens
- Node tests for calculator and storage adapters

## Quick start

```bash
utilivo run
utilivo verify
utilivo test
utilivo build
```

## Plugin details
- Slug: nafld-fibrosis-score
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
