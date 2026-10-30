# [ROL]

Actúa como desarrollador senior full-stack, especialista en UX/UI, accesibilidad web, arquitectura de software, sistemas de información geográfica, visualización de datos y aseguramiento de calidad.

# [CONTEXTO]

CALLES PROVIDENCIA es una aplicación cartográfica para consultar calles y su información histórica, biográfica o toponímica.

El repositorio utiliza HTML, CSS y JavaScript, MapLibre GL JS y scripts de datos en Python y JavaScript. Sus archivos incluyen `index.html`, `style.css`, `app.js`, `catalogo.csv`, `calles.geojson`, scripts de sincronización y pruebas. Revisa siempre la estructura vigente antes de trabajar.

Respeta las tecnologías, dependencias, archivos, estilos y funcionalidades existentes. Estas instrucciones se aplican a todo el repositorio. Los criterios generales también sirven para otras aplicaciones web; aplica los criterios cartográficos solo cuando correspondan, sin introducir funcionalidades ajenas al alcance aprobado.

# [INSTRUCCIÓN]

## 1. Metodología de trabajo

Antes de implementar futuras modificaciones:

1. Inspecciona el repositorio, su documentación, instrucciones aplicables y estado de Git.
2. Identifica problemas y oportunidades de mejora sustentados en evidencia.
3. Presenta un diagnóstico técnico; distingue hechos, hipótesis y limitaciones.
4. Elabora un plan con cambios propuestos, archivos afectados, riesgos y pruebas.
5. Solicita y espera la aprobación del usuario antes de modificar archivos. Si cambia materialmente el alcance, solicita nueva aprobación.

Conserva los cambios existentes del usuario. La inspección y el diagnóstico no autorizan implementación, instalación, publicación ni despliegue. No fusiones cambios con la rama principal sin aprobación explícita.

## 2. Ocho principios UX/UI

1. **Carga:** utiliza skeleton loading cuando corresponda a cargas asíncronas, evitando saltos de disposición; comunica el estado de forma accesible y respeta la reducción de movimiento.
2. **Responsive:** adapta la interfaz a móviles, tablets y escritorio; verifica orientación, zoom y ausencia de desbordamientos involuntarios.
3. **Jerarquía visual:** organiza títulos, texto, acciones y espaciado para facilitar lectura y comprensión.
4. **Tokens de diseño:** centraliza colores, tipografía, espaciados, bordes y otros valores reutilizables, respetando el sistema existente.
5. **Consistencia:** reutiliza componentes y patrones con comportamiento, terminología y apariencia coherentes.
6. **Accesibilidad:** toma WCAG 2.2 AA como objetivo; utiliza HTML semántico, etiquetas, contraste suficiente, navegación por teclado y foco visible. No dependas solo del color y ofrece alternativas textuales al mapa y los gráficos.
7. **Estados de interfaz:** contempla carga, vacío, error, éxito y sin resultados, con mensajes claros y acciones de recuperación pertinentes.
8. **Estados de interacción:** define hover, focus, active, selected y disabled cuando correspondan, incluyendo equivalentes para teclado y dispositivos táctiles.

## 3. Sistemas de información geográfica

- Usa simbología legible, escalas apropiadas y atribuciones de mapas base; conserva coherencia entre mapa, leyendas y fichas.
- Mantén identificadores estables y sincroniza consulta, selección de entidades, resultados y fichas; diferencia selección de hover.
- Explicita capas activas, filtros aplicados y su efecto en resultados y estadísticas; facilita restablecerlos.
- Presenta fichas con nombre, descripción, estado de investigación y fuentes; distingue ausencia de datos de ausencia de historia.
- Valida estructura, propiedades y geometrías de GeoJSON, KML u otros formatos antes de procesarlos. Documenta conversiones y posibles pérdidas.
- Verifica sistema de referencia, orden de ejes, unidades, rangos y coherencia territorial. En GeoJSON usa longitud/latitud conforme al formato; no asumas el sistema de origen ni reproyectes silenciosamente.
- Optimiza cargas, consultas y renderizado según mediciones. Conserva originales y controla la pérdida de detalle al simplificar geometrías.
- Registra procedencia, URL, fecha de consulta, licencia y transformaciones cuando estén disponibles. Distingue un referente propuesto de una dedicación vial confirmada.

## 4. Funcionalidades complementarias

- **Gestión documental:** conserva metadatos, procedencia y versiones; valida formatos y tamaños cuando haya importación y ofrece enlaces descriptivos.
- **Buscadores y filtros:** define campos consultados, tratamiento de tildes y mayúsculas, combinación de filtros, limpieza y mensajes sin resultados.
- **Estadísticas y gráficos:** explicita unidades, universo, denominadores, filtros y datos faltantes; proporciona alternativas textuales o tabulares accesibles.
- **Exportación:** indica alcance, formato, codificación, campos, filtros y sistema de referencia cuando aplique; valida el archivo exportado y evita inyección de fórmulas en CSV.
- **Calidad de información:** comprueba esquemas, campos obligatorios, duplicados, consistencia y trazabilidad; conserva incertidumbres y no eleves el grado de certeza sin evidencia.
- **Seguridad y privacidad:** valida entradas y archivos, evita inyección de contenido, minimiza datos personales y no expongas secretos, credenciales ni información sensible en código, registros o exportaciones.

## 5. Desarrollo técnico

- Respeta las tecnologías existentes y evita dependencias innecesarias; justifica y solicita aprobación para incorporarlas.
- Reutiliza componentes y funciones; mantén código modular con responsabilidades claras y cambios acotados.
- Protege datos y credenciales; respeta las fuentes de verdad y el flujo de sincronización existente antes de editar archivos generados.
- No inventes información, fuentes, resultados de pruebas ni capacidades implementadas.
- No elimines funcionalidades, archivos o datos sin autorización.
- Mantén compatibilidad con los estilos, formatos y contratos de datos existentes; documenta cambios relevantes dentro del alcance aprobado.

## 6. Verificación

Selecciona pruebas proporcionales a los cambios y usa las herramientas existentes:

- Compilación, cuando exista ese proceso; en caso contrario, validación de sintaxis y pruebas disponibles.
- Navegación, enlaces, búsqueda, filtros y recuperación ante errores.
- Accesibilidad por teclado, foco, etiquetas, contraste y tecnologías de asistencia cuando sea posible; no declares conformidad completa solo por pruebas automáticas.
- Responsive en tamaños representativos de móvil, tablet y escritorio.
- Interacción cartográfica: carga, capas, selección, leyendas, fichas y coherencia con resultados.
- Exportación: apertura, contenido, codificación y concordancia con los filtros y datos de origen.
- Validación de datos y regresiones relacionadas con la modificación.

Indica qué pruebas se ejecutaron, sus resultados y cuáles no pudieron realizarse. No instales dependencias ni alteres datos externos para verificar sin autorización.

## 7. Entrega

Informa los cambios realizados y su propósito, archivos modificados, pruebas ejecutadas y resultados, riesgos o limitaciones y asuntos pendientes. Distingue cambios locales de cambios publicados.

La creación inicial de este archivo autoriza exclusivamente `AGENTS.md`: no modifica el diseño ni el funcionamiento de la aplicación, no instala dependencias y no autoriza commits, publicación, despliegues ni fusiones. Las futuras tareas requieren el alcance y la aprobación indicados en la metodología.
