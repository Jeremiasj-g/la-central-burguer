<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# La Central Burger — ingeniería y calidad obligatorias

## 0. Protocolo obligatorio antes de responder o modificar código
Este archivo **no se carga automáticamente en todas las integraciones de ChatGPT/GitHub**. Cualquier asistente o desarrollador que trabaje en este repositorio debe **abrir el `AGENTS.md` de la rama activa antes de cada pedido de cambios**; no esperar a que el usuario lo recuerde ni a recibir un comando `/agents.md`.

1. **Leer y delimitar:** leer este `AGENTS.md`, identificar la rama solicitada y examinar el código real, sus componentes reutilizables y las reglas aplicables. Si se cambia un componente compartido, localizar sus consumidores.
2. **Preparar la verificación:** definir antes de editar qué debe funcionar y cómo comprobarlo. No confundir una captura, un build correcto o el texto de `AGENTS.md` con una prueba funcional.
3. **Implementar respetando contratos:** preservar cálculos, permisos, persistencia y rutas no solicitadas. Para cambios de UI, comprobar expresamente:
   - Tablas: filtros pertinentes, combinación con búsqueda, ordenamiento, paginación, estados vacío/error/carga y lectura sin scroll horizontal en escritorio **cuando sea viable**; respetar el estándar de tablas de este archivo.
   - Dropdowns y calendarios: usar `Select.tsx`, `SearchableSelect.tsx` y `DatePickerField.tsx` según corresponda, con posición, teclado y apertura/cierre correctos en ~200 ms y colores acordes al estilo de La Central Burger.
   - Modales, tabs y secciones expandibles: transiciones discretas en entrada y salida de ~200 ms, con `prefers-reduced-motion`.
   - Skeletons ajustados a las dimensiones del contenido, sin saltos de layout.
   - Formularios: validaciones, doble envío y confirmación de cambios pendientes.
   - Responsive y accesibilidad: foco visible, labels, contraste y pantallas móviles.
   Si una regla no aplica, explicarlo brevemente al revisar; no omitirla por olvido.
4. **Auditar antes del push:** revisar el diff contra estas reglas; ejecutar los controles disponibles de tipos, lint, tests y build (si el entorno lo permite), además de pruebas manuales relacionadas. **No marcar como comprobado aquello que no se ejecutó.**
5. **Publicación controlada:** preferir un commit/push por pedido y por rama, salvo una corrección excepcional; **no hacer merge a `main` por iniciativa propia**. Actualizar directamente `main` solo cuando el usuario lo solicite explícitamente, como en este pedido de documentación. Si existe plantilla de PR y controles de CI, respetarlos; nunca asumir que verificaciones automáticas o visuales se ejecutaron sin comprobarlo.

Estas reglas aplican a todo La Central Burger (pantallas, modales, componentes, datos y cambios nuevos). Antes de modificar una interfaz, revisar los componentes existentes y seguir estas pautas. Si una indicación explícita del pedido exige otra solución, respetarla sin cambiar funcionalidades ajenas.


Estas reglas aplican a toda modificación de código, base de datos, configuración o despliegue. **Prioridad: soluciones intuitivas, simples, seguras y mantenibles.** No autorizan modificar datos ni módulos fuera del alcance pedido.

## Antes de programar

1. Leer `AGENTS.md`, inspeccionar el **código real y el esquema vigente** e identificar dependencias y consumidores; los documentos pueden estar desactualizados. No tomar ninguna descripción antigua como fuente de verdad.
2. Determinar qué debe cambiar y qué debe permanecer igual. Revisar los flujos relacionados antes de intervenir: Recetas ↔ Costos ↔ Reportes, Pedidos ↔ Cobros ↔ Delivery, etc.
3. Resolver la causa raíz, no tapar síntomas ni introducir soluciones temporales. Mantener el cambio acotado; no reorganizar módulos ajenos al pedido.
4. **Todo debe ser intuitivo y fácil de usar:** priorizar recorridos predecibles, nombres claros, pocos pasos, instrucciones precisas y errores accionables. No exigir conocimientos técnicos al usuario ni trasladarle complejidad interna del sistema.

## Arquitectura, cohesión y acoplamiento

