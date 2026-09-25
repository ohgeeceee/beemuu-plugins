# Contributing to the Beemuu Plugin Marketplace

## Submitting a plugin

1. **Fork** this repository.
2. Copy `plugins/_template.json` → `plugins/<your-plugin-id>.json`.
   - The id must be lowercase kebab-case and match the filename.
   - Pick the closest category: `diagnostics`, `coding`, `reporting`, `data`, `ui`, `tools`.
3. **Host your package.** Recommended: create a GitHub Release in your own
   plugin repo and attach the zip. Use that asset URL in `download.url`.
4. Get the checksum: `sha256sum your-plugin.zip` → `download.sha256`.
5. Validate and regenerate the registry:
   ```bash
   python3 tools/validate.py
   python3 tools/build_registry.py
   ```
6. Commit both your manifest and the regenerated `registry.json`, then open a
   PR using the plugin submission template.

## Rules

- One plugin per PR.
- HTTPS download URLs only, pointing at a permanent release asset.
- Declare all `capabilities` honestly. Anything with `coding-write` or
  `ecu-flash` gets a manual safety review before merge — this code can touch
  real vehicle hardware.
- No malware, no telemetry beacons, no phone-home without disclosure.
- Malicious or unsafe plugins can be removed at maintainer discretion.

## Updating your plugin

Open a PR editing your existing manifest: bump `version`, update
`download.url`/`sha256`, regenerate `registry.json`. Same review flow.

## Removing your plugin

Open a PR deleting your manifest and regenerating the registry, or file an
issue asking a maintainer to do it.
