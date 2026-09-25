# Beemuu Plugin Format v1

A Beemuu plugin is a **zip archive** containing at minimum:

```
my-plugin-1.0.0.zip
├── plugin.json   # required — plugin descriptor
├── main.js       # required — entry point
└── README.md     # recommended
```

## plugin.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "entry": "main.js",
  "capabilities": ["read-dtc"]
}
```

`capabilities` must match the marketplace manifest. The app uses this list to
decide what the plugin is allowed to call.

## Plugin API

The app loads `main.js` in the webview and calls:

```js
// Called once when the plugin is enabled.
// context exposes host services gated by the plugin's declared capabilities:
//   context.app.version            -> e.g. "2.2.0"
//   context.vehicle.readVin()      -> Promise<string>   (cap: read-vin)
//   context.vehicle.readDtc()      -> Promise<Dtc[]>    (cap: read-dtc)
//   context.vehicle.clearDtc()     -> Promise<void>     (cap: clear-dtc)
//   context.vehicle.subscribeLive(pids, cb) -> unsub    (cap: live-data)
//   context.fs.writeFile(name, data)        (cap: filesystem)
//   context.ui.registerPanel({title, render}) -> panel handle
//   context.ui.notify(message)
export function activate(context) { /* ... */ }

// Called when the plugin is disabled or the app shuts down.
export function deactivate() { /* ... */ }
```

Both functions are optional, but a plugin that does nothing on `activate` is
pointless. Plugins never talk to the transport directly — all vehicle access
goes through `context.vehicle`, so the host can enforce capabilities and keep
the comms engine isolated (same rule as the rest of the app).

## Safety rules

- `coding-write` and `ecu-flash` capabilities are reserved and require manual
  maintainer review in the marketplace.
- Plugins must not make network calls unless they declare the `network`
  capability.
