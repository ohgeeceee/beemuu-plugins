#!/usr/bin/env python3
"""Fail if the marketplace site would ship an inconsistent release surface.

Runs against a built artifact (default: _site). Checks the things a visitor
would notice and the things a plugin author would rely on:

  * index.html, registry.json, app-release.json and CNAME are all present
  * the release band, the strong tag and the release link all name ONE tag,
    and app-release.json agrees with it
  * the release link is on the app repository and points at that exact tag
  * registry.json parses, lists plugins, and every entry's download URL is
    absolute; the sha256 matches the local zip when one is shipped here
  * every plugin's minAppVersion is <= the stamped app version (a plugin that
    asks for a newer app than the one advertised would never install)

Usage: python3 tools/test_site_build.py [--site _site]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

SEMVER = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
BAND_RE = re.compile(r'data-app-tag="(v[0-9][^"]*)"')
VERSION_RE = re.compile(r'<strong id="app-release-version">(.*?)</strong>')
LINK_RE = re.compile(r'<a id="app-release-link" href="([^"]*)"')

failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        failures.append(msg)
    print(f"{'ok  ' if cond else 'FAIL'} {msg}")


def ver_tuple(tag: str) -> tuple[int, int, int]:
    m = SEMVER.match(tag)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else (0, 0, 0)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default="_site")
    args = ap.parse_args()
    site = Path(args.site).resolve()

    for name in ("index.html", "registry.json", "app-release.json", "CNAME"):
        check((site / name).is_file(), f"{name} is present in {site.name}/")
    if failures:
        print("\n".join(failures))
        print(f"FAILED: {len(failures)} problem(s)")
        return 1

    html = (site / "index.html").read_text()
    release = json.loads((site / "app-release.json").read_text())
    registry = json.loads((site / "registry.json").read_text())

    band = BAND_RE.search(html)
    strong = VERSION_RE.search(html)
    link = LINK_RE.search(html)
    check(band is not None, "index.html has the release band")
    check(strong is not None, "index.html has the release version element")
    check(link is not None, "index.html has the release link element")

    tag = release.get("tag", "")
    check(bool(SEMVER.match(tag)), f"app-release.json carries a release tag ({tag!r})")
    check(sorted(release) == ["app", "name", "releaseUrl", "releasedAt", "schemaVersion", "tag", "version"],
          "app-release.json has exactly the expected keys")
    check(release.get("version") == tag.lstrip("v"),
          "app-release.json version matches its tag")

    if band and strong and link:
        check(band.group(1) == tag, f"index.html band names {tag} (found {band.group(1)!r})")
        check(tag in strong.group(1), f"index.html strong names {tag} (found {strong.group(1)!r})")
        check(link.group(1).endswith(f"/releases/tag/{tag}"), "release link points at this tag")
        check("/beemuu/releases/" in link.group(1) and "/beemuu-plugins/" not in link.group(1),
              "release link points at the app repository, not this one")

    check((site / "CNAME").read_text().strip() == "plugins.beemuu.com", "CNAME is plugins.beemuu.com")
    check("registry.json" in html, "index.html fetches registry.json")
    check("app-release.json" in html, "index.html references app-release.json")

    plugins = registry.get("plugins") or []
    check(len(plugins) > 0, f"registry.json lists plugins ({len(plugins)})")
    app_ver = ver_tuple(tag)
    for p in plugins:
        pid = p.get("id", "<no id>")
        url = (p.get("download") or {}).get("url", "")
        check(url.startswith("https://"), f"{pid}: download URL is absolute")
        min_app = p.get("minAppVersion", "")
        check(bool(SEMVER.match("v" + str(min_app))), f"{pid}: minAppVersion is semver ({min_app!r})")
        check(ver_tuple("v" + str(min_app)) <= app_ver,
              f"{pid}: minAppVersion {min_app} <= released app {tag.lstrip('v')}")
        sha = (p.get("download") or {}).get("sha256", "")
        local = site / "dist" / url.rsplit("/", 1)[-1]
        if local.is_file():
            digest = hashlib.sha256(local.read_bytes()).hexdigest()
            check(digest == sha, f"{pid}: local {local.name} sha256 matches registry")

    if failures:
        print(f"\nFAILED: {len(failures)} problem(s)")
        return 1
    print("\nall site checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