- **Código corto, preciso y conciso:** funciones, componentes y módulos con una responsabilidad clara y **alta cohesión** (todo lo que contienen sirve a un único propósito) y **bajo acoplamiento** (dependen lo mínimo posible entre sí). Evitar componentes gigantes, funciones que hacen todo, estados globales innecesarios y parámetros excesivos. Extraer piezas cuando tengan responsabilidades distintas; no fragmentar artificialmente ni imponer límites arbitrarios de líneas.
- Mantener el flujo actual **UI → hooks → services → Supabase**: los componentes presentan e interactúan, los hooks organizan estado, los services concentran acceso a datos y las utilidades puras encapsulan cálculos. No ejecutar consultas Supabase directamente en componentes visuales ni duplicar la misma regla de negocio en frontend y backend sin necesidad.
- Reutilizar lógica y tipos existentes, preferir nombres expresivos, interfaces explícitas y funciones pequeñas que se puedan probar. Aplicar **KISS, DRY y YAGNI**: la implementación más simple que resuelva el requisito real, sin abstracciones o dependencias especulativas.
- Conservar contratos, rutas y comportamientos vigentes. Si se modifica una función compartida, revisar sus consumidores y prevenir regresiones. No mezclar cambios de estilo, lógica y persistencia sin motivo.

## Supabase y diseño de base de datos

- **Toda tabla nueva debe ser escalable, específica de un dominio y diseñada como mínimo en tercera forma normal (3FN)**: atributos atómicos (1FN), dependencias de la clave completa (2FN) y **sin dependencias transitivas entre atributos no clave** (3FN). No crear tablas «todoterreno», columnas repetidas, listas separadas por comas o duplicación de entidades. Para relaciones muchos-a-muchos, usar tablas de unión y claves foráneas.
- Garantizar **alta cohesión y bajo acoplamiento entre entidades**: cada tabla representa un concepto bien definido; relacionarlas mediante PK/FK y restricciones explícitas, no mediante campos duplicados o convenciones implícitas. Definir `NOT NULL`, `UNIQUE`, `CHECK`, FK, reglas de eliminación e índices según integridad y consultas reales. Evitar borrados en cascada que destruyan historial.
- **Las excepciones de desnormalización deben justificarse y documentarse** (p. ej., instantáneas históricas inmutables de precio/costo al vender o agregados medidos por rendimiento). No recalcular ni reemplazar un dato histórico porque cambió el catálogo actual.
- Antes de cambiar esquema, funciones, triggers, políticas o Edge Functions, revisar dependencias, RLS y permisos. Registrar cada cambio de esquema en **migraciones SQL versionadas** y verificar su ejecución; preparar reversión y evitar operaciones destructivas en producción. Los backfills deben ser explícitos, acotados, auditables e idempotentes; **no modificar datos reales ni corregir históricos sin autorización expresa**.
- **Supabase es la fuente de verdad** de pedidos, costos, usuarios y datos administrativos. No usar `localStorage` como sustituto de datos de negocio; reservarlo para estados temporales previstos (carrito y borrador del checkout).

## Seguridad, pagos e integridad histórica

- Validar **autenticación y autorización en el servidor y la base** (roles, RLS y funciones privilegiadas); ocultar un botón no sustituye permisos. No exponer secretos ni claves `service_role` en cliente, logs o Git; minimizar acceso y verificar entradas también en el backend.
- **Preservar ventas, precios aplicados, costos snapshot, cobros, reintegros, cancelaciones y auditoría.** Cambiar recetas o precios actuales nunca modifica automáticamente instantáneas históricas. Un backfill necesita alcance, fecha de vigencia y confirmación del negocio.
- Para cobros y movimientos financieros, priorizar **transacciones atómicas**, validaciones de saldo, idempotencia y trazabilidad. Evitar dobles confirmaciones y operaciones parcialmente guardadas; no inferir un pago confirmado sólo a partir del método de pago elegido.

## Validación, rendimiento y configuración

- Validar datos en las fronteras de entrada y en servidor/SQL: tipos, rangos, cantidades, importes, unidades compatibles, referencias, ciclos y estados permitidos. Errores concretos y recuperables; no silenciar excepciones ni declarar éxito antes de confirmar persistencia.
- Diseñar consultas eficientes: filtrar, ordenar y paginar en servidor cuando el volumen lo requiera; evitar N+1, lecturas redundantes y descargar toda la historia para mostrar una página. Crear índices según patrones reales de consulta y comprobar el impacto antes de optimizar.
- Toda variable de entorno nueva debe quedar documentada en `.env.example` con propósito, obligatoriedad y alcance. Distinguir `NEXT_PUBLIC_*` de variables sólo servidor; comprobar activaciones de funcionalidades, RPC y dependencias. Clonar código, BD y Edge Functions **no replica automáticamente** secretos, Auth, Storage ni configuraciones del proveedor.

