// DTC Explainer — turns raw fault codes into plain-English guidance.
// Ships with an offline database of common BMW codes plus generic OBD-II
// family fallbacks. No network access; works fully offline.

// severity: 'stop' = stop driving soon, 'caution' = drive gently, fix soon,
//           'ok' = safe short-term, plan a fix.
const DB = {
  '29F1': { title: 'Fuel rail pressure too low (low-pressure side)', severity: 'caution',
    meaning: 'The DME sees fuel pressure below target, most often on N54/N55 engines.',
    causes: ['Failing high-pressure fuel pump (HPFP)', 'Weak in-tank low-pressure pump', 'Clogged fuel filter', 'Faulty fuel pressure sensor'],
    fix: 'Log rail pressure at idle and under load. If pressure sags under load, the HPFP is the prime suspect on N54 engines.',
    cost: '$400–$1,200 (HPFP)' },
  '29F2': { title: 'Fuel rail pressure too low (high-pressure side)', severity: 'caution',
    meaning: 'High-pressure fuel system cannot reach target pressure.',
    causes: ['Failing HPFP', 'Stuck volume control valve', 'Fuel starvation from the low-pressure side'],
    fix: 'Check low-pressure supply first; if it is stable, replace the HPFP.',
    cost: '$400–$1,200 (HPFP)' },
  '2A87': { title: 'VANOS exhaust camshaft: jammed / stiff', severity: 'caution',
    meaning: 'The exhaust VANOS unit cannot move the camshaft as commanded. Rough idle and power loss are typical.',
    causes: ['Dirty VANOS solenoids', 'Worn camshaft ledge / bearing ring', 'Sludge from stretched oil-change intervals'],
    fix: 'Swap intake/exhaust VANOS solenoids and see if the fault follows. Clean or replace solenoids first — cheapest fix.',
    cost: '$60–$250 (solenoids), more if the ledge is worn' },
  '2A98': { title: 'Crankshaft–intake camshaft correlation', severity: 'caution',
    meaning: 'Cam timing does not match crank position; the chain may have stretched or a tensioner is weak.',
    causes: ['Stretched timing chain', 'Failing chain tensioner', 'VANOS fault'],
    fix: 'Do not ignore — a jumped chain can destroy the engine. Have chain stretch measured.',
    cost: '$1,500–$3,000 (chain job)' },
  '30FF': { title: 'Boost pressure below target', severity: 'ok',
    meaning: 'The turbo(s) cannot reach commanded boost. Usually a leak, not a dead turbo.',
    causes: ['Cracked charge pipe (very common on N54/N55)', 'Loose intercooler coupler', 'Worn diverter/wastegate', 'Vacuum line leak'],
    fix: 'Pressure-test the charge system. Inspect charge pipes and couplers before blaming the turbo.',
    cost: '$0–$300 (pipes/couplers)' },
  '29CC': { title: 'Cylinder 1 misfire', severity: 'caution',
    meaning: 'Misfire detected on cylinder 1. Often accompanied by 29CD–29CF siblings.',
    causes: ['Failed ignition coil', 'Worn spark plug', 'Leaking injector', 'Low compression'],
    fix: 'Swap the coil with another cylinder. If the misfire follows the coil, replace it.',
    cost: '$30–$80 (coil), $60–$150 (plugs)' },
  '29CD': { title: 'Cylinder 2 misfire', severity: 'caution',
    meaning: 'Misfire detected on cylinder 2.', causes: ['Ignition coil', 'Spark plug', 'Injector', 'Compression'],
    fix: 'Coil/plug swap test, as with 29CC.', cost: '$30–$150' },
  '29CE': { title: 'Cylinder 3 misfire', severity: 'caution',
    meaning: 'Misfire detected on cylinder 3.', causes: ['Ignition coil', 'Spark plug', 'Injector', 'Compression'],
    fix: 'Coil/plug swap test, as with 29CC.', cost: '$30–$150' },
  '29CF': { title: 'Cylinder 4 misfire', severity: 'caution',
    meaning: 'Misfire detected on cylinder 4.', causes: ['Ignition coil', 'Spark plug', 'Injector', 'Compression'],
    fix: 'Coil/plug swap test, as with 29CC.', cost: '$30–$150' },
  '2C57': { title: 'Boost pressure control: lower value reached', severity: 'ok',
    meaning: 'The DME stopped requesting boost because actual boost exceeded limits.',
    causes: ['Sticking wastegate', 'Faulty boost solenoid', 'Over-aggressive tune'],
    fix: 'Check wastegate actuator play and boost solenoid hoses.',
    cost: '$0–$400' },
  '2DED': { title: 'Throttle valve: adaptation fault', severity: 'caution',
    meaning: 'Throttle body adaptation failed; idle and throttle response suffer.',
    causes: ['Dirty throttle body', 'Failing throttle motor', 'Wiring/connector issue'],
    fix: 'Clean the throttle body and reset adaptations before replacing parts.',
    cost: '$0–$250' },
  '2E7C': { title: 'BSD bus communication fault', severity: 'caution',
    meaning: 'The DME lost contact with a device on the BSD bus (alternator, oil level sensor, water pump, IBS).',
    causes: ['Failing water pump', 'Faulty oil-level sensor', 'Damaged BSD wiring'],
    fix: 'Unplug BSD devices one at a time to isolate which one kills the bus.',
    cost: '$100–$900 (water pump is the expensive one)' },
  '3100': { title: 'Boost pressure deactivated / limp mode', severity: 'caution',
    meaning: 'The engine entered limp mode, usually triggered by another fault (overboost, knock, fuel pressure).',
    causes: ['Look at the other codes stored — this one is a symptom, not the cause'],
    fix: 'Fix the underlying fault code first, clear, and re-test.',
    cost: 'Depends on root cause' },
  '2E0F': { title: 'Valvetronic: eccentric shaft fault', severity: 'caution',
    meaning: 'The Valvetronic system cannot control valve lift; the engine runs in a reduced-power fallback.',
    causes: ['Worn eccentric shaft sensor (oil-contaminated)', 'Failing Valvetronic motor', 'Worn eccentric shaft gear'],
    fix: 'Replace the eccentric shaft sensor and its gasket first — the classic fix.',
    cost: '$150–$500 (sensor), $800+ (motor/shaft)' },
  '2A67': { title: 'Valvetronic eccentric shaft sensor: signal implausible', severity: 'caution',
    meaning: 'The DME distrusts the eccentric shaft position reading.',
    causes: ['Oil-fouled sensor', 'Sensor connector corrosion', 'Worn shaft'],
    fix: 'Pull the sensor and inspect for oil intrusion; replace with a new sealing ring.',
    cost: '$150–$400' },
  '4530': { title: 'DPF: differential pressure too high', severity: 'caution',
    meaning: 'The diesel particulate filter is loading up with soot; regeneration is needed or has failed.',
    causes: ['Interrupted regens (short trips)', 'Failed differential-pressure sensor', 'Genuine end-of-life DPF'],
    fix: 'Force a regeneration drive (30+ min highway) before replacing hardware. Log soot mass if possible.',
    cost: '$0 (regen) – $1,500+ (DPF)' },
  '480A': { title: 'Brake pad wear sensor: threshold reached', severity: 'caution',
    meaning: 'A brake pad wear sensor circuit reports worn pads (or a broken sensor wire).',
    causes: ['Pads at wear limit', 'Damaged wear sensor', 'Sensor not replaced with pads'],
    fix: 'Inspect pads; replace pads and the sensor together. Reset the CBS counter after.',
    cost: '$150–$500 (pads + sensor)' },
  '5DF0': { title: 'DSC: pump motor fault', severity: 'stop',
    meaning: 'The ABS/DSC hydraulic pump reports an internal fault — stability control and ABS may be disabled.',
    causes: ['Failed DSC pump/module', 'Corroded module connector'],
    fix: 'This is a safety system; diagnose promptly. Module repair services are much cheaper than a new unit.',
    cost: '$150 (repair) – $1,200 (new module)' },
  '5DF1': { title: 'DSC: pump motor relay fault', severity: 'stop',
    meaning: 'The DSC module cannot energize the pump relay.',
    causes: ['Failed relay inside the DSC module', 'Wiring/fuse issue'],
    fix: 'Check fuses and main power feed to the module before condemning it.',
    cost: '$0 (fuse) – $1,200 (module)' },
  'A0B4': { title: 'CAS: engine start fault / starter relay', severity: 'stop',
    meaning: 'The car access system refused or failed to crank the engine.',
    causes: ['Weak battery', 'Failing starter', 'CAS module fault', 'Brake/clutch switch signal missing'],
    fix: 'Check battery voltage first — low voltage causes a flood of CAS faults.',
    cost: '$0 (battery charge) – $600 (starter)' },
};

