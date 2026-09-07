/* Composiciones de línea: EL ÚNICO SITIO donde se define de qué cuentas PUC está
 * hecha cada línea de los estados que publica la app.
 *
 * Por qué existe: las líneas del informe de Junta NO coinciden con los grupos del
 * PUC. Esa correspondencia vivía solo dentro de las fórmulas del Excel; se dedujo
 * conciliando contra el Excel certificado y el usuario la confirmó el 2026-09-05.
 * Antes de este archivo estaba duplicada entre la ruta de conciliación y el
 * Panel, que es como la misma línea acababa valiendo dos cosas distintas.
 *
 * NO CALCULA NADA NUEVO: suma y resta cifras que los motores ya validaron. Los
 * motores (statements, ejecucion, inversiones, data) no se tocan.
 *
 * Verificado al peso contra el Excel certificado por /api/conciliacion.
 */
import "server-only";
import * as D from "./data";
import { realFormula } from "./ejecucion";
import { esf, provisionRenta, impuestoMes, DEP_AMORT, COSTO_COBERTURA } from "./statements";

export type Modo = "acum" | "mes";

/** Valor de una cuenta en el modo pedido: acumulado del año o solo el mes. */
const v = (etq: string, cod: string, modo: Modo) =>
  modo === "acum" ? D.ytd(etq, cod) : D.fact(etq, cod);

/* ---------------------------------------------------------------- cuentas --- */

/** Bolsillo digital Bold. Está contabilizado en efectivo (11) pero el informe lo
 *  presenta dentro de las inversiones y rotulado como FIDUCIA. Lleva fila propia
 *  en el detalle: lo que se pliega es el TIPO, no la posición. */
export const CTA_BOLD = "1110050104";

/** Intereses de cuentas de ahorro (4210) y diversos (4295). NO son ingreso de
 *  operación, pero SÍ entran al EBITDA: bajan como «otros ingresos» antes de él.
 *  Confirmado por el usuario el 2026-09-05. */
export const FUERA_DE_OPERACION = ["4210", "4295"];

/* ------------------------------------------------------- estado de resultados --- */

/** Ingresos de operación tal como los define el informe: la clase 4 sin el costo
 *  de cobertura y sin los ingresos no operacionales. */
export const ingOperacion = (etq: string, modo: Modo) =>
  realFormula("ing_operacion", etq, modo) - otrosIngresos(etq, modo);

/** Otros ingresos: lo que sale de la línea de operación pero vuelve antes del EBITDA. */
export const otrosIngresos = (etq: string, modo: Modo) =>
  FUERA_DE_OPERACION.reduce((s, c) => s + v(etq, c, modo), 0);

/** Gastos de administración: el grupo 51 sin el costo de cobertura ni dep/amort. */
export const gastosAdmin = (etq: string, modo: Modo) =>
  realFormula("gastos_admin", etq, modo);

/** Gastos operativos = clase 5 sin costo de cobertura ni dep/amort. Es el simétrico
 *  de `ingOperacion + otrosIngresos` y cierra la cadena contra el EBITDA del motor. */
export const gastosOperativos = (etq: string, modo: Modo) =>
  v(etq, "5", modo) - v(etq, COSTO_COBERTURA, modo)
  - DEP_AMORT.reduce((s, c) => s + v(etq, c, modo), 0);

/** Otros gastos: la clase 5 fuera del grupo 51, más lo que quede en 5199 aparte
 *  del costo de cobertura. Simétrico de `otrosIngresos`. */
export const otrosGastos = (etq: string, modo: Modo) =>
  v(etq, "5", modo) - v(etq, "51", modo)
  + v(etq, "5199", modo) - v(etq, COSTO_COBERTURA, modo);

/* --------------------------------------------------------------- balance --- */

/** Efectivo, sin Bold (que el informe presenta entre las inversiones). */
export const disponible = (etq: string) => D.fact(etq, "11") - D.fact(etq, CTA_BOLD);

