// Live Data Watchdog — threshold alarms on any live PID.
// Define rules (PID + min and/or max). When a value leaves its allowed band
// for longer than the debounce period, the panel flashes, a beep sounds, and
// a host notification is raised. Rules persist to a JSON file.

const RULES_FILE = 'watchdog-rules.json';
const DEBOUNCE_MS = 1500;   // value must stay out of range this long to alarm
const REARM_MS = 10000;     // min time between repeated alarms for one rule

let unsubscribe = null;
let rules = [];             // {pid, min, max, label}
let state = {};             // pid -> {since, lastAlarm, active}

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function beep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = beep._ctx || (beep._ctx = new AC());
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch { /* audio unavailable — visual alarm still fires */ }
}

function check(values, onAlarm, paintRow) {
  const now = Date.now();
  for (const r of rules) {
    const v = Number(values[r.pid]);
    const st = state[r.pid] || (state[r.pid] = { since: 0, lastAlarm: 0, active: false });
    if (!Number.isFinite(v)) { st.since = 0; paintRow(r, null, false); continue; }
    const low = r.min !== '' && r.min !== null && r.min !== undefined && v < Number(r.min);
    const high = r.max !== '' && r.max !== null && r.max !== undefined && v > Number(r.max);
    const violated = low || high;
    if (violated) {
      if (!st.since) st.since = now;
      if (now - st.since >= DEBOUNCE_MS && now - st.lastAlarm >= REARM_MS) {
        st.lastAlarm = now; st.active = true;
        onAlarm(r, v, low ? 'below minimum' : 'above maximum');
      }
    } else {
      st.since = 0; st.active = false;
    }
    paintRow(r, v, st.active);
  }
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'Watchdog',
    render(container) {
      container.innerHTML =
        '<div style="font-family:sans-serif;max-width:640px;">' +
          '<div id="wd-flash" style="display:none;padding:10px;border-radius:6px;background:#b71c1c;' +
            'color:#fff;font-weight:700;margin-bottom:10px;"></div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
            '<input id="wd-pid" placeholder="PID (e.g. coolant_temp)" style="padding:6px;min-width:160px;">' +
            '<input id="wd-min" placeholder="min" type="number" step="any" style="padding:6px;width:80px;">' +
            '<input id="wd-max" placeholder="max" type="number" step="any" style="padding:6px;width:80px;">' +
            '<button id="wd-add" style="padding:6px 12px;">Add rule</button>' +
            '<button id="wd-toggle" style="padding:6px 12px;">Start monitoring</button>' +
          '</div>' +
          '<table style="border-collapse:collapse;width:100%;margin-top:10px;">' +
            '<thead><tr><th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">PID</th>' +
            '<th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">Allowed band</th>' +
            '<th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">Live</th>' +
            '<th style="padding:4px;border-bottom:1px solid #ccc;"></th></tr></thead>' +
            '<tbody id="wd-body"></tbody></table>' +
          '<p style="font-size:12px;color:#777;">Examples: coolant_temp max 115 · battery_voltage min 11.8 · boost max 1.4</p>' +
        '</div>';

      const body = container.querySelector('#wd-body');
      const flash = container.querySelector('#wd-flash');
      const toggleBtn = container.querySelector('#wd-toggle');
      let monitoring = false;

      function band(r) {
        const lo = (r.min === '' || r.min === null || r.min === undefined) ? '−∞' : r.min;
        const hi = (r.max === '' || r.max === null || r.max === undefined) ? '+∞' : r.max;
        return lo + ' … ' + hi;
      }

      function paintRow(r, v, alarm) {
        const row = body.querySelector('tr[data-pid="' + r.pid + '"]');
        if (!row) return;
        const liveCell = row.children[2];
        liveCell.textContent = v === null || v === undefined ? '—' : (Math.round(v * 100) / 100);
        row.style.background = alarm ? '#ff5252' : '';
        row.style.color = alarm ? '#fff' : '';
      }

      function paintTable() {
        body.innerHTML = '';
        for (const r of rules) {
          const tr = document.createElement('tr');
          tr.dataset.pid = r.pid;
          tr.innerHTML =
            '<td style="padding:4px;border-bottom:1px solid #eee;">' + esc(r.pid) + '</td>' +
            '<td style="padding:4px;border-bottom:1px solid #eee;">' + esc(band(r)) + '</td>' +
            '<td style="padding:4px;border-bottom:1px solid #eee;">—</td>' +
            '<td style="padding:4px;border-bottom:1px solid #eee;text-align:right;">' +
              '<button data-del="' + esc(r.pid) + '" style="padding:2px 8px;">✕</button></td>';
          body.appendChild(tr);
        }
        body.querySelectorAll('button[data-del]').forEach(btn => {
          btn.onclick = () => {
            rules = rules.filter(r => r.pid !== btn.dataset.del);
            delete state[btn.dataset.del];
            saveRules(); resubscribe(); paintTable();
          };
        });
      }

      async function saveRules() {
        try { await context.fs.writeFile(RULES_FILE, JSON.stringify(rules, null, 2)); }
        catch { /* persistence is best-effort */ }
      }

      function resubscribe() {
        if (!monitoring) return;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        const pids = [...new Set(rules.map(r => r.pid))];
        if (!pids.length) return;
        unsubscribe = context.vehicle.subscribeLive(pids, values => {
          check(values,
            (r, v, why) => {
              flash.style.display = 'block';
              flash.textContent = '⚠️ ' + r.pid + ' = ' + Math.round(v * 100) / 100 +
                ' (' + why + ' ' + (why.startsWith('below') ? r.min : r.max) + ')';
              beep();
              context.ui.notify('Watchdog: ' + r.pid + ' ' + why + ' (value ' + v + ')');
              clearTimeout(flash._t);
              flash._t = setTimeout(() => { flash.style.display = 'none'; }, 6000);
            },
            paintRow);
        });
      }

      container.querySelector('#wd-add').onclick = () => {
        const pid = container.querySelector('#wd-pid').value.trim();
        const min = container.querySelector('#wd-min').value;
        const max = container.querySelector('#wd-max').value;
        if (!pid) return;
        if ((min === '' || min === null) && (max === '' || max === null)) {
          context.ui.notify('Set at least a min or a max for the rule.');
          return;
        }
        rules = rules.filter(r => r.pid !== pid);
        rules.push({ pid, min: min === '' ? null : Number(min), max: max === '' ? null : Number(max) });
        container.querySelector('#wd-pid').value = '';
        container.querySelector('#wd-min').value = '';
        container.querySelector('#wd-max').value = '';
        saveRules(); resubscribe(); paintTable();
      };

      toggleBtn.onclick = () => {
        monitoring = !monitoring;
        toggleBtn.textContent = monitoring ? 'Stop monitoring' : 'Start monitoring';
        if (monitoring) { resubscribe(); }
        else if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      };

      paintTable();
    }
  });
}

export function deactivate() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  rules = []; state = {};
}
