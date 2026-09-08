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
  editable desde Configuración cuando ese módulo exista (hoy no existe).
- Las notas NO las escribe una IA: plantillas para el ~85% y el analista pone la causa.
  Con una nota pendiente, el PDF queda bloqueado.

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
- **Módulo de presupuestos.** El editor de mapeo de cuentas ya existe (Estados Financieros
  › Ejecución › «Editar mapeo de cuentas»). Falta poder **cargar el presupuesto de un año
  nuevo** sin el script de Python y la consola: hará falta con el de 2027.
- **Tasas del portafolio por período.** Los CDT tienen tasa fija y un solo campo es
  correcto. Las fiducias y Bold rinden distinto cada mes, así que un campo único nunca
  puede estar bien: un informe de julio consultado en octubre mostraría tasas de octubre.
  Diseño acordado: tabla `inversion_tasa (inversión, año, mes, tasa)`, se llena en el
  cierre junto a las notas, y si falta la del mes el informe imprime raya y bloquea el PDF.
- **`npm run lint` no pasa**: 24 errores y 17 avisos preexistentes, concentrados en
  `src/lib/data.ts` (13) y `src/app/ingesta/actions.ts` (7), casi todos `no-explicit-any`.
  No los introdujo el trabajo del Panel ni el del Informe, pero incumplen el checklist
  de §3 — limpiarlos en un PR aparte, sin mezclarlos con trabajo de producto.

---

## 7. Notas del entorno

- Árbol de desarrollo: `D:\dev\fmc-financiero` (fuera de Drive).
- El screenshot del navegador puede colgarse en este entorno: verificar por texto
  (`get_page_text`) y por estilos computados (`javascript_tool`).
- `gh` CLI para los PRs. Tras mover el árbol de disco se corre `gh auth setup-git`.
