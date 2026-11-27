// Maintenance Mind — personalized maintenance plan from VIN + odometer.
// Detects the engine family from the VIN where possible (or asks), reads the
// odometer live, and shows every service item with km-remaining and a
// due status. "Mark done" stamps the item at the current odometer and
// persists it. Intervals follow common enthusiast practice, which is more
// conservative than BMW's "lifetime fill" marketing.

const STATE_FILE = 'maintenance-mind.json';

// Engine guesses from VIN: BMW VIN positions 4-7 (model code) vary wildly by
// era, so detection is best-effort and the user can override the family.
const ENGINE_FAMILIES = {
  auto:   'Auto (best guess)',
  n54:    'N54 3.0 turbo I6 (135i/335i/535i, 2006–2010)',
  n55:    'N55 3.0 turbo I6 (135i/335i/X3, 2009–2017)',
  b58:    'B58 3.0 turbo I6 (140i/240i/340i/540i, 2015–)',
  b48:    'B48 2.0 turbo I4 (118i–330i/X1/X3, 2014–)',
  n20:    'N20/N26 2.0 turbo I4 (228i/328i/528i, 2011–2016)',
  n63:    'N63 4.4 twin-turbo V8 (550i/650i/X5 50i, 2008–)',
  s55:    'S55 3.0 turbo I6 (M3/M4 F80/F82, 2014–2020)',
  s58:    'S58 3.0 turbo I6 (M3/M4 G80/G82, X3M/X4M, 2019–)',
  n57:    'N57 3.0 diesel I6 (330d/530d/X5 30d, 2008–2020)',
  b47:    'B47 2.0 diesel I4 (118d–320d/X3 20d, 2014–)',
  other:  'Other / not listed',
};

// Intervals in km. Engine-specific overrides replace the base set.
const BASE_SCHEDULE = [
  { id: 'oil',        item: 'Engine oil & filter',        km: 10000 },
  { id: 'brakefluid', item: 'Brake fluid flush',          km: 40000 },
  { id: 'airfilter',  item: 'Engine air filter',          km: 30000 },
  { id: 'cabin',      item: 'Cabin microfilter',          km: 30000 },
  { id: 'coolant',    item: 'Coolant',                    km: 60000 },
  { id: 'diff',       item: 'Differential oil',           km: 80000 },
  { id: 'gearbox',    item: 'Automatic gearbox oil ("lifetime")', km: 80000 },
  { id: 'belt',       item: 'Serpentine belt + tensioner check', km: 90000 },
];
const ENGINE_OVERRIDES = {
  n54: [{ id: 'plugs', item: 'Spark plugs', km: 45000 }, { id: 'coils', item: 'Ignition coils (inspect)', km: 60000 }],
  n55: [{ id: 'plugs', item: 'Spark plugs', km: 60000 }],
  b58: [{ id: 'plugs', item: 'Spark plugs', km: 75000 }],
  b48: [{ id: 'plugs', item: 'Spark plugs', km: 75000 }],
  n20: [{ id: 'plugs', item: 'Spark plugs', km: 60000 }, { id: 'chain', item: 'Timing chain (inspect for stretch)', km: 100000 }],
  n63: [{ id: 'plugs', item: 'Spark plugs', km: 60000 }, { id: 'ccv', item: 'Crankcase ventilation valves', km: 100000 }],
  s55: [{ id: 'plugs', item: 'Spark plugs', km: 45000 }, { id: 'crankhub', item: 'Crank hub (inspect)', km: 80000 }],
  s58: [{ id: 'plugs', item: 'Spark plugs', km: 60000 }],
  n57: [{ id: 'fuelfilter', item: 'Fuel filter', km: 40000 }, { id: 'chain', item: 'Timing chain (listen for rattle)', km: 100000 }],
  b47: [{ id: 'fuelfilter', item: 'Fuel filter', km: 40000 }],
  other: [{ id: 'plugs', item: 'Spark plugs', km: 60000 }],
};

let unsubscribe = null;
let odometerKm = null;
let state = { family: 'auto', done: {} }; // done: {itemId: odometerKm}

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function guessFamilyFromVin(vin) {
  // Best-effort heuristics; wrong guesses are fine — the user can override.
  const v = (vin || '').toUpperCase();
  if (!v) return 'auto';
  const year = v[9]; // model-year code position
  const isDiesel = /D/.test(v.slice(3, 8));
  if (isDiesel) return (year >= 'F') ? 'b47' : 'n57';
  if (year >= 'G') return 'b58';        // ~2016+ turbo six
  if (year >= 'F') return 'b48';        // ~2015+
  return 'n55';                          // safe middle guess for 2010s
}

