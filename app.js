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

// CSS tokens are shared by the map, result markers and legend.
const stateTokens = {
  RESEÑA_LOCAL: '--state-resena',
  REFERENTE_PROPUESTO: '--state-referente',
  SIGNIFICADO_LITERAL: '--state-literal',
  RESEÑA_POR_CORROBORAR: '--state-corroborar',
  IDENTIDAD_POR_VERIFICAR: '--state-corroborar',
  PENDIENTE: '--state-pendiente'
};
const LOAD_TIMEOUT_MS = 12000;

const normalize = (value) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const number = (value) => new Intl.NumberFormat('es-CL').format(value);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const compactLayout = window.matchMedia('(max-width: 1000px)');

let map, data, catalogue = [], grouped = new Map(), selected = '', mapReady = false, visibleNames = [];
let currentTheme = 'light';
let basemapRequest = 0, basemapController = null, detailOrigin = null;
let styleChanging = false, lastGoodStyle = null, confirmedBasemap = null;
let detailExpanded = false, catalogueReady = false;

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

function mapPadding() {
  const area = $('map').getBoundingClientRect();
  const padding = { top: 24, bottom: 36, left: 24, right: 24 };
  const controls = $('map-controls').getBoundingClientRect();
  const legend = $('map-overlays').getBoundingClientRect();
  padding.top = Math.max(padding.top, controls.bottom - area.top + 12);
  padding.bottom = Math.max(padding.bottom, area.bottom - legend.top + 12);
  if (!$('detail').hidden && !compactLayout.matches) {
    const panel = $('detail').getBoundingClientRect();
    if (panel.left < area.right && panel.bottom > area.top) {
      padding.right = Math.max(padding.right, area.right - panel.left + 16);
    }
  }
  // Preserve a usable camera area even in a very small browser window.
  for (const [first, second, size] of [['left', 'right', area.width], ['top', 'bottom', area.height]]) {
    const total = padding[first] + padding[second];
    const scale = Math.min(1, Math.max(0, size - 80) / total);
    padding[first] *= scale;
    padding[second] *= scale;
  }
  return padding;
}

function fit(features) {
  if (!mapReady || !features || !features.length) return;
  map.fitBounds(bounds(features), {
    padding: mapPadding(),
    maxZoom: 16,
    duration: reducedMotion ? 0 : 650
  });
}

function status(message, retry = null) {
  $('map-status').textContent = message;
  $('map-notice').hidden = !message;
  $('retry-load').hidden = !retry;
  $('retry-load').onclick = retry;
}

function readPreference(key) {
  try { return localStorage.getItem(key); }
  catch { return null; } // Storage can be disabled; it must not prevent browsing.
}

function savePreference(key, value) {
  try { localStorage.setItem(key, value); }
  catch { /* Preferences remain valid for this page session. */ }
}

function reviewDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

function streetColorExpression() {
  const tokens = getComputedStyle(document.documentElement);
  const expression = ['match', ['get', 'ESTADO']];
  for (const [state, token] of Object.entries(stateTokens)) {
    expression.push(state, tokens.getPropertyValue(token).trim());
  }
  expression.push(tokens.getPropertyValue('--state-pendiente').trim());
  return expression;
}

function updateMapPalette() {
  if (mapReady && !styleChanging && map.getLayer('streets')) {
    map.setPaintProperty('streets', 'line-color', streetColorExpression());
  }
}