/** Inversiones líquidas, con Bold incluido. */
export const inversionesLiquidas = (etq: string) => D.fact(etq, "12") + D.fact(etq, CTA_BOLD);

/** Clientes = ingresos por cobrar + cuentas por cobrar en contratos.
 *  OJO 138005, no 1380: el informe separa 138095 en «Otras cuentas por cobrar»,
 *  y esa cuenta tuvo saldo en may-2026. Usar 1380 las mezcla.
 *  PENDIENTE: el usuario pidió que esta composición sea editable desde el módulo
 *  de Configuración. Hoy `parametro` solo guarda números, así que vive aquí. */
export const clientes = (etq: string) => D.fact(etq, "1345") + D.fact(etq, "138005");

/** Otras cuentas por cobrar. Incluye 1395, que el Excel deja fuera de las tres
 *  filas impresas y por eso su columna no cierra por 14 centavos. */
export const otrasCuentasPorCobrar = (etq: string) =>
  D.fact(etq, "1365") + D.fact(etq, "138095") + D.fact(etq, "1395");

/** Pasivos estimados = grupo 26, sin lo que el informe reclasifica a otras líneas
 *  (2610 a laborales, 2615 a impuestos), más la provisión de renta, que también
 *  es un pasivo estimado. */
export const pasivosEstimados = (etq: string) =>
  D.fact(etq, "26") - D.fact(etq, "2610") - D.fact(etq, "2615")
  + provisionRenta(etq).provision;

/** Impuestos por pagar: el grupo 24 más las obligaciones fiscales estimadas (2615)
 *  y la retención que el informe saca de acreedores (2365). */
export const impuestosPorPagar = (etq: string) =>
  D.fact(etq, "24") + D.fact(etq, "2615") + D.fact(etq, "2365");

/** Obligaciones laborales: beneficios a empleados más la estimación del grupo 26. */
export const obligacionesLaborales = (etq: string) =>
  D.fact(etq, "25") + D.fact(etq, "2610");

/** Otras cuentas por pagar operativas: acreedores sin la retención reclasificada. */
export const otrasCuentasPorPagar = (etq: string) =>
  D.fact(etq, "23") - D.fact(etq, "2365");

/* -------------------------------------------- líneas del balance del informe ---
 * El orden y las etiquetas son los del informe certificado; la expresión de cada
 * una se dedujo conciliando contra él en abril, mayo, junio y julio de 2026.
 * Estas son las páginas 2 y 3 del informe, y a la vez lo que verifica el arnés.
 */
export type LineaBalance = {
  etiqueta: string;
  nivel: "det" | "sub" | "tot";
  valor: (etq: string) => number;
};

const ppeBruto = (e: string) => D.fact(e, "1524") + D.fact(e, "1528");
const difBruto = (e: string) => D.fact(e, "1705");

export const LINEAS_ACTIVO: LineaBalance[] = [
  { etiqueta: "Disponible", nivel: "det", valor: disponible },
  { etiqueta: "Inversiones líquidas", nivel: "det", valor: inversionesLiquidas },
  { etiqueta: "Total disponible e inversiones", nivel: "sub",
    valor: (e) => disponible(e) + inversionesLiquidas(e) },
  { etiqueta: "Clientes", nivel: "det", valor: clientes },
  { etiqueta: "Anticipo de impuestos o saldos a favor", nivel: "det",
    valor: (e) => D.fact(e, "1355") },
  { etiqueta: "Otras cuentas por cobrar", nivel: "det", valor: otrasCuentasPorCobrar },
  { etiqueta: "Total Cuentas Por Cobrar", nivel: "sub",
    valor: (e) => clientes(e) + D.fact(e, "1355") + otrasCuentasPorCobrar(e) },
  { etiqueta: "ACTIVOS CORRIENTES", nivel: "tot",
    valor: (e) => disponible(e) + inversionesLiquidas(e) + clientes(e)
      + D.fact(e, "1355") + otrasCuentasPorCobrar(e) },
  { etiqueta: "Propiedades Planta y Equipo (PPE)", nivel: "det", valor: ppeBruto },
  // Negativa: el informe la imprime entre paréntesis. Es el residuo del neto.
  { etiqueta: "Depreciación acumulada", nivel: "det",
    valor: (e) => D.fact(e, "15") - ppeBruto(e) },
  { etiqueta: "Total PPE Neto", nivel: "sub", valor: (e) => D.fact(e, "15") },
  { etiqueta: "Activos Diferidos", nivel: "det", valor: difBruto },
  { etiqueta: "Amortización Acumulada", nivel: "det",
    valor: (e) => D.fact(e, "17") - difBruto(e) },
  { etiqueta: "Total Activos Diferidos", nivel: "sub", valor: (e) => D.fact(e, "17") },
  { etiqueta: "Total Activos No Corrientes Operativos", nivel: "sub",
    valor: (e) => D.fact(e, "15") + D.fact(e, "17") },
  { etiqueta: "TOTAL ACTIVOS", nivel: "tot", valor: (e) => esf(e).totalActivo },
];

