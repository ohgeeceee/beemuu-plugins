// Performance Meter — GPS-free acceleration timing from the speed PID.
// Detects a launch automatically (car nearly stationary, then accelerating)
// and records how long it takes to cross each speed threshold. Also
// integrates speed over time for a quarter-mile estimate. Results export
// to CSV. All math runs on km/h internally; display units are switchable.

const KMH_TO_MPH = 0.621371;
const QUARTER_MILE_M = 402.336;

let unsubscribe = null;
let runs = [];              // completed runs: {date, unit, times:{label:s}, quarterMileS}
let run = null;             // active run state
let displayUnit = 'kmh';    // 'kmh' | 'mph'

function thresholds() {
  // Labels and target speeds in the current display unit, converted to km/h.
  return displayUnit === 'mph'
    ? [['0–60 mph', 60 / KMH_TO_MPH], ['0–100 mph', 100 / KMH_TO_MPH],
       ['60–130 mph', [60 / KMH_TO_MPH, 130 / KMH_TO_MPH]]]
    : [['0–100 km/h', 100], ['0–200 km/h', 200], ['100–200 km/h', [100, 200]]];
}

function fmtSpeed(kmh) {
  return displayUnit === 'mph' ? Math.round(kmh * KMH_TO_MPH) : Math.round(kmh);
}
function unitLabel() { return displayUnit === 'mph' ? 'mph' : 'km/h'; }

function onSample(v, paint) {
  const speedKmh = Number(v.speed);
  if (!Number.isFinite(speedKmh)) return;
  const now = Date.now();

  if (!run) {
    // Arm when nearly stationary.
    if (speedKmh < 2) {
      run = { startT: null, lastT: now, lastSpeed: speedKmh, distM: 0,
              marks: {}, quarterMileS: null, done: false };
      paint.armed(speedKmh);
      return;
    }
    paint.idle(speedKmh);
    return;
  }

  // Active run: integrate distance, mark threshold crossings.
  const dt = (now - run.lastT) / 1000;
  run.distM += (run.lastSpeed / 3.6) * dt;
  run.lastT = now; run.lastSpeed = speedKmh;

  if (run.startT === null && speedKmh >= 2) run.startT = now;
  if (run.startT !== null) {
    for (const [label, target] of thresholds()) {
      if (run.marks[label]) continue;
      if (Array.isArray(target)) {
        // Rolling test (e.g. 100–200): needs both crossings in one run.
        run._roll = run._roll || {};
        if (!run._roll[label] && speedKmh >= target[0]) run._roll[label] = now;
        if (run._roll[label] && speedKmh >= target[1]) {
          run.marks[label] = (now - run._roll[label]) / 1000;
        }
      } else if (speedKmh >= target) {
        run.marks[label] = (now - run.startT) / 1000;
      }
    }
    if (!run.quarterMileS && run.distM >= QUARTER_MILE_M) {
      run.quarterMileS = (now - run.startT) / 1000;
    }
  }

  // Run ends when the car slows to ~stop again after launching.
  if (run.startT !== null && speedKmh < 2 && now - run.startT > 3000) {
    finishRun(paint);
    return;
  }
  paint.live(speedKmh, run);
}

function finishRun(paint) {
  if (run && Object.keys(run.marks).length) {
    runs.unshift({
      date: new Date().toISOString(),
      unit: unitLabel(),
      times: { ...run.marks },
      quarterMileS: run.quarterMileS,
    });
    paint.finished(runs[0]);
  }
  run = null;
}

