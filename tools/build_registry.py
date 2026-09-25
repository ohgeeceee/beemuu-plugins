#!/usr/bin/env python3
"""Build registry.json from plugins/ + official/ manifests (stdlib-only).

Usage: python3 tools/build_registry.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "registry.json")


def _load_existing_registry():
    try:
        with open(OUT, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def main():
    import validate
    manifests = validate.main()  # exits non-zero if anything is invalid
    plugins = sorted(manifests, key=lambda m: m["id"])
    existing = _load_existing_registry()
    generated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if existing and existing.get("schemaVersion") == 1 and existing.get("plugins") == plugins:
        generated_at = existing.get("generatedAt", generated_at)
    registry = {
        "schemaVersion": 1,
        "plugins": sorted(manifests, key=lambda m: m["id"]),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)
        f.write("\n")
    print(f"Wrote {OUT} with {len(manifests)} plugin(s).")


if __name__ == "__main__":
    main()
