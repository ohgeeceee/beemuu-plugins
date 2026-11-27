// Fuel Trim Health — long-term fuel-trim monitoring with trend diagnosis.
// Watches STFT/LTFT per bank, keeps session statistics, exports CSV logs,
// and translates the numbers into a plain-English health verdict.

const PIDS = ['stft_bank1', 'ltft_bank1', 'stft_bank2', 'ltft_bank2', 'rpm', 'coolant_temp'];
const WARM_C = 75;          // ignore trims below this coolant temp (open loop / warm-up)
const LEARN_MIN_SAMPLES = 30;

let unsubscribe = null;
let samples = [];           // {t, rpm, coolant, stft1, ltft1, stft2, ltft2}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function avg(list) { return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null; }
function fmt(v, unit) { return v === null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + (unit || ''); }

function diagnose(warm) {
  // warm: samples with coolant temp above threshold
  if (warm.length < LEARN_MIN_SAMPLES) {
    return { level: 'info', text: 'Collecting data… need ' + (LEARN_MIN_SAMPLES - warm.length) +
      ' more warm-engine samples before a verdict.' };
  }
  const lt1 = avg(warm.map(s => s.ltft1).filter(v => v !== null));
  const lt2raw = warm.map(s => s.ltft2).filter(v => v !== null);
  const lt2 = lt2raw.length ? avg(lt2raw) : null;
  const banks = lt2 === null ? [['bank 1', lt1]] : [['bank 1', lt1], ['bank 2', lt2]];
  const worst = banks.reduce((a, b) => (Math.abs(b[1] ?? 0) > Math.abs(a[1] ?? 0) ? b : a));
  const [name, lt] = worst;

  if (lt !== null && lt > 10) {
    return { level: 'bad', text: name + ' long-term trim is ' + fmt(lt, '%') +
      ' — the ECU is adding a lot of fuel. Classic signs: vacuum/intake leak, weak fuel pump, ' +
      'or dirty MAF. Smoke-test the intake first.' };
  }
  if (lt !== null && lt < -10) {
    return { level: 'bad', text: name + ' long-term trim is ' + fmt(lt, '%') +
      ' — the ECU is removing fuel. Suspect a leaking injector, stuck EVAP purge valve, ' +
      'or excessive fuel pressure.' };
  }
  const spread = lt2 !== null && lt1 !== null ? Math.abs(lt1 - lt2) : 0;
  if (spread > 5) {
    return { level: 'warn', text: 'Bank-to-bank LTFT spread is ' + spread.toFixed(1) +
      ' points — one bank is compensating much more than the other. Check bank-specific ' +
      'items: O2 sensor, injectors, exhaust leaks on that side.' };
  }
  return { level: 'good', text: 'Fuel trims look healthy (banks within ±10% and close together). ' +
    'Keep logging — a slow drift over weeks is the early warning this plugin watches for.' };
}

