#!/usr/bin/env python3
"""Validate all plugin manifests against manifest.schema.json (stdlib-only).

Usage: python3 tools/validate.py
Exit code 0 = all valid, 1 = at least one failure.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA_PATH = os.path.join(ROOT, "manifest.schema.json")
MANIFEST_DIRS = ["plugins", "official"]
CATEGORIES = ["diagnostics", "coding", "reporting", "data", "ui", "tools"]
CAPABILITIES = ["read-vin", "read-dtc", "clear-dtc", "live-data",
                "coding-write", "ecu-flash", "network", "filesystem"]
REQUIRED = ["id", "name", "version", "author", "description",
            "category", "download", "minAppVersion", "license"]

SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")


def validate_manifest(path, errors):
    rel = os.path.relpath(path, ROOT)
    try:
        with open(path, encoding="utf-8") as f:
            m = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        errors.append(f"{rel}: invalid JSON: {e}")
        return None

    for field in REQUIRED:
        if field not in m:
            errors.append(f"{rel}: missing required field '{field}'")

    pid = m.get("id", "")
    expected = os.path.splitext(os.path.basename(path))[0]
    if not SLUG.match(pid):
        errors.append(f"{rel}: id '{pid}' is not a valid slug")
    if pid != expected:
        errors.append(f"{rel}: id '{pid}' must match filename '{expected}.json'")

    if not SEMVER.match(str(m.get("version", ""))):
        errors.append(f"{rel}: version must be semver X.Y.Z")
    if not SEMVER.match(str(m.get("minAppVersion", ""))):
        errors.append(f"{rel}: minAppVersion must be semver X.Y.Z")

    desc = str(m.get("description", ""))
    if not (10 <= len(desc) <= 300):
        errors.append(f"{rel}: description must be 10-300 chars (got {len(desc)})")

    if m.get("category") not in CATEGORIES:
        errors.append(f"{rel}: category must be one of {CATEGORIES}")

    dl = m.get("download", {})
    if not str(dl.get("url", "")).startswith("https://"):
        errors.append(f"{rel}: download.url must be https")
    if not SHA256.match(str(dl.get("sha256", ""))):
        errors.append(f"{rel}: download.sha256 must be 64 lowercase hex chars")

    for cap in m.get("capabilities", []):
        if cap not in CAPABILITIES:
            errors.append(f"{rel}: unknown capability '{cap}'")

    tags = m.get("tags", [])
    if len(tags) > 8:
        errors.append(f"{rel}: max 8 tags")

    is_official = os.path.dirname(path).endswith("official")
    if is_official and not m.get("official"):
        errors.append(f"{rel}: manifests in official/ must set \"official\": true")
    if not is_official and m.get("official"):
        errors.append(f"{rel}: community plugins may not set \"official\": true")

    return m


def main():
    errors = []
    seen_ids = {}
    manifests = []
    for d in MANIFEST_DIRS:
        dpath = os.path.join(ROOT, d)
        if not os.path.isdir(dpath):
            continue
        for name in sorted(os.listdir(dpath)):
            if not name.endswith(".json") or name.startswith("_"):
                continue
            m = validate_manifest(os.path.join(dpath, name), errors)
            if m is None:
                continue
            pid = m.get("id")
            if pid in seen_ids:
                errors.append(f"duplicate plugin id '{pid}' in {name} and {seen_ids[pid]}")
            seen_ids[pid] = name
            manifests.append(m)

    if errors:
        print("VALIDATION FAILED:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    print(f"OK: {len(manifests)} manifest(s) valid.")
    return manifests


if __name__ == "__main__":
    main()