export const LINEAS_PASIVO: LineaBalance[] = [
  { etiqueta: "Proveedores", nivel: "det", valor: (e) => D.fact(e, "22") },
  { etiqueta: "Impuestos por Pagar", nivel: "det", valor: impuestosPorPagar },
  { etiqueta: "Obligaciones Laborales", nivel: "det", valor: obligacionesLaborales },
  { etiqueta: "Pasivos Estimados y Provisiones", nivel: "det", valor: pasivosEstimados },
  { etiqueta: "Otras cuentas por pagar operativas", nivel: "det", valor: otrasCuentasPorPagar },
  { etiqueta: "Cuentas por pagar NO operativas", nivel: "det", valor: (e) => D.fact(e, "28") },
  { etiqueta: "TOTAL PASIVO CORRIENTE", nivel: "sub", valor: (e) => esf(e).totalPasivo },
  { etiqueta: "TOTAL PASIVO", nivel: "tot", valor: (e) => esf(e).totalPasivo },
  { etiqueta: "Capital social", nivel: "det", valor: (e) => D.fact(e, "31") },
  { etiqueta: "Reservas", nivel: "det", valor: (e) => D.fact(e, "33") },
  { etiqueta: "Superávit de capital", nivel: "det", valor: (e) => D.fact(e, "32") },
  // La utilidad del ejercicio ya neta de la provisión de renta.
  { etiqueta: "Total utilidades retenidas", nivel: "det", valor: (e) => esf(e).neto },
  { etiqueta: "TOTAL PATRIMONIO", nivel: "tot", valor: (e) => esf(e).totalPatrim },
  { etiqueta: "TOTAL PASIVOS Y PATRIMONIO", nivel: "tot", valor: (e) => esf(e).totalActivo },
];

/* ------------------------------------------ líneas del estado de resultados ---
 * Página 4 del informe. Orden y etiquetas del informe certificado; las cuentas se
 * dedujeron conciliando contra él en los siete meses impresos de 2026.
 *
 * OJO — la cuenta 4175 «Devolución en ventas» NO tiene fila propia en el informe,
 * pero SÍ está dentro de «Ingresos de operación». Es decir: las cinco filas de
 * ingreso no suman exactamente su subtotal. Se conserva el comportamiento del
 * original (el subtotal manda), y `residuoIngresos()` mide el hueco para que no
 * crezca en silencio. En may-2026 vale −338.399,16.
 */
export type LineaResultado = {
  etiqueta: string;
  signo: "(+)" | "(−)" | "(=)";
  nivel: "det" | "sub" | "tot";
  /** true en gastos y provisiones: superar la meta es malo. */
  esGasto?: boolean;
  /** Fila del presupuesto que le corresponde, por `orden` (único y estable). Sin
   *  ella la línea no lleva metas: se imprime "—", nunca un cero inventado. */
  pptoOrden?: number;
  valor: (etq: string, modo: Modo) => number;
};

const cta = (c: string) => (e: string, m: Modo) => v(e, c, m);