function scheduleFor(family) {
  const f = family === 'auto' ? 'other' : family;
  const byId = {};
  for (const it of BASE_SCHEDULE) byId[it.id] = it;
  for (const it of (ENGINE_OVERRIDES[f] || ENGINE_OVERRIDES.other)) byId[it.id] = it;
  return Object.values(byId);
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'Maintenance Mind',
    render(container) {
      container.innerHTML =
        '<div style="font-family:sans-serif;max-width:700px;">' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">' +
            '<button id="mm-detect" style="padding:6px 12px;">Detect vehicle</button>' +
            '<select id="mm-family" style="padding:6px;max-width:340px;">' +
              Object.entries(ENGINE_FAMILIES).map(([k, label]) =>
                '<option value="' + k + '">' + esc(label) + '</option>').join('') +
            '</select>' +
            '<span id="mm-odo" style="font-size:13px;color:#555;"></span>' +
          '</div>' +
          '<table style="border-collapse:collapse;width:100%;font-size:13px;">' +
            '<thead><tr>' +
              '<th style="text-align:left;padding:5px;border-bottom:1px solid #ccc;">Item</th>' +
              '<th style="text-align:right;padding:5px;border-bottom:1px solid #ccc;">Interval</th>' +
              '<th style="text-align:right;padding:5px;border-bottom:1px solid #ccc;">Last done</th>' +
              '<th style="text-align:right;padding:5px;border-bottom:1px solid #ccc;">Due in</th>' +
              '<th style="padding:5px;border-bottom:1px solid #ccc;"></th>' +
            '</tr></thead><tbody id="mm-body">' +
              '<tr><td colspan="5" style="padding:10px;color:#777;">Detect the vehicle to load the plan.</td></tr>' +
            '</tbody></table>' +
          '<p style="font-size:12px;color:#777;margin-top:10px;">Intervals follow common enthusiast ' +
          'practice (10k km oil, 80k km gearbox oil) — stricter than factory "lifetime" claims, on purpose. ' +
          'Always cross-check your owner\'s manual.</p>' +
        '</div>';

      const body = container.querySelector('#mm-body');
      const familySel = container.querySelector('#mm-family');
      const odoSpan = container.querySelector('#mm-odo');

      async function persist() {
        try { await context.fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2)); }
        catch { /* best-effort */ }
      }

      function fmtKm(n) { return Math.round(n).toLocaleString('en-US') + ' km'; }

      function paint() {
        const sched = scheduleFor(state.family);
        if (odometerKm === null) {
          body.innerHTML = '<tr><td colspan="5" style="padding:10px;color:#777;">' +
            'Waiting for odometer… (subscribe to the odometer_km PID)</td></tr>';
          return;
        }
        odoSpan.textContent = 'Odometer: ' + fmtKm(odometerKm);
        body.innerHTML = '';
        const rows = sched.map(it => {
          const last = state.done[it.id];
          const dueAt = (last === undefined ? 0 : last) + it.km;
          const dueIn = dueAt - odometerKm;
          return { it, last, dueIn };
        }).sort((a, b) => a.dueIn - b.dueIn);

        for (const { it, last, dueIn } of rows) {
          const overdue = dueIn < 0;
          const soon = !overdue && dueIn < 2000;
          const color = overdue ? '#b71c1c' : soon ? '#e65100' : '#2e7d32';
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td style="padding:5px;border-bottom:1px solid #eee;">' + esc(it.item) + '</td>' +
            '<td style="padding:5px;border-bottom:1px solid #eee;text-align:right;">' + fmtKm(it.km) + '</td>' +
            '<td style="padding:5px;border-bottom:1px solid #eee;text-align:right;">' +
              (last === undefined ? '—' : fmtKm(last)) + '</td>' +
            '<td style="padding:5px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:' + color + ';">' +
              (overdue ? 'OVERDUE ' + fmtKm(-dueIn) : fmtKm(dueIn)) + '</td>' +
            '<td style="padding:5px;border-bottom:1px solid #eee;text-align:right;">' +
              '<button data-done="' + esc(it.id) + '" style="padding:2px 8px;">Done ✓</button></td>';
          body.appendChild(tr);
        }
        body.querySelectorAll('button[data-done]').forEach(btn => {
          btn.onclick = async () => {
            state.done[btn.dataset.done] = odometerKm;
            await persist();
            paint();
            context.ui.notify('Marked "' + btn.dataset.done + '" done at ' + fmtKm(odometerKm) + '.');
          };
        });
      }

      function subscribeOdo() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        unsubscribe = context.vehicle.subscribeLive(['odometer_km'], v => {
          const n = Number(v.odometer_km);
          if (Number.isFinite(n) && n > 0) { odometerKm = n; paint(); }
        });
      }

      container.querySelector('#mm-detect').onclick = async () => {
        try {
          const vin = await context.vehicle.readVin();
          state.family = guessFamilyFromVin(vin);
          familySel.value = state.family;
          context.ui.notify('VIN ' + vin + ' → engine family guess: ' +
            ENGINE_FAMILIES[state.family] + '. Override above if wrong.');
        } catch (err) {
          context.ui.notify('VIN read failed: ' + err.message + ' — pick the engine family manually.');
        }
        await persist();
        paint();
      };

      familySel.onchange = async () => { state.family = familySel.value; await persist(); paint(); };

      familySel.value = state.family;
      subscribeOdo();
      paint();
    }
  });
}

export function deactivate() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
