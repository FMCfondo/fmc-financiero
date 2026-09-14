# Review.md — Guía de revisión de FMC Financiero

Cómo se revisa el trabajo en este proyecto, antes de abrir un PR y antes de aprobarlo.
Complementa a `CLAUDE.md`. **Este archivo vive**: al cerrar cada sesión, actualizar el
backlog (§6) con lo que quedó pendiente.

> El repositorio es **público**. Aquí no se escribe **ninguna cifra financiera real**
> (saldos, resultados, EBITDA, etc.). Los valores de control para las no-regresiones se
> verifican con la app corriendo; no se versionan.

---

## 0. Regla de oro

Los cálculos, las fórmulas y la lógica contable **ya están validados**. Ninguna tarea de
UX, diseño o refactor puede cambiar un resultado financiero. **Si un cambio de presentación
mueve una cifra, es un bug** — a menos que la tarea sea explícitamente contable.

---

## 1. Invariantes que nunca se rompen (no-regresión)

- **Motores intactos.** `src/lib/{statements,indicadores,inversiones,ejecucion,data}.ts`.
  En un PR de UX/diseño, su `git diff` debe ser **aditivo** (nuevos `export`) con la lógica
  de cálculo idéntica. Si cambia una fórmula, se justifica aparte.
- **`provisionRenta()` es la fuente ÚNICA** del impuesto de renta. Nadie recalcula el impuesto por su cuenta.
- **RN0** (normalización de signo) y **RN1** (des-acumulación por clase) intactas.
- **Dos motores** (cobertura / inversiones): los gastos de administración son **costo conjunto**; NUNCA se reparten entre los motores.
- **Lenguaje contable**: "utilidad", nunca "excedente" (es una SAS).
- **Cifras de control** (ER acumulado, EBITDA, impuesto, utilidad neta, Total Activo): deben
  quedar **idénticas** antes/después de un cambio de presentación. Verificar con la app
  corriendo (los valores no se versionan por ser repo público).
- **Datos reales NUNCA al repo.** `.gitignore` cubre `seed.json`, `db/*.csv`, `.env.local`, `graphify-out/`.

---

## 2. Principios de diseño

### 2.1 Panel — herramienta de comunicación para la Junta (no un dashboard de analista)
- **"Si un miembro de Junta necesita que le expliquen el gráfico, el gráfico fracasó."**
  Claridad **sobre** sofisticación. Un gráfico simple que se entiende en 5 segundos gana
  siempre a uno complejo que se ve "elegante".
- **Etiquetas y valores SIEMPRE visibles.** Nunca obligar al hover para *entender* (el hover
  solo revela el detalle exacto, no la lectura principal).
- **Los indicadores interpretan**, no solo muestran: valor + una palabra ("Adecuado"),
  meta/umbral y tendencia. Las **notas obligatorias del catálogo** (advertencias) se
  renderizan visibles, nunca escondidas en un tooltip.
- **Cifras en millones** (formato `COP N,N M`) con el valor exacto disponible al pasar el cursor.
- **Sin jerga interna** en la cara visible: nada de códigos PUC ("(2640)"), ni palabras como
  "tramo" sin traducir a lenguaje llano.
- **Narrativa por reglas** con umbral explícito. Si no hay datos para una frase, la frase no
  aparece. **Nunca conclusiones inventadas.**
- La audiencia es una Junta **sin** formación financiera profunda. Definir los tecnicismos
  inevitables (p. ej. EBITDA) una sola vez, en lenguaje llano.

### 2.2 Paleta sobria (semántica, no decorativa)
- **Azul institucional** = principal. **Gris** = secundario. **Verde** = solo lo positivo.
  **Rojo** = solo lo importante/crítico. **Sin amarillos ni naranjas permanentes.**

### 2.3 Un lugar para cada cosa
- **Panel** = comunicación ejecutiva (la reunión de Junta, en orden; misma estructura que
  tendrá el PDF). **Estados Financieros** = las cifras y la estructura, para el detalle.
  **Análisis** (ex-Dashboard) = la caja de herramientas profunda del analista. Sin duplicar
  el mismo contenido en dos módulos.