function toCsv() {
  const labels = ['0–60 mph', '0–100 mph', '60–130 mph', '0–100 km/h', '0–200 km/h', '100–200 km/h'];
  const header = ['date', 'unit', ...labels, 'quarter_mile_s'].join(',');
  const body = runs.map(r =>
    [r.date, r.unit, ...labels.map(l => (r.times[l] ?? '')), (r.quarterMileS ?? '')].join(',')
  ).join('\n');
  return header + '\n' + body + '\n';
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'Performance Meter',
    render(container) {
      container.innerHTML =
        '<div style="font-family:sans-serif;max-width:640px;">' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
            '<button id="pm-toggle" style="padding:6px 12px;">Start meter</button>' +
            '<button id="pm-unit" style="padding:6px 12px;">Units: km/h</button>' +
            '<button id="pm-save" style="padding:6px 12px;" disabled>Export CSV</button>' +
          '</div>' +
          '<div id="pm-status" style="margin:14px 0;padding:16px;border-radius:8px;background:#eceff1;' +
            'font-size:15px;">Meter stopped.</div>' +
          '<div id="pm-current" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;"></div>' +
          '<h4 style="margin:12px 0 6px;">Previous runs</h4>' +
          '<div id="pm-history" style="font-size:13px;color:#444;">None yet.</div>' +
          '<p style="font-size:12px;color:#777;margin-top:12px;">Launch detection: come to a stop, ' +
          'wait for "ARMED", then go. The run saves when you stop again. Accuracy depends on the ' +
          'speed-PID update rate — typically ±0.1–0.2 s vs GPS.</p>' +
        '</div>';

      const statusBox = container.querySelector('#pm-status');
      const currentBox = container.querySelector('#pm-current');
      const historyBox = container.querySelector('#pm-history');
      const toggleBtn = container.querySelector('#pm-toggle');
      const unitBtn = container.querySelector('#pm-unit');
      const saveBtn = container.querySelector('#pm-save');
      let running = false;

      function chip(label, val) {
        return '<div style="border:1px solid #ccc;border-radius:6px;padding:8px 14px;min-width:110px;">' +
          '<div style="font-size:11px;color:#777;">' + label + '</div>' +
          '<div style="font-size:20px;font-weight:700;">' + val + '</div></div>';
      }

      const paint = {
        idle(s) { statusBox.style.background = '#eceff1';
          statusBox.textContent = 'Rolling… ' + fmtSpeed(s) + ' ' + unitLabel() + '. Stop to arm.'; },
        armed(s) { statusBox.style.background = '#e8f5e9';
          statusBox.textContent = '🟢 ARMED — launch when ready.'; },
        live(s, r) {
          statusBox.style.background = '#fff3e0';
          statusBox.textContent = '🏁 ' + fmtSpeed(s) + ' ' + unitLabel() +
            (r.startT !== null ? ' · ' + ((Date.now() - r.startT) / 1000).toFixed(2) + ' s' : '');
          currentBox.innerHTML = Object.entries(r.marks)
            .map(([l, t]) => chip(l, t.toFixed(2) + ' s')).join('') +
            (r.quarterMileS ? chip('¼ mile', r.quarterMileS.toFixed(2) + ' s') : '');
        },
        finished(r) {
          statusBox.style.background = '#e8f5e9';
          statusBox.textContent = 'Run saved. Stop counted at ' + r.date.slice(11, 19) + '.';
          context.ui.notify('Performance run saved (' + Object.keys(r.times).length + ' splits).');
          saveBtn.disabled = false;
          historyBox.innerHTML = runs.slice(0, 10).map(x => {
            const splits = Object.entries(x.times)
              .map(([l, t]) => l + ': <strong>' + t.toFixed(2) + ' s</strong>').join(' · ');
            return '<div style="padding:4px 0;border-bottom:1px solid #eee;">' +
              x.date.slice(0, 19).replace('T', ' ') + ' — ' + splits +
              (x.quarterMileS ? ' · ¼ mile: <strong>' + x.quarterMileS.toFixed(2) + ' s</strong>' : '') +
              '</div>';
          }).join('');
        },
      };

      toggleBtn.onclick = () => {
        running = !running;
        toggleBtn.textContent = running ? 'Stop meter' : 'Start meter';
        if (running) {
          run = null;
          unsubscribe = context.vehicle.subscribeLive(['speed'], v => onSample(v, paint));
          statusBox.textContent = 'Meter running. Come to a stop to arm.';
        } else {
          if (unsubscribe) { unsubscribe(); unsubscribe = null; }
          run = null;
          statusBox.textContent = 'Meter stopped.';
        }
      };

      unitBtn.onclick = () => {
        displayUnit = displayUnit === 'kmh' ? 'mph' : 'kmh';
        unitBtn.textContent = 'Units: ' + (displayUnit === 'kmh' ? 'km/h' : 'mph');
      };

      saveBtn.onclick = async () => {
        if (!runs.length) return;
        const name = 'beemuu-perf-' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
        await context.fs.writeFile(name, toCsv());
        context.ui.notify('Saved ' + name + ' (' + runs.length + ' runs).');
      };
    }
  });
}

export function deactivate() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  run = null; runs = [];
}
