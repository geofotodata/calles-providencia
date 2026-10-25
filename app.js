'use strict';
const $ = (id) => document.getElementById(id);
const labels = {
  RESEÑA_LOCAL: 'Reseña local',
  REFERENTE_PROPUESTO: 'Referente propuesto · dedicación pendiente',
  SIGNIFICADO_LITERAL: 'Significado literal · origen pendiente',
  RESEÑA_POR_CORROBORAR: 'Reseña secundaria por corroborar',
  PENDIENTE: 'Sin identificar',
  IDENTIDAD_POR_VERIFICAR: 'Identidad por verificar'
};

const stateColors = {
  RESEÑA_LOCAL: '#1f7a5b',
  REFERENTE_PROPUESTO: '#2563eb',
  SIGNIFICADO_LITERAL: '#7c3aed',
  RESEÑA_POR_CORROBORAR: '#d97706',
  IDENTIDAD_POR_VERIFICAR: '#d97706',
  PENDIENTE: '#64748b'
};

const normalize = (value) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const number = (value) => new Intl.NumberFormat('es-CL').format(value);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let map, data, catalogue = [], grouped = new Map(), selected = '', mapReady = false, visibleNames = [];
let currentTheme = 'light';

const empty = { type: 'FeatureCollection', features: [] };
const blankStyle = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e6ece8' } }]
};

function coordinates(f) {
  return f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat();
}

function bounds(features) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features) {
    for (const p of coordinates(f)) {
      b[0] = Math.min(b[0], p[0]);
      b[1] = Math.min(b[1], p[1]);
      b[2] = Math.max(b[2], p[0]);
      b[3] = Math.max(b[3], p[1]);
    }
  }
  return [[b[0], b[1]], [b[2], b[3]]];
}

function fit(features) {
  if (!mapReady || !features || !features.length) return;
  const wide = $('map').clientWidth > 700 && !$('detail').hidden;
  map.fitBounds(bounds(features), {
    padding: { top: 65, bottom: 75, left: 50, right: wide ? 395 : 50 },
    maxZoom: 16,
    duration: reducedMotion ? 0 : 650
  });
}

function status(message) {
  $('map-status').textContent = message;
  $('map-status').hidden = !message;
}

function safeSource(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function updateNavButtons() {
  const idx = visibleNames.indexOf(selected);
  $('focus-street').disabled = !selected;
  $('prev-street').disabled = (idx <= 0);
  $('next-street').disabled = (idx === -1 || idx >= visibleNames.length - 1);
}

function selectStreet(name, zoom = true) {
  const features = grouped.get(name);
  if (!features) return;
  selected = name;
  const p = features[0].properties;

  $('detail').hidden = false;
  $('detail-name').textContent = name;
  $('detail-type').textContent = p.TIPOS_VIA.replaceAll(' | ', ' · ');
  $('detail-state').textContent = labels[p.ESTADO] || p.ESTADO;
  $('detail-state').dataset.state = p.ESTADO;

  $('detail-ref').textContent = p.REFERENTE;
  $('detail-description').textContent = p.DESCRIPCION;
  $('detail-notes').textContent = p.NOTAS;
  $('detail-count').textContent = number(features.length) + ' registros con este nombre';
  $('copy-link').textContent = 'Copiar enlace';

  const source = safeSource(p.URL_FUENTE);
  $('detail-source').hidden = !source;
  $('detail-no-source').hidden = !!source;
  if (source) {
    $('detail-source').href = source;
    $('detail-source').textContent = (p.FUENTE || 'Consultar fuente documental') + ' ↗';
  } else {
    $('detail-source').removeAttribute('href');
  }

  if (mapReady && map.getSource('selection')) {
    map.getSource('selection').setData({ type: 'FeatureCollection', features });
  }

  for (const button of $('results').querySelectorAll('.street')) {
    button.setAttribute('aria-pressed', String(button.dataset.name === name));
  }

  updateNavButtons();

  const url = new URL(location.href);
  url.searchParams.set('calle', name);
  history.replaceState(null, '', url);

  if (zoom) fit(features);
}

function closeDetail() {
  selected = '';
  $('detail').hidden = true;
  if (mapReady && map.getSource('selection')) {
    map.getSource('selection').setData(empty);
  }
  const url = new URL(location.href);
  url.searchParams.delete('calle');
  history.replaceState(null, '', url);

  for (const button of $('results').querySelectorAll('.street')) {
    button.setAttribute('aria-pressed', 'false');
  }
  updateNavButtons();
}

function filterCatalogue() {
  const query = normalize($('search').value.trim());
  const type = $('type').value;
  const state = $('state').value;

  const filtered = catalogue.filter((p) => {
    if (type && !p.TIPOS_VIA.split(' | ').includes(type)) return false;
    if (state && p.ESTADO !== state) return false;
    if (!query) {
      delete p._matchType;
      return true;
    }

    if (normalize(p.NOMBRE_ART).includes(query)) {
      p._matchType = 'name';
      return true;
    }
    if (normalize(p.REFERENTE).includes(query)) {
      p._matchType = 'ref';
      return true;
    }
    if (normalize(p.DESCRIPCION).includes(query)) {
      p._matchType = 'desc';
      return true;
    }
    if (normalize(p.NOTAS).includes(query)) {
      p._matchType = 'notes';
      return true;
    }
    return false;
  });

  visibleNames = filtered.map((p) => p.NOMBRE_ART);
  $('count').textContent = number(filtered.length) + ' nombres';

  const fragment = document.createDocumentFragment();
  for (const p of filtered) {
    const button = document.createElement('button');
    button.className = 'street';
    button.dataset.name = p.NOMBRE_ART;
    button.setAttribute('aria-pressed', String(selected === p.NOMBRE_ART));

    const dot = document.createElement('span');
    dot.className = 'street-dot';
    dot.style.background = stateColors[p.ESTADO] || '#64748b';
    dot.title = labels[p.ESTADO] || p.ESTADO;

    const info = document.createElement('div');
    info.className = 'street-info';

    const title = document.createElement('strong');
    title.textContent = p.NOMBRE_ART;

    const subtitle = document.createElement('span');
    subtitle.textContent = p.TIPOS_VIA.replaceAll(' | ', ' · ') + ' / ' + number(p.N_TRAMOS) + ' registros';

    info.append(title, subtitle);

    if (query && p._matchType && p._matchType !== 'name') {
      const matchBadge = document.createElement('span');
      matchBadge.className = 'street-match';
      if (p._matchType === 'ref') {
        matchBadge.textContent = 'Coincidencia en referente';
      } else if (p._matchType === 'desc') {
        matchBadge.textContent = 'Coincidencia en descripción';
      } else if (p._matchType === 'notes') {
        matchBadge.textContent = 'Coincidencia en notas';
      }
      info.append(matchBadge);
    }

    button.append(dot, info);
    button.addEventListener('click', () => {
      selectStreet(p.NOMBRE_ART);
      if (window.innerWidth <= 580) {
        $('detail').scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'instant' : 'smooth' });
      }
    });
    fragment.append(button);
  }

  if (!filtered.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No encontramos nombres con estos filtros. Prueba otra palabra o limpia la búsqueda.';
    fragment.append(p);
  }

  $('results').replaceChildren(fragment);
  if (selected && !visibleNames.includes(selected)) closeDetail();
  else updateNavButtons();

  applyMapFilter();
}