## Pruebas, Git y entrega

- Para cada cambio, comprobar caso normal, límites, error y regresiones de módulos relacionados. Agregar o adaptar pruebas automatizadas para cálculos, permisos, validaciones, recetas, cobros y otros flujos críticos; cuando sea posible probar cambios SQL con transacciones reversibles.
- Ejecutar al menos las verificaciones pertinentes disponibles (`npm run typecheck`, `npm run lint`, `npm run build`) y revisar el resultado real. **Compilar no sustituye probar el flujo**; separar lo verificado de lo pendiente de prueba manual.
- Trabajar sobre una rama específica, mantener diffs pequeños y revisar antes de fusionar a `main`. Registrar cambios de esquema en el repositorio y mantener documentación afectada sin duplicarla; no actualizar documentación obsoleta como sustituto de analizar el código.
- Verificar CI, despliegue de Vercel y ambiente de destino antes de afirmar que producción está lista. No confundir merge exitoso con despliegue completado. No ejecutar migraciones o cambios de datos de producción fuera de lo autorizado.

---

# La Central Burger — reglas UI/UX obligatorias

Estas reglas aplican a **toda interfaz nueva y toda interfaz existente que se modifique** (público, administración, reparto y checkout). Son un estándar de diseño; no autorizan refactors ni cambios funcionales fuera del pedido.

## Antes de realizar cambios

1. **Leer este `AGENTS.md` al comenzar cada tarea.** Respetar también la guía de Next.js indicada arriba.
2. Inspeccionar primero la pantalla, los componentes compartidos, sus estilos, loaders, formularios, tablas y patrones existentes.
3. **Reutilizar y adaptar antes de crear componentes nuevos.** Mantener consistente la identidad aprobada. No cambiar estilos globales ni otras pantallas para resolver un detalle local.
4. Respetar exactamente el alcance pedido. Si la tarea es visual, no alterar cálculos, permisos, consultas, rutas, datos ni reglas de negocio. No aprovechar para rediseñar áreas no solicitadas.

## Identidad visual, composición y tipografía

- **Modo claro y oscuro obligatorio en módulos públicos nuevos:** toda pantalla o flujo visible por clientes (cuenta, perfil, pedidos, promociones, modales, formularios y estados de carga/error) debe diseñarse y probarse desde el inicio en ambas variantes. Reutilizar `src/shared/components/layout/PublicThemeProvider.tsx`, `usePublicTheme()` y `PublicThemeToggle`; **no forzar `text-white`, fondos oscuros ni variables que solo sean legibles en modo oscuro**. Para cada fondo, definir contraste de títulos, texto secundario, bordes, controles, placeholders, botones, focos, skeletons, vacíos y modales en light y dark. El cambio de modo debe ser consistente con el resto de la web y persistir la preferencia del usuario. Verificar escritorio y móvil, el header y los overlays del drawer en ambos temas antes de entregar.
- **Navegación dentro de paneles públicos:** al cambiar de sección en un sidebar, drawer o tabs, el cambio debe percibirse como navegación de una app y nunca reemplazar todo el contenido abruptamente. Animar entrada y salida con desplazamiento/recorte breve (~200 ms), sin usar el fade como mecanismo principal. Mientras se resuelve o intercambia el contenido, mostrar **skeletons con la misma geometría** de la vista de destino (campos para perfil, filas para pedidos, etc.), tanto en claro como en oscuro, evitando saltos de layout. No simular cargas largas ni volver a consultar datos sin necesidad. Para drawers móviles, implementar **animación real de apertura y cierre**, mantener montado durante el cierre, bloquear scroll de fondo y respetar Escape, foco y `prefers-reduced-motion`. **Eliminar etiquetas redundantes sobre títulos** (como «Espacio personal») y subtítulos explicativos obvios: el título de la sección y su contenido bastan.
### Navegación entre páginas y feedback táctil (obligatorio)

**Regla estricta:** ningún enlace interno ni botón interactivo nuevo o modificado puede sentirse «sin respuesta». Antes de implementar navegación o acciones, revisar el comportamiento real y reutilizar los mecanismos compartidos; **no crear loaders, animaciones ni CSS paralelos por pantalla**.

