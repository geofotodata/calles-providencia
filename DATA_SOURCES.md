# Procedencia y decisiones

- Geometrías: Estudio_Nombres_de_calles.geojson, aportado por el usuario. 2.855 registros, CRS declarado OGC:CRS84. SHA-256 en validation.json. Licencia original no especificada.
- Descripciones: Calles_Providencia_ArcGIS.csv, catálogo preliminar de la sesión, revisión 24-10-2026. Copia en catalogo.csv, con fuentes por nombre. No se agregaron nuevas atribuciones históricas al crear la página.
- Mapa base: https://openfreemap.org/quick_start/ y https://openfreemap.org/ — consultados el 25-10-2026. Servicio sin API key, con datos OpenStreetMap. https://tiles.openfreemap.org/styles/positron
- Visor: MapLibre GL JS 5.6.2, versión fijada y guardada en vendor/. https://maplibre.org/

Almacenamiento WGS84 longitud/latitud; visualización Web Mercator a escala urbana. Sin clasificación cuantitativa. Se distinguen selección y red por color, grosor y halo; la selección no implica mayor certeza histórica. Frecuencias de registros, no unidades geográficas independientes.

El navegador descarga los datos temáticos. Los proveedores externos reciben solicitudes para cargar biblioteca, estilo y teselas. Sin analítica, cuentas de visitantes ni geolocalización del dispositivo. Servicio de mapa externo sin SLA; errores visibles y catálogo utilizable aunque el mapa no cargue.