function applyMapFilter() {
  if (!mapReady || !map.getLayer('streets')) return;
  const filter = ['in', ['get', 'NOMBRE_ART'], ['literal', visibleNames]];
  map.setFilter('streets', filter);
  map.setFilter('hit', filter);
}

function setupMapLayers() {
  if (!map.getSource('streets')) {
    map.addSource('streets', { type: 'geojson', data });
  }
  if (!map.getSource('selection')) {
    map.addSource('selection', { type: 'geojson', data: empty });
  }

  // Capa principal con colores semánticos según estado de investigación
  if (!map.getLayer('streets')) {
    map.addLayer({
      id: 'streets',
      type: 'line',
      source: 'streets',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match',
          ['get', 'ESTADO'],
          'RESEÑA_LOCAL', '#1f7a5b',
          'REFERENTE_PROPUESTO', '#2563eb',
          'SIGNIFICADO_LITERAL', '#7c3aed',
          'RESEÑA_POR_CORROBORAR', '#d97706',
          'IDENTIDAD_POR_VERIFICAR', '#d97706',
          '#64748b' // default (PENDIENTE)
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.8, 16, 4.5],
        'line-opacity': 0.85
      }
    });
  }

  // Halo y línea para la calle seleccionada
  if (!map.getLayer('selection-halo')) {
    map.addLayer({
      id: 'selection-halo',
      type: 'line',
      source: 'selection',
      paint: { 'line-color': '#ffffff', 'line-width': 10 }
    });
  }

  if (!map.getLayer('selection-line')) {
    map.addLayer({
      id: 'selection-line',
      type: 'line',
      source: 'selection',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#b65c22', 'line-width': 5 }
    });
  }

  // Capa invisible para facilitar clics y hover
  if (!map.getLayer('hit')) {
    map.addLayer({
      id: 'hit',
      type: 'line',
      source: 'streets',
      paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 16 }
    });
  }
}

async function setMapTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  $('theme-label').textContent = theme === 'dark' ? 'Oscuro' : 'Claro';

  if (!mapReady || !map) return;
  const styleUrl = theme === 'dark'
    ? 'https://tiles.openfreemap.org/styles/dark'
    : 'https://tiles.openfreemap.org/styles/positron';

  try {
    const response = await fetch(styleUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Theme basemap unavailable');
    const styleJson = await response.json();
    map.setStyle(styleJson);
    map.once('style.load', () => {
      setupMapLayers();
      applyMapFilter();
      if (selected && grouped.has(selected)) {
        map.getSource('selection').setData({ type: 'FeatureCollection', features: grouped.get(selected) });
      }
    });
  } catch (err) {
    console.warn('Could not change map theme:', err);
  }
}

