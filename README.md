# Calles con historia · Providencia

Mapa estático con MapLibre GL JS 5.6.2 y OpenFreeMap (Positron, datos OpenStreetMap). Sin claves de API ni backend.

## Explorar

- Seleccionar un tramo muestra su significado y destaca todos los registros con el mismo nombre exacto.
- Búsqueda sin distinguir mayúsculas o tildes; filtros por tipo y estado de investigación.
- Fichas con referente, descripción, fuente y límites de la investigación.
- Enlace compartible por calle y descarga del GeoJSON enriquecido.
- Catálogo navegable con teclado, disponible aunque falle el mapa base o WebGL.

## Ejecutar

Python 3.11+ para servir y validar, sin dependencias externas Python:

```sh
python -m http.server 8000
```

Abrir http://localhost:8000. No abrir index.html mediante file://: la carga de datos necesita HTTP. La visualización necesita conexión para estilo y teselas.

## Datos y actualización

El GeoJSON contiene 2.855 registros y 465 nombres. Geometrías y atributos originales conservados; se añaden campos del catálogo mediante coincidencia exacta con NOMBRE_ART. No se disuelven ni reparan segmentos. LineString y MultiLineString se mantienen. Coordenadas WGS84 longitud/latitud (OGC:CRS84); se omite el miembro CRS obsoleto en la salida RFC 7946.

Para regenerar con el original aportado:

```sh
python enrich.py Estudio_Nombres_de_calles.geojson catalogo.csv calles.geojson
python -m unittest -v test_enrich
```

El proceso falla ante claves duplicadas, nombres sin correspondencia, frecuencias distintas, CRS no admitido, geometrías vacías o coordenadas inválidas. Es idempotente; produce validation.json con conteos, hash del origen y listas de incidencias. No calcula distancias ni interpreta los campos de longitud originales.

En ArcGIS usar DESCRIPCION junto con ESTADO y NOTAS, o TEXTO_POPUP. Los textos largos necesitan campos suficientes (no truncarlos a 255 caracteres). N_TRAMOS es el número de registros con el nombre, no de calles físicas distintas.

## Investigación

Catálogo preliminar revisado el 24-10-2026: 47 reseñas locales, 140 referentes propuestos, 150 significados literales, 14 reseñas por corroborar, 104 sin identificar y 10 identidades por verificar. Una biografía no prueba la dedicación de una calle. Cada ficha mantiene fuente, URL y estado.

## GitHub Pages

En Settings → Pages seleccionar Deploy from a branch, rama main y carpeta / (root). No necesita secretos. Para revertir, revertir el commit. También sirve en cualquier hosting estático.

## Cartografía

Fondo claro. Verde azulado: red consultable; naranja con halo blanco: nombre seleccionado. No se codifica calidad histórica mediante colores. Leyenda y texto acompañan el color. Vista Web Mercator urbana, norte arriba. Seleccionar un nombre destaca incluso tramos no contiguos. La atribución OpenFreeMap, OpenMapTiles y OpenStreetMap se conserva.

Datos temáticos aportados por el usuario, no extraídos de OpenStreetMap. Licencia de esos datos no especificada: no se concede una licencia de redistribución por inferencia. Ver DATA_SOURCES.md.
