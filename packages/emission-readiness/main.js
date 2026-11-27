// Emission Readiness — one-screen I/M monitor check before inspection.
// Shows which OBD monitors have completed since the last DTC clear, the MIL
// state, and a plain "likely to pass?" verdict.

// Monitors we ask the host for. Unsupported names come back undefined and are
// shown as "n/a" instead of failing — different ECUs expose different sets.
const MONITORS = [
  ['mon_misfire',        'Misfire'],
  ['mon_fuel_system',    'Fuel system'],
  ['mon_components',     'Comprehensive components'],
  ['mon_catalyst',       'Catalyst'],
  ['mon_heated_catalyst','Heated catalyst'],
  ['mon_evap',           'EVAP system'],
  ['mon_secondary_air',  'Secondary air'],
  ['mon_o2_sensor',      'Oxygen sensor'],
  ['mon_o2_heater',      'O2 sensor heater'],
  ['mon_ac_refrigerant', 'A/C refrigerant'],
];
const META_PIDS = ['mil_status', 'dtc_count', 'dist_since_clear_km'];

let unsubscribe = null;

function normalize(v) {
  if (v === undefined || v === null) return 'na';
  if (v === true || v === 1 || v === 'complete' || v === 'ready' || v === 'done') return 'done';
  if (v === false || v === 0 || v === 'incomplete' || v === 'not_ready') return 'pending';
  return 'na';
}

function truthy(v) {
  return v === true || v === 1 || v === 'on' || v === 'true';
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'Emission Readiness',
    render(container) {
      container.innerHTML =
        '<div style="font-family:sans-serif;max-width:560px;">' +
          '<div style="display:flex;gap:8px;align-items:center;">' +
            '<button id="er-refresh" style="padding:6px 12px;">Refresh</button>' +
            '<span id="er-meta" style="color:#666;font-size:13px;"></span>' +
          '</div>' +
          '<div id="er-verdict" style="margin:12px 0;padding:12px;border-radius:6px;display:none;"></div>' +
          '<table style="border-collapse:collapse;width:100%;margin-top:8px;">' +
            '<thead><tr><th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">Monitor</th>' +
            '<th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">Status</th></tr></thead>' +
            '<tbody id="er-body"><tr><td colspan="2" style="padding:8px;color:#777;">Waiting for data…</td></tr></tbody>' +
          '</table>' +
          '<p style="font-size:12px;color:#777;margin-top:12px;">Tip: after clearing codes, most BMWs need ' +
          'a mixed drive cycle (cold start + city + steady highway) before all monitors complete.</p>' +
        '</div>';

      const body = container.querySelector('#er-body');
      const meta = container.querySelector('#er-meta');
      const verdictBox = container.querySelector('#er-verdict');

      function paint(values) {
        let rows = '';
        let pending = 0, supported = 0;
        for (const [pid, label] of MONITORS) {
          const st = normalize(values[pid]);
          if (st !== 'na') supported++;
          if (st === 'pending') pending++;
          const [text, color] = st === 'done' ? ['✅ complete', '#2e7d32']
            : st === 'pending' ? ['⏳ not complete', '#ef6c00'] : ['n/a', '#999'];
          rows += '<tr><td style="padding:4px;border-bottom:1px solid #eee;">' + label + '</td>' +
            '<td style="padding:4px;border-bottom:1px solid #eee;color:' + color + ';">' + text + '</td></tr>';
        }
        body.innerHTML = rows;

        const mil = truthy(values.mil_status);
        const distKm = values.dist_since_clear_km;
        meta.textContent =
          'MIL: ' + (mil ? 'ON ⚠️' : 'off') +
          (typeof distKm === 'number' ? ' · ' + Math.round(distKm) + ' km since last clear' : '') +
          (values.dtc_count !== undefined ? ' · ' + values.dtc_count + ' DTC(s) reported by ECU' : '');

        verdictBox.style.display = 'block';
        if (mil) {
          verdictBox.style.cssText += 'background:#ffebee;color:#b71c1c;';
          verdictBox.innerHTML = '<strong>Likely FAIL</strong> — the check-engine light (MIL) is on. Diagnose and repair first.';
        } else if (supported > 0 && pending > 0) {
          verdictBox.style.cssText += 'background:#fff8e1;color:#e65100;';
          verdictBox.innerHTML = '<strong>Not ready</strong> — ' + pending + ' monitor(s) still incomplete. ' +
            'Most inspectors allow 0–1 incomplete; complete a full drive cycle before going.';
        } else if (supported > 0) {
          verdictBox.style.cssText += 'background:#e8f5e9;color:#1b5e20;';
          verdictBox.innerHTML = '<strong>Likely PASS</strong> — MIL off and all supported monitors complete. ' +
            'Confirm no pending codes with a full DTC scan.';
        } else {
          verdictBox.style.cssText += 'background:#eceff1;color:#37474f;';
          verdictBox.innerHTML = '<strong>No monitor data</strong> — this ECU did not expose readiness PIDs. ' +
            'Try the engine ECU while the ignition is on.';
        }
      }

      async function checkPendingCodes() {
        try {
          const dtcs = await context.vehicle.readDtc();
          if (dtcs.length) {
            meta.textContent += ' · ⚠️ ' + dtcs.length + ' stored/pending code(s)';
          }
        } catch { /* verdict already covers the monitor view */ }
      }

      function subscribe() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        const pids = META_PIDS.concat(MONITORS.map(m => m[0]));
        unsubscribe = context.vehicle.subscribeLive(pids, paint);
        checkPendingCodes();
      }

      container.querySelector('#er-refresh').onclick = subscribe;
      subscribe();
    }
  });
}

export function deactivate() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
