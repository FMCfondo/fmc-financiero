# Brief de diseño — FMC Financiero

Documento autocontenido para un rediseño visual por parte de un diseñador (o de
Claude Design). Contiene: qué es la app, quién la usa, arquitectura de pantallas,
sistema visual actual, restricciones inviolables y qué se espera del rediseño.

> **Sin cifras reales**: este repositorio es público. Los ejemplos numéricos de
> este documento son ilustrativos.

---

## 1. Qué es el producto

**FMC Financiero** es una aplicación web interna que reemplaza el proceso en Excel
de consolidación contable y estados financieros de **FMC S.A.S.**, un **fondo mutuo
de cobertura** colombiano (sociedad privada, SAS).

El fondo respalda garantías de crédito. Su modelo tiene **dos motores de utilidad**
que comparten una misma estructura administrativa:
1. **Cobertura de créditos** — ingresos por comisiones menos el costo de las reservas.
2. **Inversiones** — rendimiento del portafolio (CDTs y fiducias).

Los gastos de administración son un **costo conjunto**: nunca se reparten entre los
dos motores.

**El indicador de la misión** es la **razón de cobertura**: el respaldo líquido
(efectivo + inversiones) sobre las obligaciones de garantía. Debe mantenerse por
encima del 100%.

---

## 2. Usuarios y contextos de uso

| Usuario | Qué hace | Contexto |
|---|---|---|
| **Analista financiero** (1 persona, dueño del producto) | Carga el balance mensual, revisa cuentas nuevas y movimientos raros, analiza, prepara la reunión | Escritorio, sesiones largas, alta densidad de datos |
| **Gerencia** | Revisa desempeño y ejecución del presupuesto | Escritorio |
| **Junta Directiva** | Comprende la situación financiera en pocos minutos y toma decisiones | Reunión, pantalla compartida o proyector, **sin formación financiera profunda** |

**Principio rector del producto (regla del cliente):**
> *"Si una persona de Junta necesita que le expliquen el gráfico, el gráfico fracasó."*
> Claridad **por encima** de sofisticación. Un gráfico simple que se entiende en cinco
> segundos gana siempre a una visualización elegante que requiere explicación.

---

## 3. Arquitectura de pantallas

Barra lateral fija (rail de 64 px que se expande al pasar el cursor) + cabecera
superior fija con la entidad y el selector de período.

```
Panel Ejecutivo        /panel          ← portada; "/" redirige aquí
Estados Financieros      /estados/…
  ├─ Estados Financieros  ER · ESF · Flujo · Cambios en el Patrimonio
  │    └─ (por estado)    Estado | Análisis Vertical | Análisis Horizontal |
  │                       Comparación interanual | Presupuesto | Ejecución Acum. | Ejecución Mes
  └─ Análisis             Resumen | Situación Financiera | Resultados | Indicadores | Tendencias
Portafolio               /portafolio       (+ sub-vista Mantenimiento)
Balances / Resumen       /balances         herramienta operativa: matriz cuentas × meses
Cargar Balance           /ingesta          ingesta mensual del balance de prueba
Provisión de Impuesto    /impuesto         parámetros del cálculo de renta
```

Hay **tres niveles de navegación**: barra lateral → pestañas de módulo → pestañas de vista.

### 3.1 Panel Ejecutivo — la pantalla más importante
No es un dashboard: es **la reunión de Junta, en orden**. Un solo scroll narrativo,
sin pestañas, con nueve secciones numeradas. Este mismo orden será el del informe
PDF que se generará después.

```
0 · Barra de contexto   Período · Mes/Acumulado · Comparar contra (Presupuesto | Mes anterior | Año anterior)
1 · Resumen ejecutivo   ¿Qué ocurrió? — dos párrafos redactados por reglas sobre los datos
2 · Signos vitales      ¿Cómo estamos? — 8 tarjetas KPI + tarjeta de ejecución presupuestal
3 · Qué cambió y por qué  Variaciones materiales con barra e importe
4 · Presupuesto vs. real  Termómetro de los totales estructurales
5 · Evolución           4 gráficos de línea (12 meses)
6 · Indicadores         6 tarjetas con valor + palabra ("Adecuado") + meta + tendencia
7 · Portafolio          Mini-panel (4 cifras + composición) con enlace al detalle
8 · Hallazgos del período  Barras de comportamiento + viñetas de observaciones
9 · Ir al detalle       5 accesos a los estados completos
```

### 3.2 Estados Financieros — las cifras y la estructura
Tablas jerárquicas de cuentas contables (árbol de hasta 4 niveles) con los meses en
columnas. Cabecera fija, primera columna congelada, expandir/contraer con memoria.
El Estado de Resultados usa la estructura EBITDA que la Junta ya conoce.

### 3.3 Presupuesto y Ejecución
El presupuesto anual completo (75 rubros en 3 niveles jerárquicos) y su ejecución
comparativa: Presupuesto · Real · Variación $ · Variación % · Cumplimiento (barra).

---

## 4. Sistema visual actual