// Generic OBD-II family fallbacks for codes not in the BMW-specific DB.
const FAMILIES = [
  { re: /^P030([0-9])/, title: 'Cylinder $1 misfire detected', severity: 'caution',
    meaning: 'The ECU detected a misfire on cylinder $1.',
    causes: ['Ignition coil', 'Spark plug', 'Fuel injector', 'Compression loss'],
    fix: 'Swap the coil to another cylinder; if the misfire follows, replace the coil.',
    cost: '$30–$150' },
  { re: /^P017[12]/, title: 'System too lean', severity: 'caution',
    meaning: 'The engine is running lean (too much air / not enough fuel) on one bank.',
    causes: ['Vacuum/intake leak', 'Dirty MAF', 'Weak fuel pump', 'Exhaust leak before the O2 sensor'],
    fix: 'Smoke-test the intake. Check long-term fuel trims — high positive trims confirm unmetered air.',
    cost: '$0–$400' },
  { re: /^P017[45]/, title: 'System too rich', severity: 'caution',
    meaning: 'The engine is running rich on one bank.',
    causes: ['Leaking injector', 'Faulty O2 sensor', 'High fuel pressure', 'EVAP purge valve stuck open'],
    fix: 'Check fuel trims and inspect the purge valve first — it is cheap and common.',
    cost: '$50–$400' },
  { re: /^P04[2-4]0/, title: 'Catalyst efficiency below threshold', severity: 'ok',
    meaning: 'The downstream O2 sensor shows the catalytic converter is not cleaning exhaust as expected.',
    causes: ['Aged catalyst', 'Exhaust leak', 'Lazy downstream O2 sensor', 'Long-term misfire damage'],
    fix: 'Fix any misfires first; they kill cats. Then graph both O2 sensors to confirm.',
    cost: '$0–$1,500 (cat)' },
  { re: /^P0[1-3]/, title: 'Powertrain fault (generic)', severity: 'ok',
    meaning: 'A generic OBD-II powertrain fault without a BMW-specific entry in this database yet.',
    causes: ['Look up the exact code in the BMW TIS/ISTA documentation or community forums'],
    fix: 'Read freeze-frame data for the conditions when it set.',
    cost: 'Unknown' },
  { re: /^U0/, title: 'Network/communication fault', severity: 'caution',
    meaning: 'Modules on the CAN bus lost communication with each other.',
    causes: ['Low battery voltage', 'Corroded connector', 'Failing module', 'Aftermarket device on the bus'],
    fix: 'Check battery voltage and scan ALL modules — the quiet one is usually the culprit.',
    cost: '$0–$500' },
];