### 2.4 Sistema visual de los estados (`.stmt`)
- Cabecera fija (sticky), columna de concepto congelada con divisor, jerarquía por **peso y
  tinte** (no por barras de color), reglas contables (simple sobre subtotal, doble bajo el
  total), densidad alta pero legible. Sensación de "inmovilizar paneles de Excel", con
  apariencia moderna.

---

## 3. Checklist antes de pedir aprobación de un PR

- [ ] `npm run build` compila limpio.
- [ ] `npx tsc --noEmit` → exit 0.
- [ ] Lint sin hallazgos.
- [ ] Motores sin cambios de lógica (revisar `git diff` de `src/lib`).
- [ ] Cifras del ER **idénticas** a antes del cambio (app corriendo).
- [ ] Rutas clave responden: `panel`, `estados/*`, `portafolio`, `balances` → 200; rutas eliminadas → 404.
- [ ] Sin errores de consola.
- [ ] Verificado en el navegador — o, si el screenshot se cuelga en el entorno, por `curl` +
      texto de la página + estilos computados (`javascript_tool`).
- [ ] Ningún dato real entró al repo.

---

## 4. Revisión adversarial (estándar para trabajo de diseño/producto grande)

Antes de dar por terminado un módulo:

1. **Revisar desde lentes independientes**: (a) miembro de Junta sin formación financiera,
   (b) CFO, (c) Diseñador UX Senior de software financiero, (d) coherencia narrativa y de cifras.
2. **Verificar cada hallazgo adversarialmente contra el código real** (no de memoria).
   Descartar los que sean gusto, decisión deliberada documentada, o que contradigan un
   principio de este archivo.
3. Aplicar **solo los confirmados**. **La palabra del usuario gana sobre el revisor.**
4. Preguntas de cierre: ¿se comprende la situación en menos de 5 minutos? ¿cada componente
   apoya una decisión de Junta? ¿hay ruido visual? ¿la jerarquía es clara? ¿falta representar
   algo importante? Si alguna respuesta es negativa, iterar.

---

## 5. Flujo de trabajo

- Rama → commit → build/verificar → PR. **El usuario aprueba y mergea.** Para el trabajo de
  diseño del Panel y los estados pidió explícitamente **no mergear sin su aprobación**.
- Confirmar que **todos** los commits llegaron a `origin` antes de mergear (una vez un push
  parcial dejó un commit fuera del PR).

---

## 6. Backlog de mejoras y hallazgos abiertos (vivo)

> Actualizar tras cada sesión.

### Panel
- **APROBADO (2026-09-05).** Tras tres direcciones rechazadas —panel genérico, enfoque
  editorial (*"me parece un periódico… muy zombie"*) y los activos como lista de cuentas
  (*"no es algo que uno entienda al instante con solo verlo"*)— la cuarta quedó aprobada:
  lenguaje de tarjetas + `BalanceVisual` + `BarrasCobertura`. **El Panel se queda.**
  Falta solo el visto bueno explícito del usuario para mergear el PR#26.
- **Dos visiones para la Junta, no una que reemplaza a la otra**: el **Panel** es la
  pantalla de la reunión; el **Informe de Junta** es el documento de 7 páginas que se
  envía antes y termina en PDF. Regla que los mantiene honestos: **una sola fuente de
  cifras, dos presentaciones**. Si un número difiere entre los dos, es un bug — nunca
  "dos versiones". El Panel ya no alimenta el PDF: su contrato se renombró a
  `construirPanel()` / `type Panel` para no chocar con el `Informe` del informe.
- Lección de esas tres iteraciones: **cada bloque debe abrir con una imagen que se
  explique sola**. Una cifra bien maquetada no sustituye a un gráfico; dos barras a la
  misma escala comunican más que un porcentaje bien calculado.
