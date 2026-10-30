'use strict';

// Exercise the real UI script with DOM/MapLibre doubles; no browser dependency.
// These checks complement (but do not replace) visual and assistive-technology QA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8').replace(/\nstart\(\);\s*$/, '\n');
const tokens = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const lightTokens = tokens(css.match(/:root\s*\{([^}]+)\}/)[1]);
const darkTokens = { ...lightTokens, ...tokens(css.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)[1]) };

function feature(name, state = 'PENDIENTE') {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-70.61, -33.43], [-70.60, -33.42]] },
    properties: { NOMBRE_ART: name, TIPOS_VIA: 'CALLE', N_TRAMOS: 1, ESTADO: state, REFERENTE: name,
      DESCRIPCION: 'Historia de prueba', NOTAS: '', FECHA_REV: '2026-10-26', URL_FUENTE: '', FUENTE: '' } };
}

class MapDouble {
  constructor() { this.events = new Map(); this.calls = []; this.autoLoad = true; this.style = { sources: {}, layers: [] }; }
  on(type, handler) { this.events.set(type, [...(this.events.get(type) || []), handler]); }
  once(type, handler) { this.on(type, handler); }
  off(type, handler) { this.events.set(type, (this.events.get(type) || []).filter((h) => h !== handler)); }
  emit(type, event = {}) { for (const handler of [...(this.events.get(type) || [])]) handler(event); }
  setStyle(style) {
    this.style = structuredClone(style);
    this.calls.push(structuredClone(style));
    if (this.onSetStyle) this.onSetStyle(style);
    else if (this.autoLoad) queueMicrotask(() => this.emit('style.load'));
  }
  getStyle() { return structuredClone(this.style); }
  getLayer(id) { return this.style.layers.find((layer) => layer.id === id); }
  addLayer(layer) { this.style.layers.push(layer); }
  addSource(id, source) { this.style.sources[id] = source; }
  getSource(id) {
    if (!this.style.sources[id]) return undefined;
    return { setData: (data) => { this.style.sources[id].data = data; } };
  }
  setFilter(id, filter) { this.getLayer(id).filter = filter; }
  setPaintProperty(id, property, value) { this.getLayer(id).paint[property] = value; }
  fitBounds(bounds, options) { this.fitted = { bounds, options }; }
  resize() {}
}

