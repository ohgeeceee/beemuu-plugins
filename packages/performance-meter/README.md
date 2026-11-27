# Performance Meter

GPS-free acceleration timing using nothing but the vehicle speed PID.

- Automatic launch detection: come to a stop, wait for **ARMED**, go.
  The run saves itself when you stop again.
- Splits: **0–100 km/h**, **0–200 km/h**, **100–200 km/h**
  (or 0–60 / 0–100 / 60–130 mph with the units toggle).
- Quarter-mile estimate by integrating speed over time.
- Live split display during the pull; history of the last 10 runs.
- CSV export for comparing tunes, fuels, or mods over time.

Accuracy depends on the speed PID's update rate — typically within
±0.1–0.2 s of GPS-based meters. Only use on closed courses.

Capabilities: `live-data`, `filesystem`. Read-only; no ECU writes.