- Las reglas de *"aspectos que requieren atención"* quedaron **descartadas**: el usuario
  las reemplazó por las **notas del período** (detección de anomalías + explicación
  escrita por el analista). No reintroducir alertas automáticas.
- **KPIs propios del negocio que faltan**: *Cartera Garantizada* y *Valor de las Coberturas
  Vigentes* — **no existen en la contabilidad**; definir cómo capturarlos (dato mensual
  manual o segunda ingesta) antes de mostrarlos.

### Informe de Junta (módulo nuevo, rama `feat/informe-junta`)
- **LAS 7 PÁGINAS ESTÁN EN PANTALLA Y CONCILIADAS** contra el informe certificado de
  julio 2026, **con sus notas y su PDF**. Falta: las tasas del portafolio por período
  (hoy no bloquean la exportación porque el dato no existe todavía).
- **El PDF sale del diálogo del navegador**, sobre la misma marcación de la pantalla.
  No hay generador aparte a propósito: así el papel y la pantalla no pueden divergir.
  El diálogo trae dos ajustes que estropean la hoja —márgenes y encabezados—, y la
  barra los enuncia. El nombre del archivo sale del `<title>` (`generateMetadata`).
- **EL INFORME TIENE NUEVE PÁGINAS, NO SIETE** (2026-09-08, decisión del usuario: *«no
  está muy bien optimizado… lo mejor será dividirlo y darle más aire»*). El estado de
  resultados se partió en **evolución del año** (la serie mes a mes) y **ejecución
  presupuestal** (las tres ejecuciones + las notas); el detalle de gastos, en dos mitades
  cortadas en un rubro de primer nivel —nunca separando un rubro de sus subcuentas—.
  Las dos vistas de resultados se alimentan de las MISMAS filas: no pueden discrepar.
- **La tabla estira hasta llenar la hoja** (`.page > table { flex: 1 1 auto }`): cada
  página reparte entre sus filas el espacio que le sobra, así que una con pocas filas
  respira y una llena queda compacta, sin afinar el relleno página por página. `.densa`
  quedó como **piso** de densidad, no como aspecto final. Si se vuelve a apretar, NO
  bajar la fuente ni el margen: partir la página, como se hizo aquí.
- **CADA `.page` RECORTA EN SILENCIO** lo que no cabe (alto fijo + `overflow: hidden`).
  Así se perdieron la fila de utilidad neta de la página 4 y la última fila de la 5,
  sin que nada lo dijera. Dos defensas: los rótulos de grupo ya no dictan el ancho de
  la tabla (era la causa), y la barra **mide las siete hojas al cargar y avisa** si
  alguna se corta. **Verificar SIEMPRE imprimiendo de verdad**, no mirando la pantalla:
  `chrome --headless=new --print-to-pdf`, y las páginas se leen con PyMuPDF (`fitz`),
  que está instalado. Medido en los dos extremos —agosto de 2026 (8 meses) y
  diciembre de 2025 (12)— sin desborde. La página 1 es la única sin margen: respira
  ~16 px, así que cualquier nota más larga la parte.
- Las notas se enganchan por **CLAVE, no por etiqueta** (`ClaveNota` en
  informe-cuentas.ts): la etiqueta es texto que se imprime y puede reescribirse. Si la
  clave falta, `construirInforme()` **lanza a propósito**.
- La **causa** la escribe una persona en Operación › Revisión del cierre y se guarda en
  `nota_periodo` contra una cuenta PUC; `CUENTAS_DE_LA_CAUSA` (informe.ts) dice qué
  cuentas alimentan cada partida. Ojo: el costo de cobertura y dep/amort cuelgan del
  grupo 51 pero **no** son gasto de administración — están excluidos.
- **Hueco conocido**: solo tres partidas (Clientes, Impuestos por pagar, Gastos de
  administración) pueden marcarse como pendientes. Una anomalía grande en una cuenta
  que ninguna nota nombra —en agosto de 2026, los Certificados (1225)— no bloquea la
  exportación. Si eso importa, hay que ampliar el mapa o cambiar la regla.
