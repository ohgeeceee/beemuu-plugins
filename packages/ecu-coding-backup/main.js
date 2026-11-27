// ECU Coding Backup — snapshot the car's coding/state before anyone changes
// anything, diff snapshots, and keep a timestamped paper trail.
//
// The plugin uses the documented host API (readVin, readDtc, fs.writeFile)
// and additionally calls context.vehicle.readCoding() / context.fs.readFile()
// *only if the host exposes them* — they are optional host extensions, and
// the plugin degrades gracefully when they are absent. This plugin never
// writes to the vehicle; restoring coding is deliberately out of scope.

const SNAP_PREFIX = 'coding-snapshot-';

let snapshots = []; // {id, takenAt, vin, coding: {ecu: {...}} | null, dtcs: []}

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function stable(x) {
  // Deterministic stringify so diffs are not fooled by key order.
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
  if (x && typeof x === 'object') {
    return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}';
  }
  return JSON.stringify(x);
}

function flatten(obj, prefix, out) {
  // {CAFD: {a: {b: 1}}} -> {"CAFD.a.b": 1}
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? v.join('|') : v;
  }
  return out;
}

function diffSnapshots(a, b) {
  const fa = flatten(a.coding || {}, '', {});
  const fb = flatten(b.coding || {}, '', {});
  const rows = [];
  for (const key of new Set([...Object.keys(fa), ...Object.keys(fb)].sort())) {
    const va = fa[key], vb = fb[key];
    if (stable(va) !== stable(vb)) rows.push({ key, from: va, to: vb });
  }
  return rows;
}

async function takeSnapshot(context, note) {
  const snap = { id: SNAP_PREFIX.replace(/-$/, '') + '-' + Date.now(), takenAt: new Date().toISOString(),
                 note: note || '', vin: null, coding: null, dtcs: [] };
  try { snap.vin = await context.vehicle.readVin(); } catch { /* keep null */ }
  try { snap.dtcs = await context.vehicle.readDtc(); } catch { /* keep [] */ }

  if (typeof context.vehicle.readCoding === 'function') {
    try { snap.coding = await context.vehicle.readCoding(); }
    catch (err) { context.ui.notify('Coding read failed: ' + err.message); }
  } else {
    context.ui.notify('This host does not expose coding reads — snapshot contains VIN + DTC state only.');
  }

  snapshots.push(snap);
  const name = SNAP_PREFIX + snap.takenAt.replace(/[:.]/g, '-') + '.json';
  await context.fs.writeFile(name, JSON.stringify(snap, null, 2));
  return { snap, name };
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'Coding Backup',
    render(container) {
      container.innerHTML =
        '<div style="font-family:sans-serif;max-width:680px;">' +
          '<div style="padding:10px;border-radius:6px;background:#e3f2fd;color:#0d47a1;font-size:13px;margin-bottom:10px;">' +
            '<strong>Rule #1 of coding:</strong> snapshot before you touch anything. ' +
            'This plugin is read-only — it never writes coding back to an ECU.</div>' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
            '<input id="cb-note" placeholder="Note (e.g. before mirrors retrofit)" style="padding:6px;min-width:220px;">' +
            '<button id="cb-take" style="padding:6px 12px;">Take snapshot</button>' +
            '<button id="cb-diff" style="padding:6px 12px;" disabled>Diff two newest</button>' +
          '</div>' +
          '<div id="cb-list" style="margin-top:10px;font-size:13px;"></div>' +
          '<div id="cb-diffout" style="margin-top:10px;"></div>' +
        '</div>';

      const listBox = container.querySelector('#cb-list');
      const diffBtn = container.querySelector('#cb-diff');
      const diffOut = container.querySelector('#cb-diffout');

      function paintList() {
        diffBtn.disabled = snapshots.length < 2;
        if (!snapshots.length) {
          listBox.innerHTML = '<span style="color:#777;">No snapshots this session. ' +
            'Files from earlier sessions are named <code>' + SNAP_PREFIX + '…​.json</code> ' +
            'in the plugin data folder.</span>';
          return;
        }
        listBox.innerHTML = snapshots.map((s, i) =>
          '<div style="padding:6px 0;border-bottom:1px solid #eee;">' +
            '<strong>#' + (i + 1) + '</strong> · ' + esc(s.takenAt.replace('T', ' ').slice(0, 19)) +
            (s.note ? ' · <em>' + esc(s.note) + '</em>' : '') +
            ' · VIN ' + esc(s.vin || 'unknown') +
            ' · ' + (s.coding ? Object.keys(s.coding).length + ' ECU(s) captured' : 'no coding data') +
            ' · ' + s.dtcs.length + ' DTC(s)</div>'
        ).join('');
      }

      container.querySelector('#cb-take').onclick = async () => {
        const btn = container.querySelector('#cb-take');
        btn.disabled = true; btn.textContent = 'Snapshotting…';
        try {
          const { snap, name } = await takeSnapshot(context, container.querySelector('#cb-note').value.trim());
          context.ui.notify('Snapshot saved: ' + name);
          if (snap.dtcs.length) {
            context.ui.notify('Note: ' + snap.dtcs.length + ' DTC(s) present at snapshot time.');
          }
          paintList();
        } catch (err) {
          context.ui.notify('Snapshot failed: ' + err.message);
        } finally {
          btn.disabled = false; btn.textContent = 'Take snapshot';
        }
      };

      diffBtn.onclick = async () => {
        const [b, a] = [snapshots[snapshots.length - 1], snapshots[snapshots.length - 2]];
        if (!a.coding || !b.coding) {
          diffOut.innerHTML = '<div style="padding:10px;background:#fff8e1;border-radius:6px;">' +
            'Diff needs coding data in both snapshots; this host only captured VIN/DTC state.</div>';
          return;
        }
        const rows = diffSnapshots(a, b);
        if (!rows.length) {
          diffOut.innerHTML = '<div style="padding:10px;background:#e8f5e9;border-radius:6px;">' +
            '✅ No coding differences between the two newest snapshots.</div>';
          return;
        }
        const html =
          '<h4 style="margin:6px 0;">' + rows.length + ' difference(s):</h4>' +
          '<table style="border-collapse:collapse;width:100%;font-size:12px;">' +
          '<thead><tr><th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">Parameter</th>' +
          '<th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">Before</th>' +
          '<th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">After</th></tr></thead>' +
          '<tbody>' + rows.map(r =>
            '<tr><td style="padding:4px;border-bottom:1px solid #eee;">' + esc(r.key) + '</td>' +
            '<td style="padding:4px;border-bottom:1px solid #eee;color:#b71c1c;">' + esc(String(r.from ?? '—')) + '</td>' +
            '<td style="padding:4px;border-bottom:1px solid #eee;color:#1b5e20;">' + esc(String(r.to ?? '—')) + '</td></tr>'
          ).join('') + '</tbody></table>';
        diffOut.innerHTML = html;
        const name = 'coding-diff-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
        await context.fs.writeFile(name, JSON.stringify({ before: a.takenAt, after: b.takenAt, changes: rows }, null, 2));
        context.ui.notify('Diff exported: ' + name);
      };

      paintList();
    }
  });
}

export function deactivate() { snapshots = []; }