export const LINEAS_RESULTADO: LineaResultado[] = [
  { etiqueta: "Ingresos por inversiones", signo: "(+)", nivel: "det", pptoOrden: 1, valor: cta("4150") },
  { etiqueta: "Ingresos por comisiones", signo: "(+)", nivel: "det", pptoOrden: 2, valor: cta("4180") },
  { etiqueta: "Reintegro de provisiones", signo: "(+)", nivel: "det", valor: cta("425035") },
  { etiqueta: "Recuperación de garantías", signo: "(+)", nivel: "det", pptoOrden: 3, valor: cta("425055") },
  { etiqueta: "De ejercicios anteriores", signo: "(+)", nivel: "det", valor: cta("4265") },
  /* La reserva constituida más las devoluciones en ventas (4175). El informe no le da
   * fila propia a la 4175: la pliega aquí, y así las cinco filas de ingreso sí suman su
   * subtotal. Verificado en may-2026, el único mes con devoluciones. */
  { etiqueta: "Provisiones (reservas)", signo: "(−)", nivel: "det", pptoOrden: 4, esGasto: true,
    valor: (e, m) => v(e, COSTO_COBERTURA, m) - v(e, "4175", m) },
  { etiqueta: "INGRESOS DE OPERACIÓN", signo: "(=)", nivel: "sub", pptoOrden: 7, valor: ingOperacion },
  { etiqueta: "Gastos de Administración", signo: "(−)", nivel: "det", pptoOrden: 8, esGasto: true, valor: gastosAdmin },
  { etiqueta: "SUBTOTAL EBITDA", signo: "(=)", nivel: "sub", pptoOrden: 43,
    valor: (e, m) => ingOperacion(e, m) - gastosAdmin(e, m) },
  { etiqueta: "Otros ingresos", signo: "(+)", nivel: "det", pptoOrden: 44, valor: otrosIngresos },
  { etiqueta: "Otros egresos", signo: "(−)", nivel: "det", pptoOrden: 48, esGasto: true, valor: otrosGastos },
  { etiqueta: "EBITDA", signo: "(=)", nivel: "sub", pptoOrden: 59,
    // Ingresos menos gastos, sin depreciaciones ni amortizaciones. El costo de
    // cobertura SÍ es gasto: no se devuelve al resultado.
    valor: (e, m) => v(e, "4", m) - (v(e, "5", m) - DEP_AMORT.reduce((s, c) => s + v(e, c, m), 0)) },
  { etiqueta: "Depreciaciones", signo: "(−)", nivel: "det", pptoOrden: 60, esGasto: true, valor: cta(DEP_AMORT[0]) },
  { etiqueta: "Amortizaciones", signo: "(−)", nivel: "det", pptoOrden: 62, esGasto: true, valor: cta(DEP_AMORT[1]) },
  { etiqueta: "UTILIDAD ANTES DE IMPUESTOS", signo: "(=)", nivel: "sub", pptoOrden: 71,
    valor: (e, m) => v(e, "4", m) - v(e, "5", m) },
  { etiqueta: "Impuesto de renta", signo: "(−)", nivel: "det", pptoOrden: 72, esGasto: true,
    valor: (e, m) => (m === "acum" ? provisionRenta(e).provision : impuestoMes(e)) },
  { etiqueta: "UTILIDAD NETA", signo: "(=)", nivel: "tot", pptoOrden: 75,
    valor: (e, m) => v(e, "4", m) - v(e, "5", m)
      - (m === "acum" ? provisionRenta(e).provision : impuestoMes(e)) },
];

/** Lo que queda fuera de las filas impresas del bloque de ingresos. Debe ser CERO: si
 *  aparece algo, el informe está escondiendo una partida nueva de la clase 4. */
export const residuoIngresos = (etq: string, modo: Modo) =>
  v(etq, "4", modo) - otrosIngresos(etq, modo) - v(etq, "4175", modo)
  - ["4150", "4180", "425035", "425055", "4265"].reduce((s, c) => s + v(etq, c, modo), 0);