const SEVERITY_LABEL = {
  stop: ['⛔ Stop driving soon', 'This fault can affect safety or cause serious engine damage.'],
  caution: ['⚠️ Drive gently, fix soon', 'Short trips are usually OK, but do not ignore it.'],
  ok: ['✅ Safe short-term', 'Not urgent, but plan the repair before it grows.'],
};

function lookup(code) {
  const c = String(code).toUpperCase().trim();
  if (DB[c]) return { code: c, ...DB[c] };
  for (const f of FAMILIES) {
    const m = c.match(f.re);
    if (m) {
      return { code: c, title: f.title.replace(/\$1/g, m[1]), severity: f.severity,
        meaning: f.meaning.replace(/\$1/g, m[1]), causes: f.causes, fix: f.fix, cost: f.cost };
    }
  }
  return { code: c, title: 'Unknown code', severity: 'ok',
    meaning: 'No entry in the offline database for this code.',
    causes: ['Check BMW TIS/ISTA documentation', 'Search Beemuu community forums'],
    fix: 'Capture freeze-frame data and note driving conditions when it set.',
    cost: 'Unknown' };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function renderCard(container, dtc) {
  const info = lookup(dtc.code);
  const [badge, advice] = SEVERITY_LABEL[info.severity];
  const color = { stop: '#c62828', caution: '#ef6c00', ok: '#2e7d32' }[info.severity];
  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid #ccc;border-left:5px solid ' + color +
    ';border-radius:6px;padding:12px 16px;margin:10px 0;font-family:sans-serif;';
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">' +
      '<strong style="font-size:15px;">' + esc(info.code) + ' — ' + esc(info.title) + '</strong>' +
      '<span style="color:' + color + ';font-weight:600;">' + badge + '</span>' +
    '</div>' +
    '<p style="margin:8px 0 4px;">' + esc(info.meaning) + '</p>' +
    '<p style="margin:4px 0;color:#555;"><em>' + esc(advice) + '</em></p>' +
    (dtc.ecu ? '<div style="font-size:12px;color:#777;">ECU: ' + esc(dtc.ecu) +
      (dtc.status ? ' · Status: ' + esc(dtc.status) : '') + '</div>' : '') +
    '<div style="margin-top:8px;"><strong>Likely causes (most common first):</strong><ol style="margin:4px 0 0 18px;padding:0;">' +
      info.causes.map(c => '<li>' + esc(c) + '</li>').join('') + '</ol></div>' +
    '<div style="margin-top:8px;"><strong>Where to start:</strong> ' + esc(info.fix) + '</div>' +
    '<div style="margin-top:4px;"><strong>Typical repair cost:</strong> ' + esc(info.cost) + '</div>';
  container.appendChild(card);
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'DTC Explainer',
    render(container) {
      container.innerHTML =
        '<div style="font-family:sans-serif;">' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
            '<input id="dx-code" placeholder="Or type a code, e.g. 29F1 / P0301" ' +
              'style="padding:6px;min-width:220px;text-transform:uppercase;">' +
            '<button id="dx-lookup" style="padding:6px 12px;">Explain</button>' +
            '<button id="dx-scan" style="padding:6px 12px;">Scan vehicle &amp; explain all</button>' +
          '</div>' +
          '<div id="dx-results" style="margin-top:8px;"></div>' +
        '</div>';
      const results = container.querySelector('#dx-results');
      const input = container.querySelector('#dx-code');

      container.querySelector('#dx-lookup').onclick = () => {
        results.innerHTML = '';
        const code = input.value.trim();
        if (!code) return;
        renderCard(results, { code });
      };

      container.querySelector('#dx-scan').onclick = async () => {
        results.innerHTML = 'Scanning…';
        try {
          const dtcs = await context.vehicle.readDtc();
          results.innerHTML = '';
          if (!dtcs.length) {
            results.innerHTML = '<p style="font-family:sans-serif;">No fault codes stored. ✅</p>';
            return;
          }
          const order = { stop: 0, caution: 1, ok: 2 };
          dtcs.map(d => ({ d, info: lookup(d.code) }))
            .sort((a, b) => order[a.info.severity] - order[b.info.severity])
            .forEach(x => renderCard(results, x.d));
          context.ui.notify('Explained ' + dtcs.length + ' fault code(s), sorted by severity.');
        } catch (err) {
          results.innerHTML = '';
          context.ui.notify('Scan failed: ' + err.message);
        }
      };
    }
  });
}

export function deactivate() {}
