#!/usr/bin/env python3
"""Point plugins.beemuu.com at the current BeeEmUu release.

The marketplace site told visitors which plugin versions exist but never which
app release they belong to -- a visitor had no way to tell whether the plugins
here run on the app they just downloaded. This script reads the published
release from the app repository and stamps it into the two places the site
shows it:

  * app-release.json -- the machine-readable copy the page fetches at runtime
  * index.html       -- the no-JS fallback baked into the header band

Both are rewritten only when they differ, so re-running this script is a no-op
and the CI job that calls it produces no empty commit.

Usage:
    python3 tools/sync_app_release.py            # report only (default: --check)
    python3 tools/sync_app_release.py --write    # stamp the current release
    python3 tools/sync_app_release.py --tag v3.7.0 --write
    python3 tools/sync_app_release.py --repo ohgeeceee/beemuu --write

Exit codes: 0 = in sync or written, 1 = --check found drift, 2 = could not
resolve a release (network, no published release, malformed tag).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RELEASE_FILE = ROOT / "app-release.json"
INDEX_FILE = ROOT / "index.html"

SEMVER = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
BAND_RE = re.compile(r'(<p class="release" id="release-band" data-app-tag=")(v[0-9][^"]*)(")')
VERSION_RE = re.compile(r'(<strong id="app-release-version">)([^<]*)(</strong>)')
LINK_RE = re.compile(r'(<a id="app-release-link" href=")([^"]*)(")')


def api_get(url: str) -> dict:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "beemuu-plugins-sync"}
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def resolve_release(repo: str, tag: str | None) -> dict:
    if tag:
        release = api_get(f"https://api.github.com/repos/{repo}/releases/tags/{tag}")
    else:
        release = api_get(f"https://api.github.com/repos/{repo}/releases/latest")
    return release


def release_record(repo: str, release: dict) -> dict:
    tag = release.get("tag_name", "")
    if not SEMVER.match(tag):
        raise SystemExit(f"release tag {tag!r} is not a vX.Y.Z release tag")
    return {
        "schemaVersion": 1,
        "app": repo,
        "tag": tag,
        "version": tag.lstrip("v"),
        "name": release.get("name") or f"BeeEmUu {tag}",
        "releasedAt": release.get("published_at") or "",
        "releaseUrl": release.get("html_url") or f"https://github.com/{repo}/releases/tag/{tag}",
    }


def render_index(html: str, record: dict) -> str:
    tag = record["tag"]
    label = f'BeeEmUu {tag}'
    if not (BAND_RE.search(html) and VERSION_RE.search(html) and LINK_RE.search(html)):
        raise SystemExit("index.html is missing the release-band markers; cannot stamp it")
    html = BAND_RE.sub(lambda m: m.group(1) + tag + m.group(3), html, count=1)
    html = VERSION_RE.sub(lambda m: m.group(1) + label + m.group(3), html, count=1)
    html = LINK_RE.sub(lambda m: m.group(1) + record["releaseUrl"] + m.group(3), html, count=1)
    return html


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", default="ohgeeceee/beemuu", help="app repository owning the release")
    ap.add_argument("--tag", default=None, help="stamp this tag instead of the latest release")
    ap.add_argument("--write", action="store_true", help="write the files (default: check only)")
    args = ap.parse_args()

    try:
        release = resolve_release(args.repo, args.tag)
    except urllib.error.HTTPError as exc:
        print(f"could not resolve release for {args.repo}: HTTP {exc.code}")
        return 2
    except Exception as exc:  # network, DNS, JSON
        print(f"could not resolve release for {args.repo}: {exc}")
        return 2

    record = release_record(args.repo, release)
    wanted_json = json.dumps(record, indent=2, sort_keys=True) + "\n"

    current_json = RELEASE_FILE.read_text() if RELEASE_FILE.exists() else ""
    index_html = INDEX_FILE.read_text()
    stamped_html = render_index(index_html, record)

    stale = [name for name, now, want in (("app-release.json", current_json, wanted_json),
                                          ("index.html", index_html, stamped_html)) if now != want]

    print(f"APP_TAG={record['tag']}")
    print(f"VERSION={record['version']}")
    print(f"STALE={','.join(stale) if stale else '-'}")
    print(f"CHANGED={'true' if stale else 'false'}")

    if not stale:
        return 0
    if not args.write:
        print(f"{len(stale)} file(s) would be updated; re-run with --write")
        return 1

    for name, want in (("app-release.json", wanted_json), ("index.html", stamped_html)):
        if (name == "app-release.json" and current_json != wanted_json) or \
           (name == "index.html" and index_html != stamped_html):
            (ROOT / name).write_text(want)
            print(f"wrote {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