function toCsv() {
  const header = 'timestamp_iso,rpm,coolant_temp,stft_bank1,ltft_bank1,stft_bank2,ltft_bank2';
  const body = samples.map(s =>
    [s.t, s.rpm ?? '', s.coolant ?? '', s.stft1 ?? '', s.ltft1 ?? '', s.stft2 ?? '', s.ltft2 ?? ''].join(',')
  ).join('\n');
  return header + '\n' + body + '\n';
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'Fuel Trim Health',
    render(container) {
      container.innerHTML =
        '<div style="font-family:sans-serif;max-width:640px;">' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
            '<button id="ft-toggle" style="padding:6px 12px;">Start logging</button>' +
            '<button id="ft-save" style="padding:6px 12px;" disabled>Save CSV</button>' +
            '<span id="ft-count" style="color:#666;font-size:13px;"></span>' +
          '</div>' +
          '<div id="ft-verdict" style="margin:12px 0;padding:12px;border-radius:6px;background:#eceff1;"></div>' +
          '<table style="border-collapse:collapse;width:100%;">' +
            '<thead><tr>' +
              '<th style="text-align:left;padding:4px;border-bottom:1px solid #ccc;">Bank</th>' +
              '<th style="text-align:right;padding:4px;border-bottom:1px solid #ccc;">STFT now</th>' +
              '<th style="text-align:right;padding:4px;border-bottom:1px solid #ccc;">LTFT now</th>' +
              '<th style="text-align:right;padding:4px;border-bottom:1px solid #ccc;">LTFT session avg</th>' +
            '</tr></thead>' +
            '<tbody>' +
              '<tr><td style="padding:4px;">Bank 1</td>' +
                '<td id="ft-s1" style="text-align:right;padding:4px;">—</td>' +
                '<td id="ft-l1" style="text-align:right;padding:4px;">—</td>' +
                '<td id="ft-a1" style="text-align:right;padding:4px;">—</td></tr>' +
              '<tr><td style="padding:4px;">Bank 2</td>' +
                '<td id="ft-s2" style="text-align:right;padding:4px;">—</td>' +
                '<td id="ft-l2" style="text-align:right;padding:4px;">—</td>' +
                '<td id="ft-a2" style="text-align:right;padding:4px;">—</td></tr>' +
            '</tbody></table>' +
          '<p style="font-size:12px;color:#777;margin-top:10px;">Trims are only judged once coolant ' +
          'temp is above ' + WARM_C + ' °C. Healthy is roughly ±5%; beyond ±10% means the ECU is ' +
          'working hard to correct a problem.</p>' +
        '</div>';

      const toggleBtn = container.querySelector('#ft-toggle');
      const saveBtn = container.querySelector('#ft-save');
      const count = container.querySelector('#ft-count');
      const verdictBox = container.querySelector('#ft-verdict');
      const el = id => container.querySelector('#' + id);
      let logging = false;

      function paint(v) {
        const s = { t: new Date().toISOString(),
          rpm: num(v.rpm), coolant: num(v.coolant_temp),
          stft1: num(v.stft_bank1), ltft1: num(v.ltft_bank1),
          stft2: num(v.stft_bank2), ltft2: num(v.ltft_bank2) };
        samples.push(s);
        count.textContent = samples.length + ' samples';

        el('ft-s1').textContent = fmt(s.stft1, '%');
        el('ft-l1').textContent = fmt(s.ltft1, '%');
        el('ft-s2').textContent = fmt(s.stft2, '%');
        el('ft-l2').textContent = fmt(s.ltft2, '%');

        const warm = samples.filter(x => x.coolant === null || x.coolant >= WARM_C);
        el('ft-a1').textContent = fmt(avg(warm.map(x => x.ltft1).filter(y => y !== null)), '%');
        el('ft-a2').textContent = fmt(avg(warm.map(x => x.ltft2).filter(y => y !== null)), '%');

        const d = diagnose(warm);
        verdictBox.style.background = { good: '#e8f5e9', warn: '#fff8e1', bad: '#ffebee', info: '#eceff1' }[d.level];
        verdictBox.style.color = { good: '#1b5e20', warn: '#e65100', bad: '#b71c1c', info: '#37474f' }[d.level];
        verdictBox.textContent = d.text;
      }

      toggleBtn.onclick = () => {
        logging = !logging;
        toggleBtn.textContent = logging ? 'Stop logging' : 'Start logging';
        saveBtn.disabled = !logging && !samples.length;
        if (logging) {
          unsubscribe = context.vehicle.subscribeLive(PIDS, paint);
        } else if (unsubscribe) {
          unsubscribe(); unsubscribe = null;
          saveBtn.disabled = false;
        }
      };

      saveBtn.onclick = async () => {
        if (!samples.length) return;
        const name = 'beemuu-fueltrims-' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
        await context.fs.writeFile(name, toCsv());
        context.ui.notify('Saved ' + name + ' (' + samples.length + ' samples).');
      };
    }
  });
}

export function deactivate() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  samples = [];
}
