# Gauge Cluster Builder

Build your own live dashboard: pick any PID, choose a gauge style, arrange
them in a grid, and save named layouts.

- Three gauge types: **dial** (SVG analog sweep), **bar**, **digital**.
- Any PID the car exposes (`rpm`, `boost`, `coolant_temp`,
  `battery_voltage`, …) with custom min/max ranges and unit labels.
- Values update live; gauges turn red in the top 15 % of their range.
- Named layouts (`daily`, `track`, `winter`) persisted to
  `gauge-layouts.json` so your setup survives restarts.
- Ships with a starter "daily" layout (rpm / speed / coolant / voltage)
  so the panel works out of the box.

Capabilities: `live-data`, `filesystem`. Read-only; no ECU writes.