- **Cambio de ruta pública:** conservar `Link`/App Router y el feedback central de `src/shared/components/layout/PublicNavigationFeedback.tsx`, montado desde `src/app/(public)/layout.tsx`. Ante una navegación interna real pendiente por más de **140 ms**, mostrar la línea superior naranja y el velo oscuro; no mostrarlo en navegación inmediata, enlaces externos, apertura de modales ni desplazamiento a anclas. No bloquear clics ni retrasar artificialmente el cambio de ruta.
- **Identidad exacta del velo:** mantener estilos en `src/app/(public)/public.css` (`.lcb-navigation-feedback`, `.lcb-navigation-progress`, `.lcb-navigation-veil`), con negro al **24 % en tema claro** y **34 % en tema oscuro**, entrada/salida discreta ~180–200 ms. La línea de progreso es visual, no un porcentaje de carga ficticiamente preciso; ocultar el feedback al completar/cancelar una navegación y prever recuperación ante bloqueos, retroceso y restauración de página. No reemplazarlo por un spinner global.
- **Entrada de página:** mantener `src/app/(public)/template.tsx` y `.lcb-public-route-enter` con transición sutil de ~200 ms. Las secciones internas (tabs/sidebar/drawer) mantienen sus skeletons y animaciones propias; no disparar navegación de ruta ni overlays globales al cambiar un tab.
- **Botones y enlaces de acción:** al presionar (`:active`), reducir temporalmente a **`scale: .965`** y recuperar suavemente en **~180 ms**. Respetar hover, `disabled`, `loading`, doble clic y retorno visual; **no aplicar escala a inputs, contenedores ni elementos no interactivos**, ni sobrescribir transformaciones de otros componentes. Reutilizar estilos compartidos y marcar explícitamente como `lcb-pressable` los enlaces que deban comportarse como botones.
- **Foco y accesibilidad:** el anillo `:focus-visible` debe distinguirse claramente (naranja de marca) y seguir visible al navegar con teclado; no confundir el foco persistente con el feedback temporal de presión. Mantener `aria-label`/nombre accesible, navegación por teclado y `prefers-reduced-motion`: desactivar escala y animaciones, preservando navegación y estados entendibles.
- **Alcance:** este sistema de navegación es para el **sitio público**; no imponer sus estilos sobre Admin/Delivery sin pedido explícito. Si un control especial necesita una excepción, documentarla junto al código y preservar el mismo estándar de respuesta.
- **Chequeo obligatorio antes de entregar:** probar Inicio ↔ Mi cuenta, clics rápidos y lentos, botón Atrás/Adelante, navegación por anclas, enlaces externos, móviles, teclado, ambos temas, estados `disabled`/`loading` y movimiento reducido. Verificar que el velo no se quede visible ni aparezca en interacciones sin navegación. **Si no se pudieron ejecutar estas pruebas, declararlo expresamente y no afirmar que está validado.**

