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
