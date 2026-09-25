// Live Data Logger — records live sensor streams to CSV.

let unsubscribe = null;
let rows = [];
let pids = [];

function toCsv() {
  const header = ['timestamp_iso', ...pids].join(',');
  const body = rows.map(r =>
    [r.t, ...pids.map(p => (r.values[p] ?? ''))].join(',')
  ).join('\n');
  return header + '\n' + body + '\n';
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'Live Data Logger',
    render(container) {
      container.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-family:sans-serif;">
          <input id="ldl-pids" placeholder="PIDs, comma-separated (e.g. rpm,coolant_temp,speed)"
                 style="padding:6px;min-width:280px;">
          <button id="ldl-start" style="padding:6px 12px;">Start</button>
          <button id="ldl-stop" style="padding:6px 12px;" disabled>Stop &amp; save CSV</button>
          <span id="ldl-status"></span>
        </div>`;
      const input = container.querySelector('#ldl-pids');
      const startBtn = container.querySelector('#ldl-start');
      const stopBtn = container.querySelector('#ldl-stop');
      const status = container.querySelector('#ldl-status');

      startBtn.onclick = () => {
        pids = input.value.split(',').map(s => s.trim()).filter(Boolean);
        if (!pids.length) { status.textContent = 'Enter at least one PID.'; return; }
        rows = [];
        unsubscribe = context.vehicle.subscribeLive(pids, values => {
          rows.push({ t: new Date().toISOString(), values });
          status.textContent = rows.length + ' samples';
        });
        startBtn.disabled = true; stopBtn.disabled = false;
      };

      stopBtn.onclick = async () => {
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        const name = 'beemuu-live-' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
        await context.fs.writeFile(name, toCsv());
        context.ui.notify('Saved ' + name + ' (' + rows.length + ' samples).');
        startBtn.disabled = false; stopBtn.disabled = true;
        status.textContent = '';
      };
    }
  });
}

export function deactivate() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