async function initializeMap() {
  if (!window.maplibregl) {
    status('No se pudo cargar el visor. El catálogo y las fichas siguen disponibles. Recarga para volver a intentarlo.');
    return;
  }

  let style = blankStyle, basemapAvailable = true;
  const styleUrl = currentTheme === 'dark'
    ? 'https://tiles.openfreemap.org/styles/dark'
    : 'https://tiles.openfreemap.org/styles/positron';

  try {
    const response = await fetch(styleUrl, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Map style unavailable');
    style = await response.json();
  } catch {
    basemapAvailable = false;
  }

  try {
    map = new maplibregl.Map({
      container: 'map',
      style,
      center: [-70.608, -33.435],
      zoom: 13,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Geometrías: archivo aportado por el usuario' }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  } catch {
    status('Este navegador no pudo iniciar el mapa WebGL. Puedes consultar las fichas desde el catálogo.');
    return;
  }

  map.on('error', () => status('Algunas capas del mapa base no se han podido cargar. Puedes seguir consultando el catálogo y las calles disponibles.'));

  map.on('load', () => {
    setupMapLayers();
    mapReady = true;
    applyMapFilter();

    map.on('click', 'hit', (event) => {
      if (event.features?.length) {
        selectStreet(event.features[0].properties.NOMBRE_ART, false);
      }
    });

    const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    map.on('mousemove', 'hit', (event) => {
      map.getCanvas().style.cursor = 'pointer';
      if (event.features?.length) {
        tooltip.setLngLat(event.lngLat).setText(event.features[0].properties.NOMBRE_ART).addTo(map);
      }
    });
    map.on('mouseleave', 'hit', () => {
      map.getCanvas().style.cursor = '';
      tooltip.remove();
    });

    if (selected) selectStreet(selected);
    else fit(data.features);

    status(basemapAvailable ? '' : 'Mapa base sin conexión. Se muestran las calles del archivo; el catálogo funciona normalmente.');
  });
}

async function start() {
  // Inicializar tema guardado o según preferencia del sistema
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = currentTheme;
  $('theme-label').textContent = currentTheme === 'dark' ? 'Oscuro' : 'Claro';

  try {
    const response = await fetch('./calles.geojson');
    if (!response.ok) throw new Error('Dataset unavailable');
    data = await response.json();
    if (data.type !== 'FeatureCollection' || !data.features.length) throw new Error('Empty dataset');

    for (const feature of data.features) {
      const name = feature.properties.NOMBRE_ART;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(feature);
    }

    catalogue = [...grouped.values()].map((f) => f[0].properties).sort((a, b) => a.NOMBRE_ART.localeCompare(b.NOMBRE_ART, 'es'));
    $('total').textContent = number(catalogue.length);
    $('segments').textContent = number(data.features.length);

    for (const type of [...new Set(data.features.map((f) => f.properties.CLASE))].sort()) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      $('type').append(option);
    }

    filterCatalogue();

    const initial = new URL(location.href).searchParams.get('calle');
    if (initial && grouped.has(initial)) selectStreet(initial, false);

    await initializeMap();
  } catch {
    $('count').textContent = 'Error al cargar los datos';
    status('No se pudo cargar el catálogo. Recarga la página; si abriste el HTML directamente, sirve la carpeta con un servidor web.');
  }
}

// Event Listeners
$('search').addEventListener('input', filterCatalogue);
$('type').addEventListener('change', filterCatalogue);
$('state').addEventListener('change', filterCatalogue);
$('reset').addEventListener('click', () => {
  $('search').value = '';
  $('type').value = '';
  $('state').value = '';
  filterCatalogue();
});

$('extent').addEventListener('click', () => {
  closeDetail();
  if (data) fit(data.features);
});

$('close-detail').addEventListener('click', closeDetail);

$('focus-street').addEventListener('click', () => {
  if (selected && grouped.has(selected)) {
    fit(grouped.get(selected));
  }
});

$('prev-street').addEventListener('click', () => {
  const idx = visibleNames.indexOf(selected);
  if (idx > 0) selectStreet(visibleNames[idx - 1]);
});

$('next-street').addEventListener('click', () => {
  const idx = visibleNames.indexOf(selected);
  if (idx >= 0 && idx < visibleNames.length - 1) selectStreet(visibleNames[idx + 1]);
});

// Colapso de panel lateral
$('sidebar-toggle').addEventListener('click', () => {
  const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
  $('sidebar-toggle').textContent = isCollapsed ? '▶' : '◀';
  $('sidebar-toggle').setAttribute('aria-expanded', String(!isCollapsed));
  $('sidebar-toggle').title = isCollapsed ? 'Mostrar catálogo' : 'Ocultar catálogo';
  if (mapReady && map) {
    setTimeout(() => map.resize(), 260);
  }
});

// Toggle de tema claro / oscuro
$('theme-toggle').addEventListener('click', () => {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setMapTheme(nextTheme);
});

$('about-open').addEventListener('click', () => $('about').showModal());
$('about-close').addEventListener('click', () => $('about').close());

$('copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('copy-link').textContent = 'Enlace copiado';
  } catch {
    $('copy-link').textContent = 'Copia la dirección del navegador';
  }
});

start();