- **El arnés `/api/conciliacion` hace 300 comparaciones**, todas en verde. Es la red de
  seguridad del módulo: **antes de tocar cualquier composición de línea, correrlo**.
  Requiere el archivo de cifras de control, que NO se versiona (cifras reales) — sin él la
  ruta responde 404 e inerte.
- La página 1 mezcla las bases de comparación **a propósito**: ingresos y gastos contra la
  meta acumulada a la fecha, EBITDA y utilidad contra la anual. No "corregirlo".
- La página 5 sale del **árbol del presupuesto**, no de una lista en el código: renombrar
  una línea del informe se hace editando el presupuesto.
- Las composiciones de línea del informe (qué cuentas forman «Clientes», «Pasivos
  estimados», «Ingresos de operación») **no coinciden con los grupos del PUC** y se
  dedujeron conciliando. Confirmadas por el usuario. Antes de tocarlas, correr la
  conciliación.
- **Pendiente**: guardar la composición de «Clientes» en la tabla `parametro` para que sea
  editable desde Configuración (el módulo ya existe; falta el editor de esta composición).
- Las notas NO las escribe una IA: plantillas para el ~85% y el analista pone la causa.
  Con una nota pendiente el PDF **ya no se bloquea** (2026-09-08): la barra avisa, y la
  marca roja de «falta la explicación» se pinta **solo en modo Operación** — dentro del
  documento de la Junta un rótulo rojo se lee como un defecto del informe.
- **«SUBTOTAL EBITDA» no se imprime pero SIGUE en el contrato** (`oculta: true`). Se
  ocultó porque confundía junto al EBITDA, y NO se borró porque el arnés la compara
  contra el Excel certificado: al borrarla no fallaría, la saltaría en silencio y las
  300 comparaciones pasarían a 292 sin que nadie se entere. Ocultar es presentación;
  borrar sería renunciar a verificar una cifra.
- **El estiramiento de las tablas tiene tope por fila**: `max-height: calc(var(--filas)
  * 21pt + 60pt)`. Sin él, el reparto es proporcional al alto natural y una hoja con
  pocas filas las infla —el detalle de gastos llegaba a 79 px por fila frente a 25 en
  el resto, y un mes sin presupuesto estiraba una fila única a 557 px. Cada página
  publica su número de filas en `--filas`; si se añade una tabla nueva, hay que
  publicarlo o no se acota.

### Acceso e identidad (módulo nuevo, 2026-09-14)
- **Identidad propia, sin servicios externos ni secretos nuevos.** Tablas `usuario` y
  `sesion` (`scripts/migrate-usuarios.mjs`). Contraseñas con `scrypt` del propio Node y sal
  por usuario; la sesión es un token opaco en cookie `httpOnly` cuyo **SHA-256** vive en la
  base y se valida en cada petición (`obtenerSesion()`, deduplicada con `cache`). Por eso
  **desactivar a alguien lo saca al instante**: no hay tokens firmados que sigan valiendo.
- **El proxy (`src/proxy.ts`) guarda la puerta, no la verdad**: solo comprueba que la cookie
  exista y manda a `/entrar` (401 en `/api`). No toca la base a propósito. La verdad la dice
  `obtenerSesion()` en el layout y en cada acción que escribe. Deja la ruta en la cabecera
  `x-fmc-ruta`, única forma de que el layout raíz sepa dónde está.
- **Sin sesión, el layout raíz pinta solo `children`** (la pantalla de entrada), sin barra
  ni cabecera ni carga del dataset.
- **Roles: `admin` y `junta`.** El primer administrador se crea desde `/entrar` cuando la
  tabla está vacía (una sola vez). Las cuentas que crea el admin nacen con
  `debe_cambiar_clave`: el primer ingreso aterriza en `/cuenta?obligatorio=1` y el layout
  no deja ir a otro sitio hasta cambiarla.
- **Cinco fallos seguidos bloquean quince minutos.** Correo o clave malos devuelven el mismo
  mensaje, y un correo inexistente cuesta lo mismo que uno real (se hashea un relleno).
