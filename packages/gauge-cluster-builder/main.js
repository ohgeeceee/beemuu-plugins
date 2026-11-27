// Gauge Cluster Builder — custom live-data dashboards.
// Add gauges (dial / bar / digital) for any PID, arrange them in a grid,
// and save named layouts that persist between sessions.

const LAYOUT_FILE = 'gauge-layouts.json';

let unsubscribe = null;
let layouts = {};           // name -> [{pid, type, min, max, unit}]
let activeLayout = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

// --- gauge renderers (pure SVG/HTML, updated per live sample) ---

function dialSvg(g, value) {
  const W = 120, H = 78, CX = 60, CY = 66, R = 48;
  const span = (g.max - g.min) || 1;
  const frac = Math.max(0, Math.min(1, (value - g.min) / span));
  const a0 = Math.PI, a1 = Math.PI + frac * Math.PI; // 180° sweep, left→right
  const nx = CX + R * Math.cos(a1), ny = CY + R * Math.sin(a1);
  const arc = (f0, f1, color, w) => {
    const x0 = CX + R * Math.cos(Math.PI + f0 * Math.PI), y0 = CY + R * Math.sin(Math.PI + f0 * Math.PI);
    const x1 = CX + R * Math.cos(Math.PI + f1 * Math.PI), y1 = CY + R * Math.sin(Math.PI + f1 * Math.PI);
    return '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + R + ' ' + R +
      ' 0 0 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + '" stroke="' + color +
      '" stroke-width="' + w + '" fill="none" stroke-linecap="round"/>';
  };
  const hot = frac > 0.85;
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
    arc(0, 1, '#ddd', 8) +
    (frac > 0 ? arc(0, frac, hot ? '#d32f2f' : '#1976d2', 8) : '') +
    '<line x1="' + CX + '" y1="' + CY + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) +
      '" stroke="#333" stroke-width="2.5" stroke-linecap="round"/>' +
    '<circle cx="' + CX + '" cy="' + CY + '" r="4" fill="#333"/>' +
    '<text x="10" y="' + (H - 4) + '" font-size="9" fill="#888">' + esc(String(g.min)) + '</text>' +
    '<text x="' + (W - 24) + '" y="' + (H - 4) + '" font-size="9" fill="#888">' + esc(String(g.max)) + '</text>' +
    '<text x="' + CX + '" y="' + (CY - 22) + '" font-size="15" font-weight="700" text-anchor="middle" fill="' +
      (hot ? '#d32f2f' : '#222') + '">' + (value === null ? '—' : Math.round(value * 10) / 10) + '</text>' +
  '</svg>';
}

function barHtml(g, value) {
  const span = (g.max - g.min) || 1;
  const frac = value === null ? 0 : Math.max(0, Math.min(1, (value - g.min) / span));
  const pct = Math.round(frac * 100);
  const color = frac > 0.85 ? '#d32f2f' : '#1976d2';
  return '<div style="margin:6px 0;">' +
    '<div style="height:14px;background:#e0e0e0;border-radius:7px;overflow:hidden;">' +
      '<div style="height:100%;width:' + pct + '%;background:' + color + ';transition:width .15s;"></div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:11px;color:#777;">' +
      '<span>' + esc(String(g.min)) + '</span>' +
      '<strong style="color:#222;font-size:14px;">' + (value === null ? '—' : Math.round(value * 10) / 10) + '</strong>' +
      '<span>' + esc(String(g.max)) + '</span></div></div>';
}

