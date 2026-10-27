# Calles con historia · Providencia

Atlas interactivo del significado, origen y contexto histórico de los **465 nombres de calles** de la comuna de Providencia, Santiago de Chile.

**Proyecto en GitHub:** [geofotodata/calles-providencia](https://github.com/geofotodata/calles-providencia)

> **Explora la aplicación en vivo:** [https://geofotodata.github.io/calles-providencia/](https://geofotodata.github.io/calles-providencia/)

---

## ¿Por qué se llaman así las calles de Providencia?

La toponimia vial (odonimia) de Providencia no es fruto del azar; refleja las sucesivas capas temporales en que la comuna transitó de un paisaje rural de chacras y conventos a uno de los polos urbanos, residenciales y culturales más vibrantes del Gran Santiago. 

Al analizar los 465 nombres de la red vial, emergen patrones históricos y culturales claramente definidos:

### 1. El origen rural, conventual y fundacional (Siglos XVIII y XIX)
* **El nombre comunal:** En 1853, las religiosas canadienses de la orden de Nuestra Señora de los Dolores establecieron el hospicio y orfanato de las **Hermanas de la Providencia** junto a la antigua Cañada o Camino de las Condes. La presencia de la congregación popularizó el nombre en la zona, dando origen al nombre de la avenida y, posteriormente, de la comuna.
* **Chacras y fundos patronales:** Muchas arterias principales siguen los deslindes y accesos de antiguos predios agrícolas:
  * **Los Leones:** Evoca el antiguo *Fundo Los Leones*, propiedad de don Pedro de Torres y luego de la familia Lyon, cuyo portón de acceso sobre el camino real lucía dos emblemáticas esculturas de leones de piedra.
  * **Tobalaba:** Topónimo de raíz prehispánica (*Thopalahue*, referido a caciques del sector y a la acequia incaica y colonial que distribuía las aguas del Mapocho).
  * **Lo Contador, El Aguilucho, Las Lilas:** Vestigios de antiguas quintas, huertos y familias tradicionales que poblaron la ribera sur del río.

### 2. Panteón republicano, estadistas y humanistas
Durante el auge del Estado docente y la consolidación de la República (1850–1920), Santiago bautizó sus ensanches urbanos con los nombres de líderes civiles, rectores, presidentes y juristas:
* **Andrés Bello:** Humanista, primer rector de la Universidad de Chile y redactor del Código Civil.
* **Presidentes de Chile:** Vías centrales como *Manuel Montt*, *José Manuel Balmaceda*, *Aníbal Pinto*, *Federico Errázuriz*, *Domingo Santa María* y *Pedro Aguirre Cerda*.
* **Reformadores y pensadores:** *Francisco Bilbao*, *José Victorino Lastarria*, *Benjamín Vicuña Mackenna* y figuras que moldearon la educación y la beneficencia local (como la educadora *Adelaide La Fetra*).

### 3. La ciudad-jardín y la naturaleza: Flora y arbolados (Años 1920–1950)
Con el surgimiento de barrios residenciales planificados bajo el modelo de la *ciudad-jardín* (como Pedro de Valdivia Norte, barrio Las Flores y conjuntos residenciales obreros y de clase media):
* Más de 36 calles y pasajes fueron bautizados con especies de la flora nativa y ornamental: *Los Aromos*, *Las Magnolias*, *Los Jacarandá*, *El Quillay*, *El Boldo*, *Los Alhelíes*, *Las Gardenias*, *Los Tulipanes* y *Los Naranjos*.

### 4. Cartografía geográfica de Chile y el mundo
* Decenas de calles rinden tributo a provincias, ríos, lagos y ciudades chilenas (*Curicó, Rancagua, Maule, Laja, Melado, Aconcagua, Coquimbo*), así como a ciudades europeas e hitos internacionales que reflejan los lazos diplomáticos y colonias residentes de la comuna.

### 5. Las calles «Sin identificar»: El desafío de la investigación
* Más de **100 nombres** corresponden a pasajes interiores, pequeños loteos de herederos o denominaciones populares que carecen de decretos de dedicación o documentación en archivos municipales. El atlas visibiliza estas ausencias con total transparencia para convocar a la investigación ciudadana.

---

## Características de la Aplicación

* **Mapa interactivo multicapa (MapLibre GL JS):** Vectorial, ligero y sin dependencias pesadas.
* **4 alternativas de mapas base:**
  * ☀️ **Claro (Positron):** Minimalista y limpio para lectura histórica.
  * 🌙 **Oscuro (Dark Matter):** Contraste nocturno de alta visibilidad.
  * 🌳 **Detallado (Liberty):** Renderizado rico con manzanas, áreas verdes y vías de OpenStreetMap.
  * 🛰️ **Satélite (Aéreo):** Ortofotografía de alta resolución de Esri World Imagery.
* **Búsqueda profunda (Full-Text):** Búsqueda instantánea no solo por nombre de calle, sino también por profesión, biografía o palabras clave (ej: *"alcalde"*, *"nobel"*, *"poeta"*, *"arquitecto"*).
* **Colores semánticos según estado de investigación:**
  * 🟢 **Reseña local (47):** Atribución histórica y dedicación confirmada.
  * 🔵 **Referente propuesto (140):** Biografía clara, vínculo con la vía en proceso de acreditación.
  * 🟣 **Significado literal (150):** Explicación del término lingüístico o geográfico.
  * 🟡 **Por corroborar / Por verificar (24):** Reseñas secundarias con dudas abiertas.
  * ⚪ **Sin identificar (104):** Pasajes o vías sin fuente documental conocida.
* **Navegación fluida:** Botón de reencuadre (`⌖ Enfocar`), navegación secuencial (`← Anterior` / `Siguiente →`) y panel lateral colapsable (`◀ / ▶`).

---

## Flujo de Datos y Actualización (Google Sheets + GitHub Actions)

La investigación de nombres se actualiza continuamente mediante una **hoja de cálculo en Google Sheets** sincronizada de forma automatizada:

```
[ Google Sheets ] ──(Publicación CSV)──> [ GitHub Action / Script ] ──> [ catalogo.csv + calles.geojson ] ──> [ GitHub Pages ]
```

### Cómo sincronizar:

1. **Desde GitHub Actions (Recomendado):**
   * En la pestaña **Actions** del repositorio, selecciona el flujo **«Sincronizar catálogo desde Google Sheets»**.
   * Haz clic en **Run workflow**, introduce la URL pública CSV de la hoja y confirma.
   * El flujo descargará los cambios, actualizará `catalogo.csv`, regenerará las propiedades en `calles.geojson`, correrá los tests unitarios y publicará los cambios en producción en ~1 minuto.
   *(También se ejecuta automáticamente a diario si configuras la variable `GOOGLE_SHEETS_CSV_URL` en los Settings del repositorio).*

   Antes de escribir cambios, la sincronización exige que cada `NOMBRE_ART` sea único y que el catálogo y el GeoJSON tengan exactamente las mismas calles. También comprueba que `N_TRAMOS` coincida con la cantidad de geometrías. Si alguna regla falla, el flujo termina sin publicar datos parciales.

2. **Desde la terminal local:**
   ```sh
   # Con Node.js:
   node sync_sheets.js "URL_CSV_GOOGLE_SHEETS"
   
   # O con Python:
   python sync_sheets.py "URL_CSV_GOOGLE_SHEETS"
   ```

---

## Ejecución Local

No requiere bases de datos ni backend, solo un servidor estático para servir los archivos GeoJSON vía HTTP:

```sh
# Con Node.js:
npx serve

# O con Python 3:
python -m http.server 8000
```

Abre `http://localhost:8000` en tu navegador.

---

## Validación y Tests

El repositorio incluye pruebas unitarias para garantizar que ningún tramo geométrico se corrompa, pierda o modifique durante las uniones con el catálogo:

```sh
python -m unittest -v test_enrich
```

* `enrich.py`: Script original de unión estricta y generación de `validation.json`.
* `test_enrich.py`: Verifica que las 2.855 geometrías de Providencia permanezcan intactas y que las frecuencias coincidan exactamente.

---

## Fuentes y Cartografía

* **Geometrías:** 2.855 tramos vectoriales aportados por el usuario (`OGC:CRS84` / WGS84).
* **Catálogo temático:** Revisión continua, documentado en [`catalogo.csv`](./catalogo.csv).
* **Teselas cartográficas:** [OpenFreeMap](https://openfreemap.org/) (OpenMapTiles / OpenStreetMap) y [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9).
* Consulta el detalle de licencias y procedencia en [`DATA_SOURCES.md`](./DATA_SOURCES.md).
