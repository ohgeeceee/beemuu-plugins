# DTC Explainer

Turns raw BMW fault codes into plain-English guidance: what the code means,
the most likely causes (ranked), whether it is safe to keep driving, where to
start diagnosing, and a typical repair-cost range.

- Offline database of common BMW codes (HPFP, VANOS, misfires, Valvetronic,
  DPF, DSC, CAS…) plus generic OBD-II family fallbacks for everything else.
- "Scan vehicle & explain all" reads stored DTCs and sorts them by severity.
- Manual lookup box for codes you saw elsewhere.

Capabilities: `read-dtc`. Fully offline — no network, no ECU writes.

Cost ranges are ballpark USD figures for orientation only; always confirm
with a proper diagnosis before buying parts.