- **Auditoría en la tabla que ya existía**: login, login_fallido, logout, clave_cambiada,
  primer_admin; luego los cambios de usuarios y parámetros.
- Los formularios de entrar/salir/cambiar clave son `<form action={acción}>`: funcionan sin
  JavaScript y por eso se probaron de punta a punta en el panel.
- **Roles aplicados en servidor (PR 2, 2026-09-14).** `src/lib/permisos.ts`: `modulosDe(u)`
  (qué ve), `rutaPermitida(u, ruta)` (el layout raíz la aplica en cada petición y manda a
  `destinoInicial`), `soloAdmin()` para páginas o partes de página, y
  `exigirAdminAccion()` para acciones: **devuelve** `{ok:false,error}` en vez de lanzar,
  porque un `throw` en una acción llega al navegador sin mensaje. **Toda acción nueva que
  escriba debe empezar por `const denegado = await exigirAdminAccion(); if (denegado)
  return denegado;`.** Lo que la Junta ve es el parámetro JSON `junta_modulos` (lista de
  rutas; por defecto los cuatro módulos de Reuniones; nunca Operación). La barra lateral
  recibe `rol` y `modulos` del layout; la Junta no tiene conmutador y su modo se fija en
  Reuniones. Dentro de páginas visibles, las partes que escriben (Mantenimiento del
  portafolio, editor de mapeo, editor de notas del informe) se gatean por rol desde el
  servidor: `puedeEditar` viaja dentro de `EdicionNota`.
- **Orden en el layout raíz: `ensureLoaded()` ANTES de evaluar permisos.** El dataset es
  quien refresca los parámetros desde la base; evaluados antes, un cambio en
  `junta_modulos` tardaba una petición en aplicarse por instancia (se vio en la prueba:
  el primer aterrizaje tras el login aún mostraba los cuatro módulos).
- **PR 3 — Configuración, HECHO (2026-09-14).** `/configuracion` (solo administrador,
  `soloAdmin()`), cuatro pestañas por `?v=`: **Usuarios** (crear con clave generada,
  cambiar rol, activar/desactivar, restablecer clave, último acceso), **Lo que ve la
  Junta** (interruptores de `junta_modulos`), **Parámetros** (solo lectura: qué hay y
  dónde se edita; no duplica editores) y **Auditoría** (últimos 200 eventos, con nombre
  de persona en vez de identificador). Todo con formularios clásicos, probado sin
  hidratar. **La clave generada nunca viaja en la URL**: la acción la deja cinco minutos
  en una cookie httpOnly con `path=/configuracion` (`COOKIE_CLAVE`, en `auth-cookie.ts`
  porque un módulo "use server" solo exporta funciones) y el administrador la oculta
  cuando la copió. Uno no puede desactivarse ni quitarse el rol a sí mismo
  (`error=timismo`). No se borran usuarios: se desactivan, para conservar la auditoría.
  **Del lado del usuario**: crear el primer administrador en `/entrar`, apagar la
  Protección de Despliegue de Vercel (si no, la Junta choca con esa pantalla antes que
  con la nuestra) y rotar la clave de Neon.

### Estados Financieros
- Continuar el refinamiento de densidad tipográfica y comportamiento del scroll (sticky
  horizontal/vertical) — base hecha, queda pulido fino.

### Producto / infraestructura
- **URGENTE — rotar la clave de Neon.** Quedó expuesta en un chat desde julio y el repo
  es público. No depende de ninguna otra decisión; hacerlo antes que cualquier función
  nueva, y actualizar `.env.local` y Vercel.
- **Informe PDF** para la Junta, generado desde el mismo objeto `Informe` del Panel
  (el contrato único ya está listo para reutilizarse). Depende del veredicto de diseño.