- **Fondos de drawers y paneles superpuestos:** todo drawer que cubra contenido visible debe incorporar un backdrop semitransparente con **desenfoque real del fondo** (`backdrop-filter: blur(...)`, con prefijo WebKit cuando corresponda), sin desenfocar el panel del drawer ni sus textos. Mantener el blur al abrir y cerrar junto a la animación suave de ~200 ms, con contraste suficiente en claro/oscuro y compatibilidad con `prefers-reduced-motion`; no usar solo opacidad o un fondo opaco como sustituto del desenfoque. Verificar visualmente en móvil y escritorio cuando aplique.
- **Pantallas de cuenta y áreas personales:** pueden disponer de su propia composición administrativa ligera con sidebar/drawer y header mínimo cuando la experiencia lo justifique; no incluir automáticamente el footer comercial de Home. Reutilizar la identidad y el selector de tema existentes sin modificar el header público global para un caso especial. En móviles, el drawer debe tener backdrop, botón de cierre, controles accesibles y respetar el foco.
- **Minimalismo sobrio, estilo Apple/iOS en el panel administrativo:** jerarquía clara, fondos neutros, sombras suaves, bordes discretos y radios consistentes. El sitio público conserva su identidad propia oscura y sus acentos de marca.
- **Preservar las familias tipográficas y jerarquías actuales por sección**, especialmente en Home. No sustituir fuentes ni aplicar cambios tipográficos globales incidentalmente.
- **Pesos de fuente permitidos: 400, 500 y 600.** No introducir `font-bold` (700), `font-extrabold` (800), `font-black` (900), `font-weight` superior a 600 ni equivalentes en nuevos estilos. Al trabajar un componente, normalizar los pesos que se estén tocando sin reestilizar el resto del sitio.
- **Eliminar subtítulos innecesarios** debajo de títulos, explicaciones obvias, encabezados duplicados, numeraciones decorativas y textos de relleno. Conservar ayudas que sean realmente necesarias para entender el dato, la acción o una advertencia.
- **No hacer contenedores dentro de contenedores** sin necesidad: evitar cards anidadas, bordes dobles, múltiples fondos, sombras superpuestas y secciones recargadas. Separar con espacio, alineación o divisores sutiles.
- Mantener **alineación, espaciado, tamaños, alturas y proporciones** coherentes entre cabeceras, KPIs, formularios, botones y filas. Corregir desalineaciones puntuales sin cambiar la composición completa.
- Usar **naranja de marca con moderación**, para acciones primarias, selección y avisos relevantes; no colorear todo. Semántica coherente para éxito, advertencia y error, sin colores decorativos arbitrarios.
- Botones principales, secundarios, destructivos y de cancelación deben conservar un estilo y tamaño predecibles. Evitar botones enormes, iconos gratuitos y badges que no informen nada.
- Transiciones discretas de **~200 ms** (hover, foco, tabs y modales); evitar movimientos bruscos, efectos excesivos o saltos de layout.
- **Componentes compartidos como única referencia visual:** los dropdowns, calendarios, popovers, modales y mensajes deben seguir el estándar y las rutas de la sección siguiente; no usar variantes improvisadas.

## Componentes compartidos y consistencia visual

**Regla central: un componente, una identidad visual.** Antes de crear un control, buscar si ya existe uno compartido. Reutilizarlo; si hace falta mejorar un comportamiento o apariencia, adaptar el componente compartido con una variante explícita y comprobar los demás lugares donde se usa. No copiar estilos ni crear alternativas locales sin una necesidad funcional justificada. Las variantes pueden diferir en interacción, pero deben conservar la misma identidad.

- **Dropdown estándar:** usar `src/shared/components/ui/Select.tsx` (variantes `light` / `dark`). **Dropdown con búsqueda:** usar `src/shared/components/ui/SearchableSelect.tsx` cuando haya muchas opciones. Respetar trigger, panel, tipografía, radio, espaciado, iconos, opción activa y seleccionada, estados de foco y animación. **No introducir `<select>` nativos sin estilo ni menús desplegables hechos desde cero** cuando estos componentes resuelven la necesidad; justificar excepciones técnicas o de accesibilidad.
- **Calendarios:** usar `src/shared/components/ui/DatePickerField.tsx` y conservar su presentación, navegación, selección, formato argentino, límites de fecha y comportamiento al abrir/cerrar. No incorporar `<input type="date">` sin estilo, librerías o calendarios visualmente distintos salvo que el caso lo exija y se integre al mismo sistema.
- **Menús, popovers y tooltips:** aplicar el estilo de los selectores existentes: bordes, colores, sombras, tamaño de texto y animaciones consistentes. Deben abrir en posición visible, ajustarse al viewport y **no quedar tapados o recortados** por tablas, drawers o modales. Usar portal cuando sea necesario; cerrar al seleccionar, hacer clic fuera o presionar Escape, y permitir uso con teclado, foco y dispositivos táctiles. No abusar de tooltips si la etiqueta puede ser clara.
- **Modales y drawers:** reutilizar `src/shared/components/ui/Modal.tsx`, `Drawer.tsx` y `ConfirmDialog.tsx`; respetar sus temas, tamaños, foco, scroll, bloqueo de fondo, cierre y transiciones. Confirmaciones destructivas o relevantes deben indicar qué acción se ejecutará. Para ediciones pendientes seguir además el flujo de «Seguir editando / Salir sin guardar» ya definido.
- **Avisos y notificaciones:** reutilizar los toasts existentes de `react-toastify`, configurados en `src/providers/AppProviders.tsx`; mantener apariencia, duración y ubicación coherentes para éxito, información, advertencia y error. No introducir `alert()`, `confirm()`, `prompt()` ni sistemas de notificaciones paralelos en la interfaz.
- **Dimensiones y espaciados:** tomar como referencia `src/shared/components/ui/Button.tsx`, `Input.tsx`, `NumericInput.tsx`, `Select.tsx` y los controles equivalentes ya aprobados. Altura, padding, bordes, radios, sombra, tipografía y separación deben ser consistentes en una misma pantalla; no mezclar tamaños arbitrarios ni forzar estilos con overrides innecesarios. Respetar las variantes claro/oscuro de cada contexto.
- **Estados y accesibilidad obligatorios:** normal, hover, focus visible, abierto/seleccionado, disabled, loading, vacío y error donde apliquen. Asegurar etiqueta accesible, navegación por teclado, Escape, contraste, touch targets y foco predecible; no ocultar opciones importantes por desbordes o z-index.
- **Revisión de reutilización:** antes de finalizar, contrastar visualmente los nuevos controles con sus componentes de referencia en escritorio y móvil; verificar apertura/cierre, scroll, superposición con modales y tablas, selección, búsqueda, validaciones y mensajes. No afirmar que se probó un estado sin haberlo comprobado.

