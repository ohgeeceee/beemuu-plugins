# Live Data Watchdog

Threshold alarms on any live sensor PID — a cheap early-warning system for
the gauges you are not watching.

- Add rules per PID with a minimum, a maximum, or both
  (`coolant_temp max 115`, `battery_voltage min 11.8`, …).
- When a value leaves its band for more than ~1.5 s, the panel flashes red,
  a beep sounds, and a Beemuu notification is raised.
- Live column shows current values; alarmed rows highlight.
- Rules persist between sessions (`watchdog-rules.json`).

Great for track days (oil/coolant temps, boost) and as a head-gasket or
charging-system early warning on daily drivers.

Capabilities: `live-data`, `filesystem`. Read-only monitoring — the plugin
never writes to the vehicle.