function updateDetailPresentation() {
  const expanded = !compactLayout.matches || detailExpanded;
  const hidingFocusedContent = !expanded && $('detail-body').contains(document.activeElement);
  $('detail-body').hidden = !expanded;
  $('detail-expand').setAttribute('aria-expanded', String(expanded));
  $('detail-expand').textContent = expanded ? 'Ocultar fuentes y notas' : 'Ver fuentes y notas';
  if (hidingFocusedContent) $('detail-expand').focus();
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

function selectStreet(name, zoom = true, moveFocus = true) {
  const features = grouped.get(name);
  if (!features) return;
  selected = name;
  if (!$('detail').contains(document.activeElement)) detailOrigin = document.activeElement;
  const p = features[0].properties;

  $('detail').hidden = false;
  $('detail-name').textContent = name;
  $('detail-type').textContent = p.TIPOS_VIA.replaceAll(' | ', ' · ');
  $('detail-state').textContent = labels[p.ESTADO] || p.ESTADO;
  $('detail-state').dataset.state = p.ESTADO;

  $('detail-ref').textContent = p.REFERENTE;
  $('detail-description').textContent = p.DESCRIPCION;
  $('detail-notes').textContent = p.NOTAS;
  $('detail-notes').hidden = !p.NOTAS;

  const pendingNote = $('detail-pending');
  pendingNote.hidden = p.ESTADO !== 'PENDIENTE';
  pendingNote.textContent = p.ESTADO === 'PENDIENTE'
    ? 'Sin atribución verificable en las fuentes consultadas. No significa que la calle no tenga historia: falta confirmar su origen en documentos municipales de Providencia.'
    : '';
  const date = reviewDate(p.FECHA_REV);
  $('detail-date').textContent = date ? 'Revisado el ' + date : 'Fecha de revisión no disponible';
  $('detail-certainty').textContent = p.ESTADO === 'REFERENTE_PROPUESTO'
    ? 'La fuente identifica al referente; la dedicación de esta calle sigue pendiente de confirmar.'
    : p.ESTADO === 'SIGNIFICADO_LITERAL'
      ? 'El significado del nombre no confirma el acto de denominación de la calle.' : '';
  $('detail-certainty').hidden = !$('detail-certainty').textContent;
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

  updateDetailPresentation();
  if (mapReady && !styleChanging && map.getSource('selection')) {
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
  if (moveFocus) $('detail-name').focus({ preventScroll: true });
}

function closeDetail() {
  const restoreFocus = $('detail').contains(document.activeElement);
  const selectedButton = [...$('results').querySelectorAll('.street')].find((button) => button.dataset.name === selected);
  selected = '';
  $('detail').hidden = true;
  if (mapReady && !styleChanging && map.getSource('selection')) {
    map.getSource('selection').setData(empty);
  }
  const url = new URL(location.href);
  url.searchParams.delete('calle');
  history.replaceState(null, '', url);

  for (const button of $('results').querySelectorAll('.street')) {
    button.setAttribute('aria-pressed', 'false');
  }
  updateNavButtons();
  if (restoreFocus) {
    const target = selectedButton || (detailOrigin?.isConnected && detailOrigin !== document.body ? detailOrigin : $('search'));
    if ($('sidebar').inert && $('sidebar').contains(target)) $('sidebar-toggle').focus();
    else target.focus();
  }
}

function filterCatalogue() {
  if (!catalogueReady) return;
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
  $('count').textContent = number(filtered.length) + (filtered.length === 1 ? ' nombre' : ' nombres');

  const fragment = document.createDocumentFragment();
  for (const p of filtered) {
    const button = document.createElement('button');
    button.className = 'street';
    button.dataset.name = p.NOMBRE_ART;
    button.setAttribute('aria-pressed', String(selected === p.NOMBRE_ART));

    const dot = document.createElement('span');
    dot.className = 'street-dot';
    dot.style.background = `var(${stateTokens[p.ESTADO] || stateTokens.PENDIENTE})`;
    dot.setAttribute('aria-hidden', 'true');

    const info = document.createElement('div');
    info.className = 'street-info';

    const title = document.createElement('strong');
    title.textContent = p.NOMBRE_ART;

    const subtitle = document.createElement('span');
    subtitle.textContent = p.TIPOS_VIA.replaceAll(' | ', ' · ') + ' / ' + number(p.N_TRAMOS) + ' registros';

    info.append(title, subtitle);
    const stateLabel = document.createElement('span');
    stateLabel.className = 'street-state';
    stateLabel.textContent = labels[p.ESTADO] || p.ESTADO;
    info.append(stateLabel);

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
      if (compactLayout.matches) {
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
  if (!mapReady || styleChanging || !map.getLayer('streets')) return;
  const filter = ['in', ['get', 'NOMBRE_ART'], ['literal', visibleNames]];
  map.setFilter('streets', filter);
  map.setFilter('hit', filter);
}

function getStreetsLayersDefinition() {
  const filter = ['in', ['get', 'NOMBRE_ART'], ['literal', visibleNames]];
  return [
    {
      id: 'streets',
      type: 'line',
      source: 'streets',
      filter: filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': streetColorExpression(),
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.8, 16, 4.5],
        'line-opacity': 0.85
      }
    },
    {
      id: 'selection-halo',
      type: 'line',
      source: 'selection',
      paint: { 'line-color': '#ffffff', 'line-width': 10 }
    },
    {
      id: 'selection-line',
      type: 'line',
      source: 'selection',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': getComputedStyle(document.documentElement).getPropertyValue('--state-selected').trim(), 'line-width': 5 }
    },
    {
      id: 'hit',
      type: 'line',
      source: 'streets',
      filter: filter,
      paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 16 }
    }
  ];
}

function injectLayersIntoStyle(baseStyle) {
  const style = JSON.parse(JSON.stringify(baseStyle));
  style.sources = style.sources || {};
  style.sources.streets = { type: 'geojson', data: data || empty };
  style.sources.selection = {
    type: 'geojson',
    data: (selected && grouped.has(selected))
      ? { type: 'FeatureCollection', features: grouped.get(selected) }
      : empty
  };
  style.layers = style.layers || [];
  style.layers = style.layers.filter((l) => !['streets', 'selection-halo', 'selection-line', 'hit'].includes(l.id));
  style.layers.push(...getStreetsLayersDefinition());
  return style;
}

function setupMapLayers() {
  if (!map) return;
  if (!map.getSource('streets') && data) {
    map.addSource('streets', { type: 'geojson', data });
  }
  if (!map.getSource('selection')) {
    map.addSource('selection', {
      type: 'geojson',
      data: (selected && grouped.has(selected))
        ? { type: 'FeatureCollection', features: grouped.get(selected) }
        : empty
    });
  }

  const defs = getStreetsLayersDefinition();
  for (const layer of defs) {
    if (!map.getLayer(layer.id)) {
      map.addLayer(layer);
    }
  }
}

const basemaps = {
  positron: {
    name: 'Claro',
    type: 'url',
    url: 'https://tiles.openfreemap.org/styles/positron',
    theme: 'light'
  },
  dark: {
    name: 'Oscuro',
    type: 'url',
    url: 'https://tiles.openfreemap.org/styles/dark',
    theme: 'dark'
  },
  liberty: {
    name: 'Detallado',
    type: 'url',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    theme: 'light'
  },
  satellite: {
    name: 'Satélite',
    type: 'json',
    style: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
        }
      },
      layers: [
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'esri-satellite'
        }
      ]
    },
    theme: 'dark'
  }
};

