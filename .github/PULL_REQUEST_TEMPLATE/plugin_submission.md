## Plugin submission

- Plugin id: ``
- Plugin name:
- Download URL (must be https, durable — e.g. a GitHub Release asset):
- SHA-256 of the package:

### Checklist

- [ ] I copied `plugins/_template.json` to `plugins/<my-plugin-id>.json` and filled in every required field
- [ ] `python3 tools/validate.py` passes locally
- [ ] I ran `python3 tools/build_registry.py` and committed the updated `registry.json`
- [ ] My download URL is a permanent release asset (not a branch/latest link)
- [ ] I declared every capability my plugin uses honestly

### Safety

- [ ] My plugin does NOT write to an ECU (no coding-write / ecu-flash)

If your plugin writes to an ECU, explain exactly what it writes and what
safeguards exist. These submissions require manual maintainer review.