function digitalHtml(g, value) {
  return '<div style="text-align:center;padding:10px 0;">' +
    '<span style="font-size:30px;font-weight:700;font-variant-numeric:tabular-nums;">' +
      (value === null ? '——' : Math.round(value * 10) / 10) + '</span></div>';
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'Gauge Cluster',
    render(container) {
      container.innerHTML =
        '<div style="font-family:sans-serif;">' +
          '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">' +
            '<select id="gc-layout" style="padding:6px;"></select>' +
            '<button id="gc-new" style="padding:6px 10px;">New layout</button>' +
            '<button id="gc-save" style="padding:6px 10px;">Save layout</button>' +
            '<span style="flex:1;"></span>' +
            '<input id="gc-pid" placeholder="PID" style="padding:6px;width:130px;">' +
            '<select id="gc-type" style="padding:6px;"><option value="dial">dial</option>' +
              '<option value="bar">bar</option><option value="digital">digital</option></select>' +
            '<input id="gc-min" placeholder="min" type="number" step="any" style="padding:6px;width:64px;">' +
            '<input id="gc-max" placeholder="max" type="number" step="any" style="padding:6px;width:64px;">' +
            '<input id="gc-unit" placeholder="unit" style="padding:6px;width:56px;">' +
            '<button id="gc-add" style="padding:6px 10px;">+ gauge</button>' +
          '</div>' +
          '<div id="gc-grid" style="display:flex;flex-wrap:wrap;gap:10px;"></div>' +
          '<p style="font-size:12px;color:#777;margin-top:10px;">Examples: boost 0–2 bar · ' +
          'coolant_temp 60–130 °C · rpm 0–7000 · battery_voltage 10–15 V</p>' +
        '</div>';

      const grid = container.querySelector('#gc-grid');
      const layoutSel = container.querySelector('#gc-layout');

      function gauges() { return layouts[activeLayout] || (layouts[activeLayout] = []); }

      function resubscribe() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        const pids = [...new Set(gauges().map(g => g.pid))];
        if (!pids.length) return;
        unsubscribe = context.vehicle.subscribeLive(pids, values => {
          gauges().forEach((g, i) => {
            const v = Number(values[g.pid]);
            const val = Number.isFinite(v) ? v : null;
            const box = grid.querySelector('[data-slot="' + i + '"] .gc-val');
            if (!box) return;
            if (g.type === 'dial') box.innerHTML = dialSvg(g, val);
            else if (g.type === 'bar') box.innerHTML = barHtml(g, val);
            else box.innerHTML = digitalHtml(g, val);
          });
        });
      }

      function paintGrid() {
        grid.innerHTML = '';
        gauges().forEach((g, i) => {
          const card = document.createElement('div');
          card.dataset.slot = i;
          card.style.cssText = 'border:1px solid #ccc;border-radius:8px;padding:8px 10px;min-width:150px;' +
            'position:relative;background:#fff;';
          card.innerHTML =
            '<div style="font-size:12px;color:#555;display:flex;justify-content:space-between;gap:8px;">' +
              '<span>' + esc(g.pid) + (g.unit ? ' (' + esc(g.unit) + ')' : '') + '</span>' +
              '<button data-rm="' + i + '" style="border:none;background:none;cursor:pointer;color:#999;">✕</button>' +
            '</div><div class="gc-val"></div>';
          grid.appendChild(card);
        });
        grid.querySelectorAll('button[data-rm]').forEach(btn => {
          btn.onclick = () => { gauges().splice(Number(btn.dataset.rm), 1); paintGrid(); resubscribe(); };
        });
        resubscribe();
      }

      function paintLayoutSel() {
        layoutSel.innerHTML = Object.keys(layouts)
          .map(n => '<option value="' + esc(n) + '"' + (n === activeLayout ? ' selected' : '') + '>' +
            esc(n) + '</option>').join('');
      }

      async function saveLayouts() {
        try {
          await context.fs.writeFile(LAYOUT_FILE, JSON.stringify(layouts, null, 2));
          context.ui.notify('Layouts saved.');
        } catch (err) { context.ui.notify('Save failed: ' + err.message); }
      }

      container.querySelector('#gc-add').onclick = () => {
        const pid = container.querySelector('#gc-pid').value.trim();
        if (!pid) return;
        gauges().push({
          pid,
          type: container.querySelector('#gc-type').value,
          min: Number(container.querySelector('#gc-min').value) || 0,
          max: Number(container.querySelector('#gc-max').value) || 100,
          unit: container.querySelector('#gc-unit').value.trim(),
        });
        container.querySelector('#gc-pid').value = '';
        paintGrid();
      };

      container.querySelector('#gc-new').onclick = () => {
        const name = prompt('Layout name (e.g. "track", "daily", "winter"):');
        if (!name) return;
        layouts[name] = [];
        activeLayout = name;
        paintLayoutSel(); paintGrid();
      };

      container.querySelector('#gc-save').onclick = saveLayouts;
      layoutSel.onchange = () => { activeLayout = layoutSel.value; paintGrid(); };

      // Starter layout so the panel is never empty.
      if (!Object.keys(layouts).length) {
        layouts['daily'] = [
          { pid: 'rpm', type: 'dial', min: 0, max: 7000, unit: 'rpm' },
          { pid: 'speed', type: 'digital', min: 0, max: 260, unit: 'km/h' },
          { pid: 'coolant_temp', type: 'bar', min: 60, max: 130, unit: '°C' },
          { pid: 'battery_voltage', type: 'bar', min: 10, max: 15, unit: 'V' },
        ];
        activeLayout = 'daily';
      }
      paintLayoutSel();
      paintGrid();
    }
  });
}

export function deactivate() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
