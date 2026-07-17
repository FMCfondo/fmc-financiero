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

### 2.1 Cockpit — herramienta de comunicación para la Junta (no un dashboard de analista)
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
- **Cockpit** = comunicación ejecutiva (la reunión de Junta, en orden; misma estructura que
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
- [ ] Rutas clave responden: `cockpit`, `estados/*`, `portafolio`, `balances` → 200; rutas eliminadas → 404.
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
  diseño del Cockpit y los estados pidió explícitamente **no mergear sin su aprobación**.
- Confirmar que **todos** los commits llegaron a `origin` antes de mergear (una vez un push
  parcial dejó un commit fuera del PR).

---

## 6. Backlog de mejoras y hallazgos abiertos (vivo)

> Actualizar tras cada sesión.

### Cockpit
- Calibrar con el usuario las reglas de **"Hallazgos / aspectos que requieren atención"**
  (umbrales de materialidad, qué entra y qué no).
- **KPIs propios del negocio que faltan**: *Cartera Garantizada* y *Valor de las Coberturas
  Vigentes* — **no existen en la contabilidad**; definir cómo capturarlos (dato mensual
  manual o segunda ingesta) antes de mostrarlos.
- Seguir puliendo claridad/legibilidad según feedback ("aún hay mejoras por hacer").

### Estados Financieros
- Continuar el refinamiento de densidad tipográfica y comportamiento del scroll (sticky
  horizontal/vertical) — base hecha, queda pulido fino.

### Producto / infraestructura
- **Informe PDF** para la Junta, generado desde el mismo objeto `Informe` del Cockpit
  (el contrato único ya está listo para reutilizarse).
- Mover **Provisión de Impuesto** a un módulo de **Configuración/Ajustes**.
- **Rotar la clave de Neon**.
- **Cloudflare Access** + dominio propio para que la Junta entre sin cuenta de Vercel.
- **Conciliación de la cuenta 2640** (pausada).

---

## 7. Notas del entorno

- Árbol de desarrollo: `D:\dev\fmc-financiero` (fuera de Drive).
- El screenshot del navegador puede colgarse en este entorno: verificar por texto
  (`get_page_text`) y por estilos computados (`javascript_tool`).
- `gh` CLI para los PRs. Tras mover el árbol de disco se corre `gh auth setup-git`.
