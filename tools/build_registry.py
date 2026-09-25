#!/usr/bin/env python3
"""Build registry.json from plugins/ + official/ manifests (stdlib-only).

Usage: python3 tools/build_registry.py
"""
import datetime
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "registry.json")


def main():
    import validate
    manifests = validate.main()  # exits non-zero if anything is invalid
    registry = {
        "schemaVersion": 1,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "plugins": sorted(manifests, key=lambda m: m["id"]),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)
        f.write("\n")
    print(f"Wrote {OUT} with {len(manifests)} plugin(s).")


if __name__ == "__main__":
    main()
