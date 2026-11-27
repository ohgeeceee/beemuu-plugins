# Battery Registration

Guided new-battery registration for BMWs with IBS (intelligent battery
sensor). Skipping registration after a battery swap makes the power
management system charge the new battery like the old, worn one — the main
reason new BMW batteries die early.

Three-step flow:

1. **Pre-checks** — verifies the host supports registration, reads the VIN,
   and checks battery voltage (≥ 12.4 V recommended).
2. **Select** battery type (AGM / flooded) and exact capacity (Ah) from the
   new battery's label.
3. **Type `REGISTER` to confirm**, then the registration is written through
   the host's gated `codingWrite` API.

Safety notes:

- Register only when the new battery is physically installed.
- Changing battery **type or capacity** vs. factory spec additionally
  requires a vehicle-order (VO) update — that is out of scope here.
- ⚠️ This plugin declares the reserved **`coding-write`** capability and
  therefore goes through manual maintainer safety review in the marketplace.

Capabilities: `read-vin`, `live-data`, `coding-write`.