function fixture({ compact = false, storageBlocked = false } = {}) {
  const elements = new Map();
  const document = { activeElement: null, addEventListener() {} };
  class Element {
    constructor(id = '') {
      this.id = id; this.value = ''; this.textContent = ''; this.hidden = false;
      this.children = []; this.dataset = {}; this.attrs = {}; this.style = { setProperty() {} };
      this.isConnected = true; this.events = {}; this.className = ''; this.parent = null;
      this.rect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
      this.classList = { toggle: (name, on) => { this.attrs[name] = on; return on; }, remove: (name) => { delete this.attrs[name]; } };
    }
    setAttribute(key, value) { this.attrs[key] = value; }
    removeAttribute(key) { delete this.attrs[key]; }
    addEventListener(type, handler) { this.events[type] = handler; }
    append(...nodes) {
      for (const node of nodes) {
        if (node.fragment) this.append(...node.children);
        else { node.parent = this; this.children.push(node); }
      }
    }
    replaceChildren(...nodes) { for (const child of this.children) child.isConnected = false; this.children = []; this.append(...nodes); }
    querySelectorAll(selector) {
      return this.children.flatMap((child) => [...(child.className.split(' ').includes(selector.slice(1)) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
    focus() { document.activeElement = this; }
    scrollIntoView() {}
    getBoundingClientRect() { return this.rect; }
    click() { if (!this.disabled) { this.focus(); this.events.click?.({ stopPropagation() {} }); this.onclick?.(); } }
  }
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const element = new Element(match[1]);
    element.hidden = /\shidden(?:\s|>)/.test(match[0]);
    elements.set(element.id, element);
  }
  const el = (id) => { assert.ok(elements.has(id), 'Unknown DOM id: ' + id); return elements.get(id); };
  document.getElementById = el;
  document.body = new Element('body');
  document.documentElement = new Element('html');
  document.activeElement = document.body;
  document.createElement = () => new Element();
  document.createDocumentFragment = () => Object.assign(new Element(), { fragment: true });
  const options = ['positron', 'dark', 'liberty', 'satellite'].map((style) => Object.assign(new Element(), { dataset: { style } }));
  document.querySelectorAll = (selector) => selector === '.basemap-option' ? options : [];
  document.querySelector = () => new Element('header');
  el('detail').append(...['detail-name', 'detail-expand', 'detail-body', 'prev-street', 'next-street', 'focus-street', 'close-detail'].map(el));
  el('detail-body').append(el('detail-date'), el('detail-source'), el('copy-link'));
  el('sidebar').append(el('search'), el('results'));
  el('map').rect = { left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 };
  el('map-controls').rect = { bottom: 60 };
  el('map-overlays').rect = { top: 500 };
  el('detail').rect = { left: 510, top: 20, bottom: 500, right: 880, width: 370, height: 480 };
  const media = { matches: compact, addEventListener(type, fn) { this.onchange = fn; } };
  const saved = new Map();
  const context = {
    document, window: { matchMedia: (query) => query.includes('max-width') ? media : { matches: false } },
    localStorage: { getItem(key) { if (storageBlocked) throw new Error('Blocked'); return saved.get(key) ?? null; },
      setItem(key, value) { if (storageBlocked) throw new Error('Blocked'); saved.set(key, value); } },
    getComputedStyle: () => ({ getPropertyValue: (key) => (document.documentElement.dataset.theme === 'dark' ? darkTokens : lightTokens)[key] || '' }),
    location: { href: 'http://localhost/', reload() {} }, history: { replaceState() {} },
    console: { warn() {} }, URL, Intl, AbortSignal, AbortController, setTimeout, clearTimeout,
    fetch: async () => ({ ok: true, json: async () => ({ version: 8, sources: {}, layers: [] }) })
  };
  vm.createContext(context);
  const run = (code) => vm.runInContext(code, context);
  run(script);
  function loadFeatures(features) {
    context.__features = features;
    run('data = {type:"FeatureCollection", features: __features}; grouped = new Map(__features.map(f => [f.properties.NOMBRE_ART, [f]])); catalogue = __features.map(f => f.properties); catalogueReady = true; filterCatalogue();');
  }
  function readyMap() {
    const map = new MapDouble(); context.__map = map;
    run('map=__map; mapReady=true; lastGoodStyle=injectLayersIntoStyle(blankStyle); confirmedBasemap=currentBasemap="positron"; updateBasemapControls();');
    map.style = structuredClone(run('lastGoodStyle'));
    return map;
  }
  return { run, context, el, saved, media, document, loadFeatures, readyMap };
}

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('arranca sin localStorage y mantiene el catálogo cuando el visor no está disponible', async () => {
  const f = fixture({ storageBlocked: true });
  f.context.fetch = async () => ({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [feature('ANDRÉS BELLO')] }) });
  await f.run('start()');
  assert.equal(f.el('total').textContent, '1');
  assert.equal(f.el('results').attrs['aria-busy'], 'false');
  assert.equal(f.el('results').querySelectorAll('.street').length, 1);
  assert.equal(f.el('retry-load').hidden, false);
});

test('el tema funciona sin mapa y no cambia el mapa confirmado', () => {
  const f = fixture({ storageBlocked: true });
  f.el('theme-toggle').click();
  assert.equal(f.run('currentTheme'), 'dark');
  assert.equal(f.el('theme-toggle').attrs['aria-pressed'], 'true');
  assert.equal(f.run('currentBasemap'), 'positron');
});

test('el cambio de mapa solo se confirma tras style.load y conserva selección y filtros', async () => {
  const f = fixture(); f.loadFeatures([feature('A'), feature('B')]);
  const map = f.readyMap(); map.autoLoad = false;
  f.run('selectStreet("B"); visibleNames=["B"]');
  const change = f.run('changeBasemap("dark")'); await flush();
  assert.equal(f.el('basemap-label').textContent, 'Mapa: Claro');
  assert.equal(f.saved.has('basemap'), false);
  map.emit('style.load'); await change;
  assert.equal(f.el('basemap-label').textContent, 'Mapa: Oscuro');
  assert.equal(f.saved.get('basemap'), 'dark');
  assert.deepEqual(Array.from(map.getLayer('streets').filter[2][1]), ['B']);
  assert.equal(map.style.sources.selection.data.features[0].properties.NOMBRE_ART, 'B');
  assert.equal(f.el('map-notice').hidden, true);
  assert.equal(map.events.get('error').length, 0);
});

test('respuestas antiguas no sustituyen la última elección de mapa', async () => {
  const f = fixture(); const map = f.readyMap(); const pending = new Map();
  f.context.fetch = (url) => new Promise((resolve) => pending.set(url, resolve));
  const first = f.run('changeBasemap("dark")');
  const last = f.run('changeBasemap("liberty")');
  const response = { ok: true, json: async () => ({ version: 8, sources: {}, layers: [] }) };
  pending.get('https://tiles.openfreemap.org/styles/liberty')(response); await last;
  pending.get('https://tiles.openfreemap.org/styles/dark')(response); await first;
  assert.equal(f.saved.get('basemap'), 'liberty');
  assert.equal(map.calls.length, 1);
});

test('un tiempo de espera agotado termina en un error recuperable', async () => {
  const f = fixture(); f.readyMap(); const timers = [];
  f.context.setTimeout = (fn) => { timers.push(fn); return timers.length; };
  f.context.clearTimeout = () => {};
  f.context.fetch = (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Timeout')));
  });
  const change = f.run('changeBasemap("dark")');
  timers[0](); await change;
  assert.equal(f.el('retry-load').hidden, false);
  assert.equal(f.run('confirmedBasemap'), 'positron');
  assert.equal(f.run('basemapController'), null);
});

