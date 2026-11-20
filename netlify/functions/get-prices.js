// Llegeix els preus i mínims de nits del full de Google Sheets
// "Preus Casa Rústica (web)" i els torna a la web en JSON.
// Columnes: A = Data, B = Dia, C = Preu (€), D = Mínim nits, E = Nota
// Si alguna fila no és vàlida, s'ignora i la web fa servir el preu de seguretat.

const SHEET_ID = '1Nd7AS74LbVfe0BtRjdRwrf1154seV5VgIgP_uILif7c';
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;

function pad(n) { return String(n).padStart(2, '0'); }

// Accepta: "Date(2026,10,20)" (mes 0-11), "2026-11-20", "20/11/2026", "20-11-2026"
function toYMD(cell) {
  if (!cell) return null;
  const v = cell.v;
  if (typeof v === 'string') {
    let m = v.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
    if (m) return `${m[1]}-${pad(+m[2] + 1)}-${pad(+m[3])}`;
    m = v.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = v.trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  // Si Google ens dona el text formatat, provem amb aquest
  if (cell.f && typeof cell.f === 'string' && cell.f !== v) return toYMD({ v: cell.f });
  return null;
}

function toNum(cell) {
  if (!cell || cell.v === null || cell.v === undefined || cell.v === '') return null;
  if (typeof cell.v === 'number') return cell.v;
  const n = parseFloat(String(cell.v).replace('€', '').replace(',', '.').trim());
  return isNaN(n) ? null : n;
}

exports.handler = async () => {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (json.status !== 'ok' || !json.table) throw new Error('status ' + json.status);

    const days = {};
    let skipped = 0;
    for (const row of json.table.rows || []) {
      const c = row.c || [];
      const ymd = toYMD(c[0]);
      if (!ymd) { skipped++; continue; }
      const price = toNum(c[2]);
      const minN = toNum(c[3]);
      const entry = {};
      if (price !== null && price >= 1 && price <= 2000) entry.p = Math.round(price * 100) / 100;
      if (minN !== null && minN >= 1 && minN <= 30) entry.m = Math.round(minN);
      if (entry.p || entry.m) days[ymd] = entry; else skipped++;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
      body: JSON.stringify({ ok: true, count: Object.keys(days).length, skipped, days }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: String(err.message || err), days: {} }),
    };
  }
};
