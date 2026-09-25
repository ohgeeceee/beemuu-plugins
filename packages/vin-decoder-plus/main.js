// VIN Decoder Plus — offline BMW VIN decoding (WMI, model year, plant, serial).

const YEARS = {
  A: [1980, 2010], B: [1981, 2011], C: [1982, 2012], D: [1983, 2013],
  E: [1984, 2014], F: [1985, 2015], G: [1986, 2016], H: [1987, 2017],
  J: [1988, 2018], K: [1989, 2019], L: [1990, 2020], M: [1991, 2021],
  N: [1992, 2022], P: [1993, 2023], R: [1994, 2024], S: [1995, 2025],
  T: [1996, 2026], V: [1997, 2027], W: [1998, 2028], X: [1999, 2029],
  Y: [2000, 2030], 1: [2001, 2031], 2: [2002, 2032], 3: [2003, 2033],
  4: [2004, 2034], 5: [2005, 2035], 6: [2006, 2036], 7: [2007, 2037],
  8: [2008, 2038], 9: [2009, 2039]
};

const PLANTS = {
  A: 'Munich, Germany', F: 'Munich, Germany', E: 'Regensburg, Germany',
  J: 'Regensburg, Germany', B: 'Dingolfing, Germany', C: 'Dingolfing, Germany',
  D: 'Dingolfing, Germany', G: 'Dingolfing, Germany',
  L: 'Spartanburg, USA', M: 'Spartanburg, USA', N: 'Spartanburg, USA',
  W: 'Graz, Austria (Magna)', V: 'Leipzig, Germany', K: 'Leipzig, Germany',
  S: 'Rosslyn, South Africa', T: 'Oxford, UK (MINI)', U: 'Goodwood, UK (Rolls-Royce)'
};

function decodeVin(vin) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
    return { error: 'Invalid VIN — must be 17 chars, no I/O/Q.' };
  }
  vin = vin.toUpperCase();
  const wmi = vin.slice(0, 3);
  const yearCode = vin[9];
  const yearOpts = YEARS[yearCode] || [];
  // BMW 7th char >= 'G' heuristic: pre-2010 style VINs for many chassis
  const year = yearOpts.length === 2 ? yearOpts[0] : (yearOpts[0] || null);
  return {
    vin,
    wmi,
    make: wmi.startsWith('WBA') || wmi.startsWith('WBS') ? 'BMW'
        : wmi.startsWith('WBX') ? 'BMW (US plant)'
        : wmi.startsWith('WMW') ? 'MINI'
        : wmi.startsWith('5UX') ? 'BMW X (US)'
        : 'Unknown (' + wmi + ')',
    modelCode: vin.slice(3, 8),
    modelYear: year,
    modelYearNote: yearOpts.length === 2 ? 'code also valid for ' + yearOpts[1] : '',
    plant: PLANTS[vin[10]] || 'Unknown plant code ' + vin[10],
    serial: vin.slice(11)
  };
}

export function activate(context) {
  context.ui.registerPanel({
    title: 'VIN Decoder Plus',
    render(container) {
      container.innerHTML = `
        <div style="font-family:sans-serif;display:flex;flex-direction:column;gap:8px;max-width:420px;">
          <input id="vdp-vin" placeholder="Enter VIN or read from vehicle"
                 style="padding:6px;font-family:monospace;">
          <div style="display:flex;gap:8px;">
            <button id="vdp-decode" style="padding:6px 12px;">Decode</button>
            <button id="vdp-read" style="padding:6px 12px;">Read VIN from vehicle</button>
          </div>
          <pre id="vdp-out" style="background:#111;color:#9f9;padding:10px;white-space:pre-wrap;"></pre>
        </div>`;
      const vinInput = container.querySelector('#vdp-vin');
      const out = container.querySelector('#vdp-out');
      const show = vin => {
        const r = decodeVin(vin);
        out.textContent = r.error ? r.error
          : Object.entries(r).map(([k, v]) => k.padEnd(14) + ': ' + v).join('\n');
      };
      container.querySelector('#vdp-decode').onclick = () => show(vinInput.value.trim());
      container.querySelector('#vdp-read').onclick = async () => {
        try {
          const vin = await context.vehicle.readVin();
          vinInput.value = vin;
          show(vin);
        } catch (err) {
          out.textContent = 'VIN read failed: ' + err.message;
        }
      };
    }
  });
}

export function deactivate() {}