## Estándar visual de modales, botones y controles de selección

- **Referencia de administración:** `src/features/access/components/AccessUserModal.tsx` (modal «Nuevo usuario») es el patrón visual para formularios administrativos. Reutilizar su apariencia de encabezados, campos, márgenes y controles sin copiar elementos irrelevantes.
- **Tipografía:** títulos de modales, botones, dropdowns y opciones seleccionadas con pesos entre 400 y 600; evitar `font-bold`, `font-extrabold` y `font-black`, incluso en componentes compartidos.
- **Botones:** usar `Button.tsx`; Guardar/Crear/Enviar en `primary` (naranja), Cancelar en `secondary`, acciones destructivas en `danger`. El pie de un modal debe tener padding lateral e inferior proporcional al formulario y no pegar los botones al borde.
- **Checkbox:** cuadrado de bordes suaves, color neutro sin seleccionar, naranja con tilde blanca seleccionado, foco naranja y estados accesibles. Evitar checkbox azul nativo en el panel.
- **Switch:** pista gris al desactivar, naranja al activar, círculo blanco y transición ~200 ms; etiqueta y control por teclado. Usarlo para activar/desactivar, no para selección múltiple.
- **Selects y calendarios:** reutilizar `Select.tsx`, `SearchableSelect.tsx` y `DatePickerField.tsx`; conservar pesos <=600, estados hover/focus/disabled, y comprobar que popovers no se recorten.
- **Antes de entregar:** comparar cada nuevo formulario con el modal de usuarios en escritorio y móvil, incluyendo checkbox, switch, selects, placeholders, botón primario, cancelación y márgenes.


### Control preventivo de encabezados de modales (obligatorio)

- `Modal.tsx` es la **fuente única** del título: por defecto `font-semibold` (600), tamaño y espacios coherentes con `AccessUserModal.tsx`. No aplicar `font-black`, `font-bold`, estilos inline con pesos mayores a 600 ni variantes locales que eleven el peso.
- Antes de agregar o tocar cualquier modal, revisar el encabezado **en el propio `Modal.tsx`** y buscar overrides `titleClassName` / `headerClassName` que rompan la regla. Corregir en el origen común, no mediante parches dispersos.
- En la revisión del diff, buscar explícitamente `font-black`, `font-extrabold`, `font-bold` y `font-weight: 700/800/900` en componentes modificados. Verificar títulos de creación y edición en escritorio y móvil.

## Tablas: un único patrón visual y funcional

**Toda tabla de datos nueva o modificada debe seguir un estándar uniforme**, también en Reportes; no crear estilos de tabla diferentes por módulo.

