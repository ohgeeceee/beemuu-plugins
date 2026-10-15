#!/usr/bin/env python3
"""Assemble the plugins.beemuu.com Pages artifact.

Pages for this repository is configured for workflow builds, so publishing
means uploading an artifact and deploying it. Only the files the marketplace
actually serves are copied -- the repository's tooling, CI config and package
sources stay out of the published site.

Usage: python3 tools/build_site.py [-o _site]
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REQUIRED = ("index.html", "registry.json", "CNAME")
DIRS = ("dist", "official")


def build(out: Path) -> int:
    missing = [name for name in REQUIRED if not (ROOT / name).is_file()]
    if missing:
        print(f"::error::missing required site files: {', '.join(missing)}")
        return 1
    if not (ROOT / "app-release.json").is_file():
        print("::error::app-release.json is missing -- run tools/sync_app_release.py --write first")
        return 1

    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    for name in (*REQUIRED, "app-release.json"):
        shutil.copy2(ROOT / name, out / name)
    for name in DIRS:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, out / name)
    (out / ".nojekyll").write_text("")

    files = sorted(p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file())
    print(f"built {out} with {len(files)} files")
    for f in files:
        print(f"  {f}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--out", default="_site", help="output directory (default: _site)")
    args = ap.parse_args()
    return build((ROOT / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out))


if __name__ == "__main__":
    sys.exit(main())