test('registra style.load antes de setStyle, incluso para estilos de carga inmediata', async () => {
  const f = fixture(); const map = f.readyMap();
  map.onSetStyle = () => map.emit('style.load');
  await f.run('changeBasemap("satellite")');
  assert.equal(f.run('confirmedBasemap'), 'satellite');
  assert.equal(f.el('map-notice').hidden, true);
});

test('un fallo de estilo restaura el mapa anterior y ofrece reintento', async () => {
  const f = fixture(); f.loadFeatures([feature('A')]); const map = f.readyMap();
  f.run('selectStreet("A")');
  map.onSetStyle = () => queueMicrotask(() => map.calls.length === 1
    ? map.emit('error', { error: new Error('Network failed') }) : map.emit('style.load'));
  await f.run('changeBasemap("dark")');
  assert.equal(map.calls.length, 2);
  assert.equal(f.run('confirmedBasemap'), 'positron');
  assert.equal(f.el('retry-load').hidden, false);
  assert.equal(map.style.sources.selection.data.features[0].properties.NOMBRE_ART, 'A');
  map.onSetStyle = null;
  await f.el('retry-load').onclick();
  assert.equal(f.run('confirmedBasemap'), 'dark');
  assert.equal(f.el('map-notice').hidden, true);
});

test('si una nueva petición falla mientras otra se aplica, restaura el último mapa confirmado', async () => {
  const f = fixture(); const map = f.readyMap(); map.autoLoad = false;
  const first = f.run('changeBasemap("dark")'); await flush();
  assert.equal(map.calls.length, 1);
  map.autoLoad = true;
  f.context.fetch = async () => { throw new Error('Offline'); };
  await f.run('changeBasemap("liberty")'); await first;
  assert.equal(map.calls.length, 2);
  assert.equal(f.run('confirmedBasemap'), 'positron');
  assert.equal(f.run('styleChanging'), false);
});

test('fechas: rechaza días imposibles y acepta años bisiestos', () => {
  const f = fixture();
  for (const value of ['', '2026-99-99', '2026-02-29', '2026-04-31', '2026-2-03']) {
    f.context.__date = value; assert.equal(f.run('reviewDate(__date)'), null);
  }
  assert.match(f.run('reviewDate("2024-02-29")'), /2024/);
  assert.match(f.run('reviewDate("2026-10-26")'), /octubre/);
});