### 4.1 Tokens de color (Tailwind v4, `@theme` en `src/app/globals.css`)
```css
--color-base:      #f2f6fc   /* fondo, azul muy claro */
--color-panel:     #ffffff   /* barra lateral / cabecera */
--color-card:      #ffffff
--color-card2:     #eef3fb   /* superficie sutil / hover */
--color-line:      #e3e9f2
--color-line-soft: #eef2f8
--color-fg:        #17233b   /* texto principal (navy) */
--color-muted:     #5b6b86   /* texto secundario */
--color-faint:     #93a1b8   /* texto tenue */
--color-accent:    #1b6ca8   /* enlaces */
--color-royal:     #1e40af   /* azul rey — color de marca */
--color-royal2:    #13286e   /* azul rey oscuro (degradado de marca) */
--color-sky:       #45b6e8   /* azul cielo — en retirada */
--color-gold:      #c99a2e   /* dorado — en retirada */
--color-pos:       #16a34a   /* positivo */
--color-neg:       #dc2626   /* negativo */
--radius-xl:       16px
```

**Regla de color vigente (pedida por el cliente):** azul institucional como principal,
gris para lo secundario, **verde solo para lo positivo**, **rojo solo para lo
importante**, y **sin amarillos ni naranjas permanentes**. El color debe significar
algo; nunca es decorativo.

### 4.2 Tipografía
**Plus Jakarta Sans** (Google Fonts, vía `next/font`) para todo. Cifras siempre con
`font-variant-numeric: tabular-nums`.

### 4.3 El sistema de tablas financieras (clases `.stmt`)
Es el componente más importante de la app y ya está unificado:
- Cabecera fija al hacer scroll vertical; **columna de concepto congelada** al scroll
  horizontal, con divisor sutil (sensación de "inmovilizar paneles" de Excel, pero moderno).
- Jerarquía **por peso tipográfico y tinte**, no por barras de color.
- Convenciones de informe contable: negativos entre paréntesis, símbolo fuera del
  paréntesis, cero como raya (—), **regla simple sobre subtotal** y **doble regla bajo
  el total**, máximo 4 niveles de sangría.
- Guías de indentación, chevron con giro suave, código de cuenta en gris tenue.
- Expandir/contraer por grupo o todo, con el estado recordado por vista.

### 4.4 Gráficos
Recharts. Convenciones actuales: **etiquetas siempre visibles** (nunca obligar al
hover para entender), **sin tooltips**, **sin eje Y** (el valor va en la etiqueta),
leyenda visible cuando hay más de una serie, halo blanco tras el texto para que se
lea sobre cualquier fondo.

---

## 5. Restricciones inviolables

1. **No cambiar ningún cálculo.** Los motores financieros están validados. Un rediseño
   no puede alterar una cifra. (Lógica en `src/lib/*.ts` — intocable.)
2. **Se conservan las convenciones contables** descritas en 4.3: son requisito
   profesional, no preferencia estética.
3. **Etiquetas y valores visibles**; el hover solo revela el detalle exacto, nunca la
   lectura principal.
4. **Sin jerga interna en pantalla**: nada de códigos contables sueltos ni tecnicismos
   sin traducir.
5. **Idioma: español (Colombia).** Formato de cifra `1.234.567,89`; los montos grandes
   se muestran en millones (`COP 30,1 M`) con el valor exacto al pasar el cursor.
6. **Sin datos reales** en mockups: el repositorio es público.
7. Stack: **Next.js (App Router) + React + TypeScript + Tailwind v4 + Recharts**. El
   rediseño debe expresarse en tokens/clases de Tailwind y CSS, no en otra tecnología.

---

## 6. Qué se espera del rediseño

**Objetivo:** que la aplicación se sienta como **software financiero empresarial
premium** — sobrio, elegante, legible, con jerarquía visual impecable — y no como una
hoja de cálculo decorada ni como un tablero de BI recargado.

**Se agradece especialmente trabajo en:**
- **Sistema tipográfico**: escala, pesos y ritmo vertical. Hoy la tipografía es
  funcional pero poco distintiva.
- **Densidad y espaciado**: mucha información por pantalla sin sensación de apretado.
- **Jerarquía de las tres capas de navegación** (lateral → módulo → vista): hoy
  funciona pero compite visualmente.
- **Tarjetas KPI**: 8 tarjetas seguidas en el Panel; falta jerarquía entre la métrica
  ancla (razón de cobertura) y las demás.
- **Identidad**: la marca hoy es un degradado azul rey y poco más. Falta un carácter
  propio que no dependa solo del color.
- **Tema oscuro**: no existe. Sería valioso, sobre todo para las reuniones proyectadas.
- **Estados vacíos, cargas y transiciones**: hoy son mínimos.

**Lo que NO se busca:** más colores, gráficos decorativos, sombras pronunciadas,
animación gratuita, ni tendencias que envejezcan mal. Menos elementos, con más
significado.

---

## 7. Entregables útiles

1. Paleta y **tokens** listos para pegar en `@theme` (claro y, si es posible, oscuro).
2. **Escala tipográfica** y guía de pesos por rol (título, sección, dato, etiqueta).
3. **Especificación del sistema de tablas** (`.stmt`): alturas de fila, tamaños,
   tratamiento de subtotales/totales, cabecera fija, columna congelada.
4. **Tarjetas**: KPI, indicador interpretado, panel de contenido.
5. **Navegación**: los tres niveles y sus estados.
6. **Gráficos**: paleta de series, tratamiento de ejes/etiquetas, mini-tendencias.
7. Mockup de dos pantallas clave: **Panel Ejecutivo** y **Estado de Resultados**.

---

## 8. Contexto adicional

- El repositorio incluye `Review.md` con los principios de diseño acordados y el
  historial de decisiones; conviene leerlo.
- La app es de uso interno (pocos usuarios), en escritorio principalmente; el móvil no
  es prioritario pero no debe romperse.
- Accesibilidad: contraste legible en proyector es un requisito real (las cifras se
  presentan en reuniones).
