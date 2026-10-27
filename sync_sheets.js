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
const REQUIRED_COLUMNS = [
  'NOMBRE_ART', 'TIPOS_VIA', 'N_TRAMOS', 'REFERENTE', 'DESCRIPCION',
  'ESTADO', 'TEMA', 'FUENTE', 'URL_FUENTE', 'NOTAS', 'TEXTO_POPUP', 'FECHA_REV'
];

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

function validateCatalog(rows, geo) {
  if (!geo || geo.type !== 'FeatureCollection' || !Array.isArray(geo.features) || !geo.features.length) {
    throw new Error('calles.geojson debe ser un FeatureCollection no vacío.');
  }

  const catalog = new Map();
  for (const [index, row] of rows.entries()) {
    const missing = REQUIRED_COLUMNS.filter((column) => !(column in row));
    if (missing.length) {
      throw new Error(`Fila ${index + 2}: faltan columnas requeridas: ${missing.join(', ')}.`);
    }
    const name = row.NOMBRE_ART.trim();
    if (!name || catalog.has(name)) {
      throw new Error(`Fila ${index + 2}: NOMBRE_ART vacío o duplicado: ${row.NOMBRE_ART || '(vacío)'}.`);
    }
    const segmentCount = Number(row.N_TRAMOS);
    if (!Number.isInteger(segmentCount) || segmentCount < 1) {
      throw new Error(`Fila ${index + 2}: N_TRAMOS debe ser un entero positivo.`);
    }
    catalog.set(name, { ...row, NOMBRE_ART: name, N_TRAMOS: segmentCount });
  }

  const featureCounts = new Map();
  for (const feature of geo.features) {
    const name = feature.properties?.NOMBRE_ART;
    if (!name) throw new Error('Se encontró un tramo sin NOMBRE_ART.');
    featureCounts.set(name, (featureCounts.get(name) || 0) + 1);
  }

  const missingInCatalog = [...featureCounts.keys()].filter((name) => !catalog.has(name));
  const missingInGeoJSON = [...catalog.keys()].filter((name) => !featureCounts.has(name));
  if (missingInCatalog.length || missingInGeoJSON.length) {
    throw new Error(
      `Las claves no coinciden (sin catálogo: ${missingInCatalog.join(', ') || 'ninguna'}; ` +
      `sin geometría: ${missingInGeoJSON.join(', ') || 'ninguna'}).`
    );
  }

  for (const [name, count] of featureCounts) {
    if (catalog.get(name).N_TRAMOS !== count) {
      throw new Error(`${name}: N_TRAMOS=${catalog.get(name).N_TRAMOS}, pero hay ${count} tramos en el GeoJSON.`);
    }
  }
  return { catalog, featureCounts };
}

async function run() {
  const source = process.argv[2] || process.env.GOOGLE_SHEETS_CSV_URL || path.join(ROOT, 'catalogo.csv');

  let rawCSV = '';
  if (source.startsWith('http://') || source.startsWith('https://')) {
    console.log(`📥 Descargando catálogo desde Google Sheets: ${source}`);
    rawCSV = await fetchURL(source);
  } else {
    const filePath = path.isAbsolute(source) ? source : path.join(ROOT, source);
    console.log(`📖 Leyendo archivo local: ${filePath}`);
    rawCSV = fs.readFileSync(filePath, 'utf8');
  }

  const rows = parseCSV(rawCSV);
  if (!rows.length) {
    throw new Error('El archivo CSV está vacío o no contiene filas de datos.');
  }
  const geoPath = path.join(ROOT, 'calles.geojson');
  const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
  const { catalog, featureCounts } = validateCatalog(rows, geo);
  const stateCounts = {};
  for (const row of catalog.values()) {
    const state = row.ESTADO || 'PENDIENTE';
    stateCounts[state] = (stateCounts[state] || 0) + 1;
  }
  console.log(`✓ Validadas ${catalog.size} calles y ${geo.features.length} tramos.`);

  if (source.startsWith('http://') || source.startsWith('https://')) {
    const catalogPath = path.join(ROOT, 'catalogo.csv');
    const temporaryCatalog = catalogPath + '.tmp';
    fs.writeFileSync(temporaryCatalog, '\ufeff' + rawCSV, 'utf8');
    fs.renameSync(temporaryCatalog, catalogPath);
    console.log('✓ catalogo.csv actualizado exitosamente.');
  }

  let matched = 0;
  for (const feature of geo.features) {
    const row = catalog.get(feature.properties.NOMBRE_ART);
    for (const [field, value] of Object.entries(row)) {
      if (field !== 'NOMBRE_ART') feature.properties[field] = value;
    }
    matched++;
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
      val.features_in = geo.features.length;
      val.features_out = geo.features.length;
      val.unique_names = catalog.size;
      val.unmatched = [];
      val.rejected = [];
      val.geometry_unchanged = true;
      val.crs = 'OGC:CRS84 / WGS84 longitude, latitude';
      val.join = 'NOMBRE_ART exact';
      val.states_by_name = stateCounts;
      fs.writeFileSync(valPath, JSON.stringify(val, null, 2), 'utf8');
      console.log('✓ validation.json actualizado.');
    } catch (e) {
      console.warn('Aviso al actualizar validation.json:', e.message);
    }
  }

  console.log('\n🎉 ¡Sincronización completada con éxito!');
}

if (require.main === module) {
  run().catch((err) => {
    console.error('❌ Error en la sincronización:', err.message);
    process.exit(1);
  });
}

module.exports = { parseCSV, validateCatalog };
