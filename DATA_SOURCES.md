# Procedencia y decisiones

- Geometrías: Estudio_Nombres_de_calles.geojson, aportado por el usuario. 2.855 registros, CRS declarado OGC:CRS84. SHA-256 en validation.json. Licencia original no especificada.
- Descripciones: Calles_Providencia_ArcGIS.csv, catálogo preliminar de la sesión, revisión 24-10-2026. Copia en catalogo.csv, con fuentes por nombre. No se agregaron nuevas atribuciones históricas al crear la página.
- Mapa base: https://openfreemap.org/quick_start/ y https://openfreemap.org/ — consultados el 25-10-2026. Servicio sin API key, con datos OpenStreetMap. https://tiles.openfreemap.org/styles/positron
- Visor: MapLibre GL JS 5.6.2, versión fijada y guardada en vendor/. https://maplibre.org/

Almacenamiento WGS84 longitud/latitud; visualización Web Mercator a escala urbana. Sin clasificación cuantitativa. Se distinguen selección y red por color, grosor y halo; la selección no implica mayor certeza histórica. Frecuencias de registros, no unidades geográficas independientes.

El navegador descarga los datos temáticos. Los proveedores externos reciben solicitudes para cargar biblioteca, estilo y teselas. Sin analítica, cuentas de visitantes ni geolocalización del dispositivo. Servicio de mapa externo sin SLA; errores visibles y catálogo utilizable aunque el mapa no cargue.

## Jerarquía visual según zoom · 04-11-2026

Se usa `CLASE` de cada tramo, sin modificar geometrías ni atributos originales. Es una jerarquía de representación por tipo, no una clasificación funcional oficial. `CATEGORIA` no se interpreta porque no se dispone de su diccionario.

| Tipo | Zoom 12 | Zoom 14 | Zoom 16 |
|---|---:|---:|---:|
| Autopista | 2 px | 3,5 px | 6 px |
| Avenida | 1,5 px | 3 px | 5 px |
| Calle y caletera | 0,5 px | 1,5 px | 3,5 px |
| Pasaje y peatonal | 0 px | 0,7 px | 2 px |

Se interpolan grosor y opacidad entre esos niveles; fuera del intervalo se mantienen los valores extremos. Los tramos menores aparecen gradualmente a partir de zoom 12. Los puentes usan autopista o avenida si ese tipo figura en `TIPOS_VIA` del nombre; en otro caso se representan como calle. Clases ausentes o desconocidas usan calle como alternativa visible. Esta regla de continuidad es una decisión gráfica, no una inferencia sobre la función del puente.

El color conserva el estado de investigación. La selección mantiene su halo y se muestra incluso si el tipo está oculto por zoom; el catálogo conserva todos los resultados que cumplen los filtros. Los tramos menores ocultos no reciben clics ni etiquetas al pasar el puntero. La regla se aplica a las capas temáticas en los cuatro mapas base; no modifica las calles propias del proveedor.

Referencia consultada el 04-11-2026: https://maplibre.org/maplibre-style-spec/expressions/ (`interpolate`, `zoom`, `match`) y https://maplibre.org/maplibre-style-spec/layers/ (`line-width`, `line-opacity`).

### Cuatro fondos con estilos MapLibre propios

Claro usa una paleta cálida y discreta; Oscuro, tonos verdes nocturnos; Detallado distingue parques, agua y edificios con mayor contraste cromático. Las paletas están centralizadas en `basemapPalettes` de `app.js` y se aplican mediante `customizeBasemap` a los estilos vectoriales de OpenFreeMap. Se conservan sus fuentes, atribución, filtros, niveles de zoom y geometrías. Satélite mantiene las imágenes y créditos de Esri. Los cuatro fondos reciben las mismas calles temáticas y etiquetas del catálogo. MapLibre es el motor y la especificación de estilo; OpenFreeMap/OpenStreetMap y Esri siguen siendo proveedores de datos.

### Reglas de etiquetas

Opciones adicionales: **Papel** aplica una paleta crema, sin representar cartografía histórica; **Alto contraste** usa fondo blanco y contornos oscuros, sin constituir una certificación de accesibilidad; **Solo calles** usa un fondo neutro sin teselas externas. Este último mantiene las geometrías locales, las fichas y las etiquetas; los glifos de las etiquetas siguen dependiendo de OpenFreeMap. Papel y Alto contraste reutilizan las fuentes y atribuciones del estilo Positron. El selector admite desplazamiento vertical para que las siete opciones sean accesibles en pantallas pequeñas.

Las etiquetas usan `NOMBRE_ART` y la misma clasificación por tramo: autopistas y avenidas desde zoom 12, calles y caleteras desde 14, pasajes y peatonales desde 16. Los puentes conservan la regla de continuidad descrita arriba. Los umbrales habilitan etiquetas; el motor puede omitirlas por colisión, curvatura o falta de longitud del tramo. El tamaño aumenta de 11 a 15 px entre zoom 12 y 19. Texto oscuro con halo blanco permite distinguir nombres sobre los cuatro fondos.

Las etiquetas siguen los filtros del catálogo. Se ocultan las capas de nombres viales de `transportation_name` del proveedor, conservando escudos de rutas con iconos y nombres de lugares. Esto también oculta nombres viales externos al catálogo fuera de Providencia. La imagen satelital recibe las mismas etiquetas del catálogo. Se usa Noto Sans Regular y el servicio de glifos de OpenFreeMap (también en satélite y fondo de recuperación); sin conexión las etiquetas pueden faltar, mientras el catálogo conserva los nombres. No se cambian nombres, atributos ni geometrías originales.

Estilos positron, dark y liberty consultados el 04-11-2026 en https://tiles.openfreemap.org/styles/ . Implementación basada en `symbol-placement`, `minzoom`, `text-size`, `text-allow-overlap` y `text-halo-width` de https://maplibre.org/maplibre-style-spec/layers/ .
