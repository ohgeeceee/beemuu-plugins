#!/usr/bin/env python3
"""One-off build: zip the 9 new plugins into dist/, hash them, write manifests."""
import hashlib
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE_TAG = "v1.2"
BASE_URL = f"https://github.com/ohgeeceee/beemuu-plugins/releases/download/{RELEASE_TAG}"

NEW_PLUGINS = [
    ("dtc-explainer", "DTC Explainer", "diagnostics",
     "Turns raw BMW fault codes into plain-English guidance: likely causes ranked, safe-to-drive verdict, first diagnostic steps and typical repair cost. Offline DB plus OBD-II family fallbacks.",
     ["dtc", "diagnosis", "help", "offline"]),
    ("emission-readiness", "Emission Readiness", "diagnostics",
     "One-screen I/M readiness check: per-monitor status, MIL state, distance since last clear, and a plain likely-PASS / not-ready / likely-FAIL verdict before the smog station.",
     ["emissions", "smog", "readiness", "inspection"]),
    ("live-data-watchdog", "Live Data Watchdog", "tools",
     "Threshold alarms on any live PID. Set min/max bands (coolant temp, boost, battery voltage); the panel flashes, a beep sounds and a notification fires when a value leaves its band.",
     ["live-data", "alarm", "monitoring", "track"]),
    ("fuel-trim-health", "Fuel Trim Health", "diagnostics",
     "Logs STFT/LTFT per bank with warm-engine filtering, computes session averages, and translates fuel trims into a plain-English verdict: vacuum leak, leaking injector, bank spread.",
     ["fuel-trim", "diagnosis", "logging", "csv"]),
    ("performance-meter", "Performance Meter", "data",
     "GPS-free acceleration timing from the speed PID: auto launch detection, 0-100 / 100-200 km/h (or mph) splits, quarter-mile estimate, run history and CSV export.",
     ["performance", "0-100", "quarter-mile", "track"]),
    ("gauge-cluster-builder", "Gauge Cluster Builder", "ui",
     "Build custom live dashboards: dial, bar and digital gauges for any PID with custom ranges, named saved layouts (daily/track/winter), and a starter layout out of the box.",
     ["gauges", "dashboard", "live-data", "ui"]),
    ("ecu-coding-backup", "ECU Coding Backup", "coding",
     "Snapshot VIN, DTC state and ECU coding before anyone changes anything; diff snapshots to see exactly what changed. Strictly read-only on the vehicle.",
     ["coding", "backup", "safety", "diff"]),
    ("battery-registration", "Battery Registration", "coding",
     "Guided new-battery registration for BMWs with IBS: pre-checks (host support, VIN, voltage), type/capacity selection, typed confirmation. Reserved coding-write capability.",
     ["battery", "registration", "ibs", "coding"]),
    ("maintenance-mind", "Maintenance Mind", "tools",
     "Personalized maintenance plan from VIN, engine family and live odometer: per-item intervals, last-done stamps, km-remaining sorted by urgency. Enthusiast intervals, not lifetime-fill.",
     ["maintenance", "schedule", "service", "odometer"]),
]

def main():
    for pid, name, category, desc, tags in NEW_PLUGINS:
        src = os.path.join(ROOT, "packages", pid)
        zip_name = f"{pid}-1.0.0.zip"
        zpath = os.path.join(ROOT, "dist", zipname := zip_name)
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for fn in ["plugin.json", "main.js", "README.md"]:
                z.write(os.path.join(src, fn), fn)
        data = open(zpath, "rb").read()
        sha = hashlib.sha256(data).hexdigest()
        # read capabilities from the plugin's own plugin.json
        caps = json.load(open(os.path.join(src, "plugin.json"), encoding="utf-8"))["capabilities"]
        manifest = {
            "id": pid,
            "name": name,
            "version": "1.0.0",
            "author": "ohgeeceee",
            "official": True,
            "description": desc,
            "category": category,
            "tags": tags,
            "homepage": "https://github.com/ohgeeceee/beemuu-plugins",
            "download": {
                "url": f"{BASE_URL}/{zip_name}",
                "sha256": sha,
                "sizeBytes": len(data),
            },
            "minAppVersion": "2.2.0",
            "license": "GPL-3.0-only",
            "capabilities": caps,
        }
        mpath = os.path.join(ROOT, "official", f"{pid}.json")
        with open(mpath, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
            f.write("\n")
        print(f"{pid}: {len(data)} bytes, sha256 {sha[:16]}... -> official/{pid}.json")

if __name__ == "__main__":
    main()
