<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# La Central Burger — reglas UI/UX obligatorias

Estas reglas aplican a **toda interfaz nueva y toda interfaz existente que se modifique** (público, administración, reparto y checkout). Son un estándar de diseño; no autorizan refactors ni cambios funcionales fuera del pedido.

## Antes de realizar cambios

1. **Leer este \`AGENTS.md\` al comenzar cada tarea.** Respetar también la guía de Next.js indicada arriba.
2. Inspeccionar primero la pantalla, los componentes compartidos, sus estilos, loaders, formularios, tablas y patrones existentes.
3. **Reutilizar y adaptar antes de crear componentes nuevos.** Mantener consistente la identidad aprobada. No cambiar estilos globales ni otras pantallas para resolver un detalle local.
4. Respetar exactamente el alcance pedido. Si la tarea es visual, no alterar cálculos, permisos, consultas, rutas, datos ni reglas de negocio. No aprovechar para rediseñar áreas no solicitadas.

## Identidad visual, composición y tipografía

- **Minimalismo sobrio, estilo Apple/iOS en el panel administrativo:** jerarquía clara, fondos neutros, sombras suaves, bordes discretos y radios consistentes. El sitio público conserva su identidad propia oscura y sus acentos de marca.
- **Preservar las familias tipográficas y jerarquías actuales por sección**, especialmente en Home. No sustituir fuentes ni aplicar cambios tipográficos globales incidentalmente.
- **Pesos de fuente permitidos: 400, 500 y 600.** No introducir \`font-bold\` (700), \`font-extrabold\` (800), \`font-black\` (900), \`font-weight\` superior a 600 ni equivalentes en nuevos estilos. Al trabajar un componente, normalizar los pesos que se estén tocando sin reestilizar el resto del sitio.
- **Eliminar subtítulos innecesarios** debajo de títulos, explicaciones obvias, encabezados duplicados, numeraciones decorativas y textos de relleno. Conservar ayudas que sean realmente necesarias para entender el dato, la acción o una advertencia.
- **No hacer contenedores dentro de contenedores** sin necesidad: evitar cards anidadas, bordes dobles, múltiples fondos, sombras superpuestas y secciones recargadas. Separar con espacio, alineación o divisores sutiles.
- Mantener **alineación, espaciado, tamaños, alturas y proporciones** coherentes entre cabeceras, KPIs, formularios, botones y filas. Corregir desalineaciones puntuales sin cambiar la composición completa.
- Usar **naranja de marca con moderación**, para acciones primarias, selección y avisos relevantes; no colorear todo. Semántica coherente para éxito, advertencia y error, sin colores decorativos arbitrarios.
- Botones principales, secundarios, destructivos y de cancelación deben conservar un estilo y tamaño predecibles. Evitar botones enormes, iconos gratuitos y badges que no informen nada.
- Transiciones discretas de **~200 ms** (hover, foco, tabs y modales); evitar movimientos bruscos, efectos excesivos o saltos de layout.
- Usar **los mismos componentes compartidos** para inputs, selectores, calendarios, modales, confirmaciones y botones en vez de crear variantes de apariencia distinta.

## Tablas: un único patrón visual y funcional

**Toda tabla de datos nueva o modificada debe seguir un estándar uniforme**, también en Reportes; no crear estilos de tabla diferentes por módulo.

- **Referencia de interacción y encabezados ordenables:** \`src/features/recetas/components/RentabilidadOverview.tsx\`. Reutilizar/adaptar su patrón visual e indicadores de orden sin copiar y pegar implementaciones incompatibles. Referencias visuales adicionales: tablas existentes de Productos, Ingredientes y Pedidos.
- **Diseño fijo y consistente:** tipografía de 400–600, encabezado neutro, divisores sutiles, padding y altura de filas constantes, columnas bien alineadas, acciones al extremo derecho, números/importes alineados a la derecha con \`tabular-nums\`, estados mediante chips discretos. No alternar arbitrariamente entre estilos según el módulo.
- **Ordenamiento desde el encabezado** para cada columna que tenga sentido ordenar (nombre, fecha, estado, cantidad, costo, precio, margen, etc.): clic alterna ascendente/descendente, iconos visibles, estado accesible (\`aria-sort\`) y uso mediante teclado. Ordenar numéricamente los importes y cronológicamente las fechas; empates con criterio estable; valores desconocidos al final. Columnas puramente de acciones no necesitan orden.
- **Filtros según la información disponible**: buscador, categoría, estado, período u otros relevantes; ofrecer sólo los necesarios, claros y combinables. Búsqueda de texto sin distinguir tildes ni mayúsculas. Si corresponde, incluir «Todos», restauración de filtros y cantidad de resultados. No recargar con controles inútiles.
- **Paginación obligatoria** para listados de datos: reutilizar \`src/shared/components/ui/TablePagination.tsx\` (o un futuro reemplazo compartido aprobado). Mostrar total de registros, rango visible, página y navegación anterior/siguiente. Reiniciar o corregir página al cambiar filtros, orden o tamaño de conjunto. Para grandes volúmenes, paginar/ordenar/filtrar en servidor cuando corresponda; no descargar todo sin necesidad.
- **Responsive real:** tabla legible en escritorio y móvil, con scroll horizontal controlado cuando haga falta; encabezados y filas alineados, ninguna acción esencial cortada. Columna fija sólo cuando mejora la lectura y sin tapar datos.
- Estados de **carga, vacío, error y sin resultados** dentro del mismo patrón, no diseños independientes. El skeleton debe reproducir cabecera, columnas, filas y dimensiones reales de la tabla para evitar saltos.
- Conservar filtros, orden y página cuando el usuario alterna entre pestañas y vuelve a la misma vista, siempre que siga siendo válido. No reiniciarlos por remount innecesario.
- Cuando se toque una tabla existente con estética distinta, alinearla al patrón compartido **dentro del alcance solicitado**; no iniciar una reescritura global de tablas sin pedirla.

## Formularios, edición y cambios sin guardar

- **Cualquier módulo con edición de datos debe detectar cambios reales sin guardar** (crear/editar receta, producto, configuración, etc.) y proteger la navegación. No marcar cambios por cargas iniciales ni por simples filtros de consulta.
- Reutilizar \`src/shared/components/layout/AdminUnsavedChanges.tsx\`: \`AdminUnsavedChangesProvider\`, \`useAdminUnsavedChanges\` y \`useGuardedNavigation\` donde corresponda. Para confirmaciones, reutilizar \`src/shared/components/ui/ConfirmDialog.tsx\`; no duplicar modales.
- Al abandonar una edición pendiente por tab, sidebar, ruta, cancelar, cerrar modal o navegación interna, solicitar la confirmación **«Cambios sin guardar»** con opciones **«Seguir editando»** y **«Salir sin guardar»**. Para recargar/cerrar la pestaña, usar la protección nativa del navegador (\`beforeunload\`) cuando aplique; no prometer un modal personalizado en ese caso.
- «Seguir editando» conserva todos los campos; «Salir sin guardar» descarta y navega; después de un guardado exitoso se limpia el estado pendiente. Deshabilitar doble envío y conservar las validaciones existentes. Probar también navegación atrás cuando corresponda.
- Mantener campos numéricos **editables sin cero persistente**: no forzar \`0\` mientras el usuario borra o escribe un decimal. Reutilizar \`src/shared/components/ui/NumericInput.tsx\` y el parser compartido para pesos argentinos y cantidades (\`0.064\`, \`0,064\`, \`26.000,50\`); diferenciar importes, decimales e enteros con validación apropiada. No confundir representación visual con valor guardado.
- Preferir textos de error y ayuda específicos junto al campo. Mantener estilos iguales para hover, focus, disabled, validación y errores.

## Navegación, estados y accesibilidad

- Agrupar configuraciones o funcionalidades extensas en **pestañas con nombres descriptivos**. Mantener filtros, búsquedas y selecciones al cambiar de pestaña si el usuario no los restableció.
- **Skeleton loaders con la forma y dimensiones reales** del contenido (cards, métricas, tablas, formularios) para evitar saltos. No reemplazarlos arbitrariamente por spinners genéricos.
- Diseño adaptado de verdad a escritorio, tablet y móvil; sin clipping, desbordamientos involuntarios ni controles inaccesibles. Considerar teclado, foco visible, etiquetas y contraste.
- Mostrar sólo indicadores, totales, rankings y detalles relevantes; **priorizar claridad por encima de ruido visual**. No agregar una card, icono, subtítulo o sección que no ayude a tomar una decisión.

## Verificación mínima antes de entregar

- Comparar visualmente con el diseño existente y comprobar que no se cambiaron fuentes, colores ni componentes ajenos al pedido.
- Revisar escritorio y móvil, estados de carga/vacío/error, hover/foco, filtros combinados, orden asc/desc, paginación y persistencia al navegar.
- Para formularios, probar **editar → intentar salir → seguir editando / salir sin guardar → guardar**, incluido el regreso a pestañas. Probar campos vacíos, coma/punto decimal y validaciones.
- Ejecutar las verificaciones disponibles del proyecto (\`npm run typecheck\`, \`npm run lint\`, \`npm run build\` cuando correspondan) y **no declarar pruebas que no se realizaron**.
- Mantener los cambios acotados, validar antes de integrar a \`main\` y declarar si algo todavía requiere prueba manual.