test('fichas: cierre devuelve el foco a la última calle elegida', () => {
  const f = fixture(); f.loadFeatures([feature('A'), feature('B')]);
  const buttons = f.el('results').querySelectorAll('.street');
  buttons[0].click(); buttons[1].click(); f.el('close-detail').click();
  assert.equal(f.document.activeElement, buttons[1]);
  assert.equal(f.el('detail').hidden, true);
});

test('anterior/siguiente conserva el foco mientras el control siga disponible', () => {
  const f = fixture(); f.loadFeatures([feature('A'), feature('B'), feature('C')]);
  f.run('selectStreet("A")'); f.el('next-street').click();
  assert.equal(f.run('selected'), 'B');
  assert.equal(f.document.activeElement, f.el('next-street'));
});

test('ficha compacta: fuentes desplegables y restauración al pasar a escritorio', () => {
  const f = fixture({ compact: true }); f.loadFeatures([feature('A')]); f.run('selectStreet("A")');
  assert.equal(f.el('detail-body').hidden, true);
  f.el('detail-expand').click(); assert.equal(f.el('detail-body').hidden, false);
  f.el('detail-expand').click(); assert.equal(f.el('detail-body').hidden, true);
  f.media.matches = false; f.media.onchange();
  assert.equal(f.el('detail-body').hidden, false);
});

test('reencuadre respeta la ficha superpuesta, pero no reserva espacio para la ficha móvil en flujo', () => {
  const f = fixture(); f.loadFeatures([feature('A')]); const map = f.readyMap(); f.run('selectStreet("A")');
  assert.equal(map.fitted.options.padding.right, 406);
  f.media.matches = true; f.run('fit(grouped.get("A"))');
  assert.equal(map.fitted.options.padding.right, 24);
  assert.ok(map.fitted.options.padding.bottom >= 100);
});

test('búsqueda sin tildes, sin resultados y limpieza mantienen catálogo y mapa coherentes', () => {
  const f = fixture(); f.loadFeatures([feature('ANDRÉS BELLO'), feature('APOQUINDO')]); const map = f.readyMap();
  f.el('search').value = 'andres'; f.run('filterCatalogue()');
  assert.equal(f.el('results').querySelectorAll('.street').length, 1);
  f.run('selectStreet("ANDRÉS BELLO")');
  f.el('search').value = 'noexiste'; f.run('filterCatalogue()');
  assert.equal(f.el('detail').hidden, true);
  assert.equal(map.getLayer('streets').filter[2][1].length, 0);
  f.el('reset').click(); assert.equal(f.el('results').querySelectorAll('.street').length, 2);
});

test('errores de catálogo terminan la carga y mantienen una acción de recuperación', async () => {
  const f = fixture(); f.context.fetch = async () => { throw new Error('Offline'); };
  await f.run('start()');
  assert.equal(f.el('results').attrs['aria-busy'], 'false');
  assert.equal(f.el('retry-load').hidden, false);
  assert.match(f.el('results').textContent, /no está disponible/);
  f.el('search').value = 'algo'; f.run('filterCatalogue()');
  assert.match(f.el('results').textContent, /no está disponible/);
});

test('todos los textos de etiquetas de estado superan 4.5:1 en ambos temas', () => {
  const luminance = (hex) => hex.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16) / 255)
    .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  for (const palette of [lightTokens, darkTokens]) {
    for (const state of ['resena', 'referente', 'literal', 'corroborar', 'pendiente']) {
      const a = luminance(palette[`--state-${state}-text`]);
      const b = luminance(palette[`--state-${state}-bg`]);
      assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, state);
    }
  }
});

test('el mapa usa los mismos tokens que la leyenda al cambiar de tema', () => {
  const f = fixture(); const map = f.readyMap();
  f.run('setUITheme("dark")');
  assert.equal(map.getLayer('streets').paint['line-color'][3], darkTokens['--state-resena']);
  f.run('setUITheme("light")');
  assert.equal(map.getLayer('streets').paint['line-color'][3], lightTokens['--state-resena']);
});