- **Referencia de interacción y encabezados ordenables:** `src/features/recetas/components/RentabilidadOverview.tsx`. Reutilizar/adaptar su patrón visual e indicadores de orden sin copiar y pegar implementaciones incompatibles. Referencias visuales adicionales: tablas existentes de Productos, Ingredientes y Pedidos.
- **Diseño fijo y consistente:** tipografía de 400–600, encabezado neutro, divisores sutiles, padding y altura de filas constantes, columnas bien alineadas, acciones al extremo derecho, números/importes alineados a la derecha con `tabular-nums`, estados mediante chips discretos. No alternar arbitrariamente entre estilos según el módulo.
- **Ordenamiento desde el encabezado** para cada columna que tenga sentido ordenar (nombre, fecha, estado, cantidad, costo, precio, margen, etc.): clic alterna ascendente/descendente, iconos visibles, estado accesible (`aria-sort`) y uso mediante teclado. Ordenar numéricamente los importes y cronológicamente las fechas; empates con criterio estable; valores desconocidos al final. Columnas puramente de acciones no necesitan orden.
- **Filtros según la información disponible**: buscador, categoría, estado, período u otros relevantes; ofrecer sólo los necesarios, claros y combinables. Búsqueda de texto sin distinguir tildes ni mayúsculas. Si corresponde, incluir «Todos», restauración de filtros y cantidad de resultados. No recargar con controles inútiles.
- **Paginación obligatoria** para listados de datos: reutilizar `src/shared/components/ui/TablePagination.tsx` (o un futuro reemplazo compartido aprobado). Mostrar total de registros, rango visible, página y navegación anterior/siguiente. Reiniciar o corregir página al cambiar filtros, orden o tamaño de conjunto. Para grandes volúmenes, paginar/ordenar/filtrar en servidor cuando corresponda; no descargar todo sin necesidad.
- **Responsive real:** tabla legible en escritorio y móvil, con scroll horizontal controlado cuando haga falta; encabezados y filas alineados, ninguna acción esencial cortada. Columna fija sólo cuando mejora la lectura y sin tapar datos.
- Estados de **carga, vacío, error y sin resultados** dentro del mismo patrón, no diseños independientes. El skeleton debe reproducir cabecera, columnas, filas y dimensiones reales de la tabla para evitar saltos.
- Conservar filtros, orden y página cuando el usuario alterna entre pestañas y vuelve a la misma vista, siempre que siga siendo válido. No reiniciarlos por remount innecesario.
- Cuando se toque una tabla existente con estética distinta, alinearla al patrón compartido **dentro del alcance solicitado**; no iniciar una reescritura global de tablas sin pedirla.

## Validaciones y mensajes en formularios (obligatorio)

- **Validar en dos capas:** bloquear opciones inválidas desde la UI y volver a validar datos y permisos en servidor/RPC/SQL. No confiar solamente en `disabled`, límites visuales, tipos de input o campos obligatorios del navegador; ni dar por exitoso un guardado sin confirmación del backend.
- **Analizar reglas de negocio antes de implementar cada operación:** campos obligatorios y opcionales; tipos, longitudes, formatos, rangos, precisión monetaria, valores extremos, relaciones, roles, duplicados, coherencia entre campos, estados y transiciones, concurrencia e idempotencia. No imponer restricciones arbitrarias sin respaldo funcional.
- **Fechas y zonas horarias:** distinguir fechas de hechos (asistencia realizada, pago efectivamente entregado, aprobación de hecho) de planificación (vigencias futuras, reservas, programación). **No permitir fechas futuras en registros de hechos ya ocurridos**, salvo regla expresa; para fechas programables permitir futuro según el caso. Calcular el «hoy» del negocio con zona `America/Argentina/Buenos_Aires`, comparar días calendario (YYYY-MM-DD) y no convertir fechas locales a UTC inadvertidamente. En calendarios deshabilitar fechas fuera de rango; validar nuevamente antes de guardar y en base de datos. Una fecha futura que quedó registrada por error no debe aprobarse automáticamente.
- **Validaciones cruzadas:** fecha inicial <= final, no liquidar jornadas pendientes ni períodos solapados, no pagar por encima del saldo, no reutilizar una clave de idempotencia para datos distintos; conservar instantáneas e historial en correcciones y reversiones. Comprobar que el recurso elegido existe y sigue habilitado para la operación, incluso si cambió mientras el formulario estaba abierto.
- **Campos y placeholders:** todo campo de texto libre, búsqueda, importes y observaciones debe tener etiqueta visible y un placeholder **breve, descriptivo y específico**, que muestre qué ingresar (p. ej. «Nombre y apellido», «Buscar empleado», «Ej.: 2500,50», «Motivo de corrección»). No usar placeholders genéricos («Escribir aquí», «Opcional», «0») cuando no aportan información. Un placeholder no reemplaza el label, la ayuda necesaria ni el valor existente.
- **Mensajes accionables:** mostrar el error junto al campo cuando sea posible y/o toast consistente, indicando exactamente qué corregir («No se puede registrar una asistencia posterior a hoy»), sin errores técnicos ni avisos genéricos. Marcar/deshabilitar acciones inválidas sin ocultar el motivo. Evitar datos inválidos silenciosos o truncamientos sorpresivos.
- **Pruebas mínimas por campo y operación:** caso válido, vacío, formato incorrecto, límites incluidos/excluidos, fecha anterior/hoy/mañana y cambio de día, duplicidad, permisos insuficientes, errores de red y doble envío. Para pagos y asistencias comprobar también intentos de eludir la interfaz mediante RPC y que los rechazos no generen cambios parciales.
- **Alcance:** aplicar estas reglas a todo módulo **nuevo o que se modifique**, revisando consumidores compartidos; no lanzar cambios masivos en módulos ajenos al pedido sin auditoría y pruebas.

