#!/usr/bin/env node
/**
 * Sincroniza el catálogo de Google Sheets con catalogo.csv y calles.geojson.
 * Uso: node sync_sheets.js [url_de_google_sheets_csv | ruta_local]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = __dirname;

function parseCSV(text) {
  const lines = [];
  let row = [''];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
    lines.push(row);
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  return lines.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? r[idx] : '';
    });
    return obj;
  });
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchURL(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  const source = process.argv[2] || process.env.GOOGLE_SHEETS_CSV_URL || path.join(ROOT, 'catalogo.csv');

  let rawCSV = '';
  if (source.startsWith('http://') || source.startsWith('https://')) {
    console.log(`📥 Descargando catálogo desde Google Sheets: ${source}`);
    rawCSV = await fetchURL(source);
    fs.writeFileSync(path.join(ROOT, 'catalogo.csv'), '\ufeff' + rawCSV, 'utf8');
    console.log('✓ catalogo.csv actualizado exitosamente.');
  } else {
    const filePath = path.isAbsolute(source) ? source : path.join(ROOT, source);
    console.log(`📖 Leyendo archivo local: ${filePath}`);
    rawCSV = fs.readFileSync(filePath, 'utf8');
  }

  const rows = parseCSV(rawCSV);
  if (!rows.length) {
    throw new Error('El archivo CSV está vacío o no contiene filas de datos.');
  }
  console.log(`✓ Procesadas ${rows.length} filas del catálogo.`);

  const catalog = new Map();
  const stateCounts = {};
  for (const r of rows) {
    const name = (r.NOMBRE_ART || '').trim();
    if (name) {
      catalog.set(name, r);
      const st = r.ESTADO || 'PENDIENTE';
      stateCounts[st] = (stateCounts[st] || 0) + 1;
    }
  }

  // Actualizar calles.geojson
  const geoPath = path.join(ROOT, 'calles.geojson');
  const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));

  const fields = [
    'REFERENTE',
    'DESCRIPCION',
    'ESTADO',
    'TEMA',
    'FUENTE',
    'URL_FUENTE',
    'NOTAS',
    'TEXTO_POPUP',
    'FECHA_REV'
  ];

  let matched = 0;
  for (const feature of geo.features || []) {
    const name = feature.properties?.NOMBRE_ART;
    if (catalog.has(name)) {
      const row = catalog.get(name);
      for (const f of fields) {
        if (row[f] !== undefined) {
          feature.properties[f] = row[f];
        }
      }
      matched++;
    }
  }

  const tmpGeo = geoPath + '.tmp';
  fs.writeFileSync(tmpGeo, JSON.stringify(geo), 'utf8');
  fs.renameSync(tmpGeo, geoPath);
  console.log(`✓ calles.geojson sincronizado (${matched} tramos actualizados).`);

  // Actualizar validation.json
  const valPath = path.join(ROOT, 'validation.json');
  if (fs.existsSync(valPath)) {
    try {
      const val = JSON.parse(fs.readFileSync(valPath, 'utf8'));
      val.states_by_name = stateCounts;
      fs.writeFileSync(valPath, JSON.stringify(val, null, 2), 'utf8');
      console.log('✓ validation.json actualizado.');
    } catch (e) {
      console.warn('Aviso al actualizar validation.json:', e.message);
    }
  }

  console.log('\n🎉 ¡Sincronización completada con éxito!');
}

run().catch((err) => {
  console.error('❌ Error en la sincronización:', err.message);
  process.exit(1);
});
