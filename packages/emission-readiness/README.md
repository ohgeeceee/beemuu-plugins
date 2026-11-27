# Emission Readiness

One-screen I/M readiness check so you know whether the car will pass a smog
or emissions inspection **before** you drive to the station.

- Live status of all standard OBD monitors (catalyst, EVAP, O2, secondary
  air, …) — complete / not complete / n/a.
- MIL (check-engine light) state and distance since the last code clear.
- Plain verdict: **Likely PASS**, **Not ready**, or **Likely FAIL**, plus a
  stored/pending code check.
- Drive-cycle tip for getting stubborn monitors to complete.

Capabilities: `live-data`, `read-dtc`. Read-only; no ECU writes, no network.
