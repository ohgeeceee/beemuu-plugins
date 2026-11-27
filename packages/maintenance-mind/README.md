# Maintenance Mind

A personalized maintenance plan built from your VIN, engine family, and live
odometer — with a persistent "last done" record per item.

- **Detect vehicle** reads the VIN and guesses the engine family
  (N54/N55/B58/B48/N20/N63/S55/S58/N57/B47) — overridable with a dropdown.
- Live odometer drives the plan: every item shows its interval, when it was
  last done, and **km remaining**, sorted most-urgent first
  (green → orange "due soon" → red **OVERDUE**).
- **Done ✓** stamps the item at the current odometer and persists it to
  `maintenance-mind.json`.
- Engine-specific items included: timing-chain watch items (N20, N57),
  crank-hub check (S55), fuel filters (diesels), plug intervals per engine.

Intervals follow common enthusiast practice — 10k km oil, 80k km gearbox oil
— deliberately stricter than BMW's "lifetime fill" marketing. Cross-check
your owner's manual.

Pairs well with **VIN Decoder Plus** for exact build data.

Capabilities: `read-vin`, `live-data`, `filesystem`. Read-only on the car.