let currentBasemap = 'positron';

function setUITheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  savePreference('theme', theme);
  if ($('theme-label')) $('theme-label').textContent = theme === 'dark' ? 'Oscuro' : 'Claro';
  $('theme-toggle').setAttribute('aria-pressed', String(theme === 'dark'));
  updateMapPalette();
}

function updateBasemapControls() {
  $('basemap-btn').disabled = !mapReady;
  $('basemap-label').textContent = confirmedBasemap
    ? 'Mapa: ' + basemaps[confirmedBasemap].name : 'Mapa: solo calles';
  for (const btn of document.querySelectorAll('.basemap-option')) {
    const active = btn.dataset.style === confirmedBasemap;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
}

/** Apply a style with bounded waiting and removable handlers for stale requests. */
function replaceMapStyle(style, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      map.off('style.load', onLoad);
      map.off('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const finish = (error) => { cleanup(); error ? reject(error) : resolve(); };
    const onLoad = () => finish();
    const onError = (event) => finish(event.error || new Error('Style load failed'));
    const onAbort = () => finish(new Error('Style request cancelled'));
    const timer = setTimeout(() => finish(new Error('Style load timed out')), LOAD_TIMEOUT_MS);
    map.once('style.load', onLoad);
    map.on('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) return onAbort();
    try { map.setStyle(style, { diff: false }); }
    catch (error) { finish(error); }
  });
}

function restoreMapState() {
  setupMapLayers();
  applyMapFilter();
  map.getSource('selection').setData(selected && grouped.has(selected)
    ? { type: 'FeatureCollection', features: grouped.get(selected) } : empty);
  updateMapPalette();
}

async function changeBasemap(styleKey) {
  const cfg = basemaps[styleKey];
  if (!cfg || !mapReady || !map) return;
  const request = ++basemapRequest;
  basemapController?.abort();
  const controller = new AbortController();
  basemapController = controller;
  const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
  let replaced = false;
  status('Cargando mapa base ' + cfg.name + '…');
  try {
    let rawStyle = cfg.style;
    if (cfg.type === 'url') {
      const response = await fetch(cfg.url, { signal: controller.signal });
      if (!response.ok) throw new Error('Basemap style unavailable');
      rawStyle = await response.json();
    }
    if (request !== basemapRequest) return;
    if (controller.signal.aborted) throw new Error('Basemap request timed out');
    replaced = true;
    styleChanging = true;
    await replaceMapStyle(injectLayersIntoStyle(rawStyle), controller.signal);
    if (request !== basemapRequest) return;
    styleChanging = false;
    restoreMapState();
    lastGoodStyle = map.getStyle();
    currentBasemap = confirmedBasemap = styleKey;
    savePreference('basemap', styleKey);
    updateBasemapControls();
    status('');
  } catch (error) {
    if (request !== basemapRequest) return;
    console.warn('Could not load basemap style:', error);
    if ((replaced || styleChanging) && lastGoodStyle) {
      const recovery = new AbortController();
      basemapController = recovery;
      try {
        await replaceMapStyle(injectLayersIntoStyle(lastGoodStyle), recovery.signal);
        if (request !== basemapRequest) return;
        styleChanging = false;
        restoreMapState();
      } catch (recoveryError) {
        if (request !== basemapRequest) return;
        console.warn('Could not restore basemap:', recoveryError);
        confirmedBasemap = null;
      }
    }
    if (request !== basemapRequest) return;
    styleChanging = false;
    updateBasemapControls();
    status('No se pudo cargar el mapa ' + cfg.name + '. El catálogo sigue disponible.', () => changeBasemap(styleKey));
  } finally {
    clearTimeout(timer);
    if (request === basemapRequest) basemapController = null;
  }
}

async function initializeMap() {
  if (!window.maplibregl) {
    status('No se pudo cargar el visor. El catálogo y las fichas siguen disponibles.', () => location.reload());
    return;
  }
  status('Preparando el mapa…');
  mapReady = false;
  updateBasemapControls();
  try {
    // Load the local street geometry first, independently of remote basemaps.
    const initialStyle = injectLayersIntoStyle(blankStyle);
    map = new maplibregl.Map({
      container: 'map',
      style: initialStyle,
      center: [-70.608, -33.435],
      zoom: 13,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Geometrías: archivo aportado por el usuario' }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        map.off('load', onLoad);
        map.off('error', onError);
      };
      const onLoad = () => { cleanup(); resolve(); };
      const onError = (event) => { cleanup(); reject(event.error || new Error('Map unavailable')); };
      const timer = setTimeout(() => onError({ error: new Error('Map load timed out') }), LOAD_TIMEOUT_MS);
      map.once('load', onLoad);
      map.once('error', onError);
    });
  } catch (error) {
    console.warn('Could not initialize map:', error);
    if (map) map.remove();
    map = null;
    status('No se pudo iniciar el mapa. Puedes consultar las fichas desde el catálogo.', initializeMap);
    return;
  }

  mapReady = true;
  lastGoodStyle = map.getStyle();
  updateBasemapControls();
  restoreMapState();
  map.on('error', () => {
    if (!basemapController) {
      status('Algunas capas no se han podido cargar. El catálogo sigue disponible.', () => changeBasemap(confirmedBasemap || currentBasemap));
    }
  });

  map.on('click', 'hit', (event) => {
    if (event.features?.length) {
      selectStreet(event.features[0].properties.NOMBRE_ART, false);
      if (compactLayout.matches) $('detail').scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'instant' : 'smooth' });
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

  if (selected) fit(grouped.get(selected));
  else fit(data.features);
  await changeBasemap(currentBasemap);
}

async function start() {
  $('results').setAttribute('aria-busy', 'true');
  const savedBasemap = readPreference('basemap');
  const savedTheme = readPreference('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  currentBasemap = savedBasemap || (savedTheme === 'dark' || (!savedTheme && prefersDark) ? 'dark' : 'positron');
  if (!basemaps[currentBasemap]) currentBasemap = 'positron';

  setUITheme(['light', 'dark'].includes(savedTheme) ? savedTheme : (prefersDark ? 'dark' : 'light'));
  updateBasemapControls();

  try {
    const response = await fetch('./calles.geojson', { signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error('Dataset unavailable');
    data = await response.json();
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) throw new Error('Empty dataset');

    for (const feature of data.features) {
      const name = feature.properties.NOMBRE_ART;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(feature);
    }

    catalogue = [...grouped.values()].map((f) => f[0].properties).sort((a, b) => a.NOMBRE_ART.localeCompare(b.NOMBRE_ART, 'es'));
    $('total').textContent = number(catalogue.length);
    $('segments').textContent = number(data.features.length);
    $('about-total').textContent = number(catalogue.length);
    $('about-segments').textContent = number(data.features.length);
    $('pending-count').textContent = number(catalogue.filter((p) => p.ESTADO === 'PENDIENTE').length);

    for (const type of [...new Set(catalogue.flatMap((p) => p.TIPOS_VIA.split(' | ')))].sort()) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      $('type').append(option);
    }

    catalogueReady = true;
    filterCatalogue();

    const initial = new URL(location.href).searchParams.get('calle');
    if (initial && grouped.has(initial)) selectStreet(initial, false, false);
  } catch {
    $('count').textContent = 'Error al cargar los datos';
    status('No se pudo cargar el catálogo. Comprueba la conexión y vuelve a intentarlo.', () => location.reload());
    $('results').textContent = 'El catálogo no está disponible. Puedes volver a intentarlo.';
  } finally {
    $('results').setAttribute('aria-busy', 'false');
  }
  if (catalogueReady) await initializeMap();
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

$('research-pending').addEventListener('click', () => {
  $('search').value = '';
  $('type').value = '';
  $('state').value = 'PENDIENTE';
  filterCatalogue();
  $('search').focus();
});

$('extent').addEventListener('click', () => {
  closeDetail();
  if (data) fit(data.features);
});

$('close-detail').addEventListener('click', closeDetail);

$('focus-street').addEventListener('click', () => {
  if (selected && grouped.has(selected)) {
    fit(grouped.get(selected));
    if (compactLayout.matches) $('map').scrollIntoView({ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' });
  }
});

$('prev-street').addEventListener('click', () => {
  const idx = visibleNames.indexOf(selected);
  if (idx > 0) selectStreet(visibleNames[idx - 1], true, false);
  if ($('prev-street').disabled) $('detail-name').focus();
});

$('next-street').addEventListener('click', () => {
  const idx = visibleNames.indexOf(selected);
  if (idx >= 0 && idx < visibleNames.length - 1) selectStreet(visibleNames[idx + 1], true, false);
  if ($('next-street').disabled) $('detail-name').focus();
});

// Colapso de panel lateral
$('sidebar-toggle').addEventListener('click', () => {
  const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
  $('sidebar-toggle').textContent = isCollapsed ? '▶' : '◀';
  $('sidebar-toggle').setAttribute('aria-expanded', String(!isCollapsed));
  $('sidebar-toggle').title = isCollapsed ? 'Mostrar catálogo' : 'Ocultar catálogo';
  $('sidebar').inert = isCollapsed;
  if (mapReady && map) {
    setTimeout(() => map.resize(), 260);
  }
});

// Dropdown de mapa base
const basemapMenu = $('basemap-menu');
const basemapBtn = $('basemap-btn');
const basemapDropdown = $('basemap-dropdown');

function toggleBasemapDropdown(open) {
  if (!basemapDropdown || !basemapBtn) return;
  const isOpen = open !== undefined ? open : basemapDropdown.hidden;
  basemapDropdown.hidden = !isOpen;
  basemapBtn.setAttribute('aria-expanded', String(isOpen));
  if (basemapMenu) basemapMenu.classList.toggle('open', isOpen);
}

if (basemapBtn) {
  basemapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleBasemapDropdown();
  });
}

for (const option of document.querySelectorAll('.basemap-option')) {
  option.addEventListener('click', () => {
    const styleKey = option.dataset.style;
    changeBasemap(styleKey);
    toggleBasemapDropdown(false);
  });
}

document.addEventListener('click', (e) => {
  if (basemapMenu && !basemapMenu.contains(e.target)) {
    toggleBasemapDropdown(false);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && basemapDropdown && !basemapDropdown.hidden) {
    toggleBasemapDropdown(false);
    if (basemapBtn) basemapBtn.focus();
  } else if (e.key === 'Escape' && !$('detail').hidden && $('detail').contains(document.activeElement)) {
    closeDetail();
  }
});

// Toggle de tema claro / oscuro en header
$('theme-toggle').addEventListener('click', () => {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setUITheme(nextTheme);
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

$('detail-expand').addEventListener('click', () => {
  detailExpanded = !detailExpanded;
  updateDetailPresentation();
});
compactLayout.addEventListener('change', () => {
  if (compactLayout.matches) {
    document.body.classList.remove('sidebar-collapsed');
    $('sidebar').inert = false;
    $('sidebar-toggle').textContent = '◀';
    $('sidebar-toggle').setAttribute('aria-expanded', 'true');
  }
  updateDetailPresentation();
});
if (window.ResizeObserver) {
  const observer = new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-height', document.querySelector('header').getBoundingClientRect().height + 'px');
    if (mapReady) {
      map.resize();
      if (selected && grouped.has(selected)) fit(grouped.get(selected));
    }
  });
  observer.observe(document.querySelector('header'));
  observer.observe($('map'));
}
start();
