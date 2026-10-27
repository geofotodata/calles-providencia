const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV, validateCatalog } = require('./sync_sheets');

const rows = [
  {
    NOMBRE_ART: 'ÑANDÚ', TIPOS_VIA: 'PASAJE', N_TRAMOS: '2', REFERENTE: '',
    DESCRIPCION: 'Prueba', ESTADO: 'PENDIENTE', TEMA: '', FUENTE: '',
    URL_FUENTE: '', NOTAS: '', TEXTO_POPUP: '', FECHA_REV: '2026-10-26'
  }
];

const geo = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { NOMBRE_ART: 'ÑANDÚ' }, geometry: { type: 'LineString', coordinates: [[-70, -33], [-70.1, -33.1]] } },
    { type: 'Feature', properties: { NOMBRE_ART: 'ÑANDÚ' }, geometry: { type: 'LineString', coordinates: [[-70.2, -33.2], [-70.3, -33.3]] } }
  ]
};

test('parseCSV conserva comas y comillas en campos citados', () => {
  const parsed = parseCSV('NOMBRE_ART,DESCRIPCION\nTEST,"Una coma, y ""comillas"""\n');
  assert.deepEqual(parsed, [{ NOMBRE_ART: 'TEST', DESCRIPCION: 'Una coma, y "comillas"' }]);
});

test('validateCatalog acepta una unión completa con recuentos exactos', () => {
  const result = validateCatalog(rows, geo);
  assert.equal(result.catalog.size, 1);
  assert.equal(result.featureCounts.get('ÑANDÚ'), 2);
});

test('validateCatalog rechaza claves ausentes, duplicadas y recuentos incompatibles', () => {
  assert.throws(() => validateCatalog([{ ...rows[0], N_TRAMOS: '1' }], geo), /N_TRAMOS=1/);
  assert.throws(() => validateCatalog([...rows, { ...rows[0] }], geo), /duplicado/);
  assert.throws(() => validateCatalog([{ ...rows[0], NOMBRE_ART: 'OTRA' }], geo), /claves no coinciden/);
});
