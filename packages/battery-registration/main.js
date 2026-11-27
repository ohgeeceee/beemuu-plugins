// Battery Registration — guided new-battery registration for BMWs with IBS
// (intelligent battery sensor). Registering tells the power-management
// system a fresh battery is installed so charging strategy resets.
//
// ⚠️ This plugin WRITES to the vehicle (capability: coding-write).
// The write goes through the host's gated codingWrite API:
//   context.vehicle.codingWrite('battery_registration', {type, capacityAh})
// If the host does not expose that API, the plugin refuses to proceed.

const CAPACITIES_AH = [55, 60, 70, 80, 90, 92, 105, 110];
const MIN_VOLTAGE_V = 12.4;

let unsubscribe = null;
let lastVoltage = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'Battery Registration',
    render(container) {
      container.innerHTML =
        '<div style="font-family:sans-serif;max-width:620px;">' +
          '<div style="padding:12px;border-radius:6px;background:#fff3e0;border:1px solid #ffb74d;' +
            'font-size:13px;margin-bottom:12px;">' +
            '<strong>⚠️ Read this first.</strong> Registration is REQUIRED after replacing the battery ' +
            'on BMWs with IBS — skipping it overcharges the new battery and shortens its life. ' +
            'Only register when the new battery is actually installed. ' +
            '<strong>If you changed battery type or capacity</strong> (e.g. flooded → AGM), the vehicle ' +
            'order (VO) must be updated separately — registration alone is not enough.</div>' +

          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">' +
            '<button id="br-precheck" style="padding:6px 12px;">1 · Pre-checks</button>' +
            '<span id="br-precheck-out" style="font-size:13px;color:#555;"></span></div>' +

          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">' +
            '<span style="font-size:13px;">2 ·</span>' +
            '<select id="br-type" style="padding:6px;">' +
              '<option value="agm">AGM battery</option>' +
              '<option value="flooded">Conventional flooded</option></select>' +
            '<select id="br-cap" style="padding:6px;">' +
              CAPACITIES_AH.map(c => '<option value="' + c + '">' + c + ' Ah</option>').join('') +
            '</select>' +
            '<span style="font-size:12px;color:#777;">Match the label on the NEW battery exactly.</span></div>' +

          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
            '<span style="font-size:13px;">3 ·</span>' +
            '<input id="br-confirm" placeholder="Type REGISTER to enable" style="padding:6px;width:180px;">' +
            '<button id="br-go" style="padding:6px 14px;" disabled>Register battery</button></div>' +

          '<div id="br-result" style="margin-top:12px;"></div>' +
        '</div>';

      const preOut = container.querySelector('#br-precheck-out');
      const confirmInput = container.querySelector('#br-confirm');
      const goBtn = container.querySelector('#br-go');
      const resultBox = container.querySelector('#br-result');
      let vin = null;

      confirmInput.oninput = () => { goBtn.disabled = confirmInput.value.trim() !== 'REGISTER'; };

      container.querySelector('#br-precheck').onclick = () => {
        preOut.textContent = 'Checking…';
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        context.vehicle.readVin()
          .then(v => { vin = v; })
          .catch(() => { vin = null; })
          .finally(() => {
            unsubscribe = context.vehicle.subscribeLive(['battery_voltage'], vals => {
              const v = Number(vals.battery_voltage);
              if (Number.isFinite(v)) lastVoltage = v;
              const supported = typeof context.vehicle.codingWrite === 'function';
              const parts = [];
              parts.push(supported ? '✅ host supports registration'
                : '❌ this Beemuu host does not expose battery registration');
              parts.push(vin ? '✅ VIN ' + esc(vin) : '⚠️ VIN unread');
              parts.push(lastVoltage === null ? '… waiting for voltage'
                : (lastVoltage >= MIN_VOLTAGE_V ? '✅ ' : '⚠️ ') +
                  'battery ' + lastVoltage.toFixed(1) + ' V (want ≥ ' + MIN_VOLTAGE_V + ' V)');
              preOut.innerHTML = parts.join(' · ');
              if (unsubscribe && lastVoltage !== null) { unsubscribe(); unsubscribe = null; }
            });
          });
      };

      goBtn.onclick = async () => {
        if (typeof context.vehicle.codingWrite !== 'function') {
          context.ui.notify('Registration unavailable: host does not expose codingWrite.');
          return;
        }
        if (lastVoltage !== null && lastVoltage < MIN_VOLTAGE_V) {
          context.ui.notify('Battery voltage is low (' + lastVoltage.toFixed(1) +
            ' V) — connect a charger before registering.');
          return;
        }
        const type = container.querySelector('#br-type').value;
        const capacityAh = Number(container.querySelector('#br-cap').value);
        goBtn.disabled = true; goBtn.textContent = 'Registering…';
        resultBox.innerHTML = '';
        try {
          await context.vehicle.codingWrite('battery_registration', { type, capacityAh });
          resultBox.innerHTML =
            '<div style="padding:12px;background:#e8f5e9;border-radius:6px;color:#1b5e20;">' +
            '<strong>✅ Registration complete.</strong> ' + esc(String(capacityAh)) + ' Ah ' +
            esc(type.toUpperCase()) + ' battery registered' + (vin ? ' for VIN ' + esc(vin) : '') +
            '. Start the engine and let it idle a minute; clear any stored power-management faults.</div>';
          context.ui.notify('Battery registered: ' + capacityAh + ' Ah ' + type.toUpperCase());
        } catch (err) {
          resultBox.innerHTML =
            '<div style="padding:12px;background:#ffebee;border-radius:6px;color:#b71c1c;">' +
            '<strong>Registration failed:</strong> ' + esc(err.message) +
            '<br>Ignition on, charger connected, then try again. The battery has NOT been registered.</div>';
          context.ui.notify('Battery registration failed: ' + err.message);
        } finally {
          goBtn.disabled = false; goBtn.textContent = 'Register battery';
          confirmInput.value = '';
        }
      };
    }
  });
}

export function deactivate() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  lastVoltage = null;
}