- Propagar el lenguaje visual nuevo del Panel al resto de estados y a Análisis.
- Mover **Provisión de Impuesto** a un módulo de **Configuración/Ajustes**.
- **Cloudflare Access** + dominio propio para que la Junta entre sin cuenta de Vercel.
- **Conciliación de la cuenta 2640** (pausada).
- **Módulo de presupuestos — HECHO (2026-09-14).** `/presupuesto` (Operación): estado de
  cada año cargado y carga de uno nuevo desde la hoja «PPTO <año>» del libro de la Junta,
  en dos pasos (revisar → confirmar), como la ingesta. La idea que lo hizo posible sin el
  extractor Python: **del Excel salen solo etiqueta, nivel de agrupación (el outline de
  Excel, `!rows[].level` en SheetJS con `cellStyles`), doce meses y total; la estructura
  —total/detalle, clase, fórmula— y el MAPEO DE CUENTAS se heredan del año base por
  (nivel, etiqueta)**, con segunda pasada sin años ni paréntesis. Año base = el mismo si
  ya existe (recargar conserva el mapeo), si no el anterior. Lo que no casa entra como
  detalle nuevo sin cuentas y se reporta. Antes de escribir se verifica que
  `ing_operacion`, `gastos_admin`, `util_neta` queden una vez y que exista «EBITDA»
  exacto: si un rótulo estructural cambió, la carga se detiene. El corte es «hasta
  UTILIDAD NETA»: los «Margen …» de abajo son porcentajes y se ignoran. Escritura en UNA
  transacción (delete + inserts). Lógica pura en `src/lib/presupuesto-carga.ts`,
  probada contra la hoja real: reproduce las 75 filas de 2026 con estructura y totales
  idénticos. `scripts/migrate-ppto.mjs` queda solo para el PRIMER año de una base vacía.
- **Tasas del portafolio por período — HECHO (2026-09-14).** Tabla `inversion_tasa
  (inversion_id, anio, mes, tasa_ea)`, creada por `scripts/migrate-inversion-tasa.mjs`.
  La regla: **a la vista = sin vencimiento** (la misma con la que el motor mide
  liquidez) ⇒ la tasa que rige es la del MES, capturada en Portafolio › Mantenimiento ›
  «Tasas del mes» para el período seleccionado; los CDT pactan tasa fija y siguen en
  `inversion.tasa_ea`. `D.tasaDe(inv, anio, mes)` es la única puerta. Si falta la del
  mes: la posición imprime **raya**, la ponderada es **null** (no se promedia lo que
  hay: parecería completa) y la barra del informe avisa. No bloquea el PDF, como el
  resto de avisos. Solo agosto de 2026 quedó sembrado —con las tasas que el usuario
  corrigió ese cierre—; **los meses anteriores no tienen tasa y lo dicen**. Si hace
  falta un informe viejo con tasas, se capturan para ese mes desde el mismo panel.
- **`npm run lint` no pasa**: 24 errores y 17 avisos preexistentes, concentrados en
  `src/lib/data.ts` (13) y `src/app/ingesta/actions.ts` (7), casi todos `no-explicit-any`.
  No los introdujo el trabajo del Panel ni el del Informe, pero incumplen el checklist
  de §3 — limpiarlos en un PR aparte, sin mezclarlos con trabajo de producto.

---

## 7. Notas del entorno

- Árbol de desarrollo: `D:\dev\fmc-financiero` (fuera de Drive).
- Una ruta NUEVA puede devolver 404 en `next dev` con el código correcto (pasó con
  `/entrar`): es un estado viciado de Turbopack. Tocar el archivo la recompila y responde;
  no depurar la lógica. Si `npm run build` falla con «Type expected» en
  `.next/dev/types/routes.d.ts`, es el mismo síntoma: correr el build con el dev parado.
- Los formularios con `action={acciónDeServidor}` se envían SIN hidratación, así que el
  login, salir y cambiar clave sí se prueban de punta a punta en el panel integrado.
- El screenshot del navegador puede colgarse en este entorno: verificar por texto
  (`get_page_text`) y por estilos computados (`javascript_tool`).
- `gh` CLI para los PRs. Tras mover el árbol de disco se corre `gh auth setup-git`.