## Formularios, edición y cambios sin guardar

- **Cualquier módulo con edición de datos debe detectar cambios reales sin guardar** (crear/editar receta, producto, configuración, etc.) y proteger la navegación. No marcar cambios por cargas iniciales ni por simples filtros de consulta.
- Reutilizar `src/shared/components/layout/AdminUnsavedChanges.tsx`: `AdminUnsavedChangesProvider`, `useAdminUnsavedChanges` y `useGuardedNavigation` donde corresponda. Para confirmaciones, reutilizar `src/shared/components/ui/ConfirmDialog.tsx`; no duplicar modales.
- Al abandonar una edición pendiente por tab, sidebar, ruta, cancelar, cerrar modal o navegación interna, solicitar la confirmación **«Cambios sin guardar»** con opciones **«Seguir editando»** y **«Salir sin guardar»**. Para recargar/cerrar la pestaña, usar la protección nativa del navegador (`beforeunload`) cuando aplique; no prometer un modal personalizado en ese caso.
- «Seguir editando» conserva todos los campos; «Salir sin guardar» descarta y navega; después de un guardado exitoso se limpia el estado pendiente. Deshabilitar doble envío y conservar las validaciones existentes. Probar también navegación atrás cuando corresponda.
- Mantener campos numéricos **editables sin cero persistente**: no forzar `0` mientras el usuario borra o escribe un decimal. Reutilizar `src/shared/components/ui/NumericInput.tsx` y el parser compartido para pesos argentinos y cantidades (`0.064`, `0,064`, `26.000,50`); diferenciar importes, decimales e enteros con validación apropiada. No confundir representación visual con valor guardado.
- Preferir textos de error y ayuda específicos junto al campo. Mantener estilos iguales para hover, focus, disabled, validación y errores.

## Navegación, estados y accesibilidad

- Agrupar configuraciones o funcionalidades extensas en **pestañas con nombres descriptivos**. Mantener filtros, búsquedas y selecciones al cambiar de pestaña si el usuario no los restableció.
- **Skeleton loaders con la forma y dimensiones reales** del contenido (cards, métricas, tablas, formularios) para evitar saltos. No reemplazarlos arbitrariamente por spinners genéricos.
- Diseño adaptado de verdad a escritorio, tablet y móvil; sin clipping, desbordamientos involuntarios ni controles inaccesibles. Considerar teclado, foco visible, etiquetas y contraste.
- Mostrar sólo indicadores, totales, rankings y detalles relevantes; **priorizar claridad por encima de ruido visual**. No agregar una card, icono, subtítulo o sección que no ayude a tomar una decisión.

## Verificación mínima antes de entregar

- Comparar visualmente con el diseño existente y comprobar que no se cambiaron fuentes, colores ni componentes ajenos al pedido.
- Revisar escritorio y móvil, estados de carga/vacío/error, hover/foco, dropdowns y calendarios abiertos, menús sin recortes, filtros combinados, orden asc/desc, paginación y persistencia al navegar.
- Para formularios, probar **editar → intentar salir → seguir editando / salir sin guardar → guardar**, incluido el regreso a pestañas. Probar campos vacíos, coma/punto decimal y validaciones.
- Ejecutar las verificaciones disponibles del proyecto (`npm run typecheck`, `npm run lint`, `npm run build` cuando correspondan) y **no declarar pruebas que no se realizaron**.
- Mantener los cambios acotados, validar antes de integrar a `main` y declarar si algo todavía requiere prueba manual.
