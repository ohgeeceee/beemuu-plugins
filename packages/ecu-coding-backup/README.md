# ECU Coding Backup

The safety-net plugin for anyone who codes their BMW: snapshot the car's
state **before** changing anything, and diff snapshots to answer
"what did that shop / that coding app actually change?"

- One-click snapshot: VIN, full DTC state, and ECU coding data, written to a
  timestamped JSON file (`coding-snapshot-….json`).
- In-session snapshot list with notes ("before mirror retrofit", …).
- **Diff** the two newest snapshots: every changed parameter in a
  before/after table, exported to JSON for the paper trail.
- Strictly **read-only** — restoring coding is deliberately out of scope.

Note on hosts: full coding capture uses the optional host extension
`context.vehicle.readCoding()`. On hosts without it, the snapshot still
captures VIN + DTC state and says so plainly. Snapshot files can be
re-compared offline with any JSON diff tool.

Capabilities: `read-vin`, `read-dtc`, `filesystem`. No `coding-write` —
this plugin cannot modify the vehicle.
