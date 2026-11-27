# Fuel Trim Health

Long-term fuel-trim monitoring that turns raw numbers into a diagnosis.

- Live STFT / LTFT per bank plus session averages (warm-engine only —
  samples below 75 °C coolant temp are excluded from the verdict).
- Plain-English health assessment:
  - LTFT beyond **+10 %** → ECU adding fuel: vacuum leak, weak pump, dirty MAF.
  - LTFT beyond **−10 %** → ECU removing fuel: leaking injector, stuck purge valve.
  - **Bank-to-bank spread > 5 points** → bank-specific O2 sensor / injector / exhaust leak.
- One-click CSV export of the whole session for spreadsheet analysis or
  sharing on the forum.

Run it on your regular commute for a week — a slow drift in LTFT is one of
the earliest warnings of intake leaks and aging O2 sensors.

Capabilities: `live-data`, `filesystem`. Read-only; no ECU writes.
