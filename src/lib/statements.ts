// Motor de estados financieros. Server-only (usa la capa de datos).
import "server-only";
import * as D from "./data";
import { mesCorto } from "./format";

export type Linea = {
  codigo: string; nombre: string; nivel: number; depth: number;
  valor: number; valorYtd?: number; hijos: Linea[];
};

function nodo(codigo: string, etq: string, depth: number, conYtd: boolean): Linea | null {
  const c = D.cuentaByCodigo.get(codigo);
  if (!c) return null;
  const hijos = D.children(codigo)
    .map((ch) => nodo(ch.codigo, etq, depth + 1, conYtd))
    .filter((x): x is Linea => x !== null);
  const valor = D.fact(etq, codigo);
  const valorYtd = conYtd ? D.ytd(etq, codigo) : undefined;
  if (valor === 0 && (valorYtd === undefined || valorYtd === 0) && hijos.length === 0) return null;
  return { codigo, nombre: c.nombre, nivel: c.longitud, depth, valor, valorYtd, hijos };
}

// ---------- Provisión de impuesto de renta (estructura del analista) ----------
// Utilidad del ejercicio
//   (+) Gravamen al movimiento financiero 50% (no deducible)
//   (+) Otros gastos no deducibles
//   (=) Renta líquida gravable
//   (=) Impuesto (tasa%)  → ESTA es la provisión que va al pasivo y resta al patrimonio
//   (−) Anticipos (retención en la fuente)
//   (+) Anticipo para el siguiente año
//   (=) Impuesto de renta por pagar (saldo con la DIAN, informativo)
// Los parámetros viven en la tabla `parametro` y se editan en /impuesto:
// cambiarlos recalcula TODA la app porque todos los estados llaman aquí.
// El GMF (4×1000) vive en la cuenta 53152001; el 50% no es deducible y se suma
// a la renta líquida. Se calcula AUTOMÁTICO sobre el acumulado al mes seleccionado.
export const CTA_GMF = "53152001";

export function provisionRenta(etq: string) {
  const ingYTD = D.ytd(etq, "4"), gasYTD = D.ytd(etq, "5");
  const utilidad = ingYTD - gasYTD;
  const gmf = D.ytd(etq, CTA_GMF) * 0.5;
  const otrosND = D.paramNum("prov_otros_nd", 0);
  const rentaLiquida = utilidad + gmf + otrosND;
  const tasa = D.paramNum("tasa_imporenta", 0.35);
  const provision = Math.max(rentaLiquida, 0) * tasa;
  const anticipoRet = D.paramNum("prov_anticipo_ret", 0);
  const anticipoSig = D.paramNum("prov_anticipo_sig", 0);
  const porPagar = provision - anticipoRet + anticipoSig;
  const neto = utilidad - provision;
  return { ingYTD, gasYTD, utilidad, gmf, otrosND, rentaLiquida, tasa, provision, anticipoRet, anticipoSig, porPagar, neto };
}

// ---------- Estado de Situación Financiera ----------
export function esf(etq: string) {
  const activo = nodo("1", etq, -1, false);
  const pasivo = nodo("2", etq, -1, false);
  const patrimonio = nodo("3", etq, -1, false);
  const totalActivo = D.fact(etq, "1");
  const pasivoBase = D.fact(etq, "2");
  const patrimBase = D.fact(etq, "3");
  const pr = provisionRenta(etq);
  const preTax = pr.utilidad;
  const tasa = pr.tasa;
  const impuesto = pr.provision;
  const neto = pr.neto;
  const totalPasivo = pasivoBase + impuesto;
  const totalPatrim = patrimBase + neto;
  const descuadre = totalActivo - (totalPasivo + totalPatrim);
  return { activo, pasivo, patrimonio, totalActivo, pasivoBase, patrimBase, impuesto, neto, totalPasivo, totalPatrim, descuadre, preTax, tasa };
}

// ---------- Estado de Resultados ----------
export function er(etq: string) {
  const ingresos = nodo("4", etq, -1, true);
  const gastos = nodo("5", etq, -1, true);
  const ingMes = D.fact(etq, "4"), gasMes = D.fact(etq, "5");
  const ingYTD = D.ytd(etq, "4"), gasYTD = D.ytd(etq, "5");
  const resMes = ingMes - gasMes, resYTD = ingYTD - gasYTD;
  const pr = provisionRenta(etq);
  const tasa = pr.tasa;
  // El mes lleva la provisión marginal (cuadra al sumar los meses); el acumulado, la completa.
  const impMes = impuestoMes(etq), netoMes = resMes - impMes;
  const impuestoYTD = pr.provision, netoYTD = pr.neto;
  return { ingresos, gastos, ingMes, gasMes, ingYTD, gasYTD, resMes, resYTD, tasa, impuestoMes: impMes, netoMes, impuestoYTD, netoYTD };
}

// ---------- Dashboard ----------
export function dashboard(etq: string) {
  const p = D.periodo(etq);
  const activo = D.fact(etq, "1"), pasivo = D.fact(etq, "2"), patrim = D.fact(etq, "3");
  const ingMes = D.fact(etq, "4"), gasMes = D.fact(etq, "5");
  const resMes = ingMes - gasMes;
  const ingYTD = D.ytd(etq, "4"), gasYTD = D.ytd(etq, "5"), resYTD = ingYTD - gasYTD;

  const trend = D.ultimosPeriodos(etq, 12).map((q) => ({
    mes: `${mesCorto[q.mes]} ${String(q.anio).slice(2)}`,
    ingresos: D.fact(q.etiqueta, "4"),
    gastos: D.fact(q.etiqueta, "5"),
    resultado: D.fact(q.etiqueta, "4") - D.fact(q.etiqueta, "5"),
  }));

  const compActivo = D.children("1")
    .map((c) => ({ name: c.nombre, codigo: c.codigo, value: D.fact(etq, c.codigo) }))
    .filter((x) => x.value > 0).sort((a, b) => b.value - a.value);

  const gastosMes = D.children("5")
    .map((c) => ({ name: c.nombre, codigo: c.codigo, value: D.fact(etq, c.codigo) }))
    .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);

  const indicadores = {
    endeudamiento: activo ? pasivo / activo : 0,
    autonomia: activo ? patrim / activo : 0,
    margenNeto: ingYTD ? resYTD / ingYTD : 0,
    roe: patrim ? resYTD / patrim : 0,
  };

  return { p, activo, pasivo, patrim, ingMes, gasMes, resMes, ingYTD, gasYTD, resYTD, trend, compActivo, gastosMes, indicadores };
}

// ---------- Reclasificación analítica: costo de cobertura ----------
// 5199150101 "Mutuales" se contabiliza como gasto (clase 5) pero es el COSTO del
// servicio de cobertura; se resta del ingreso de cobertura (4180). No altera la
// utilidad final (sólo la presentación). SAS → "Utilidad", no "excedente".
export const COSTO_COBERTURA = "5199150101";
export const ING_COBERTURA = "4180";
// Rendimiento de las inversiones (CDT + fiducias). Es el segundo motor de utilidad:
// aporta ~46% de la contribución bruta, casi tanto como la cobertura.
export const ING_FINANCIERO = "4150";

export function variacion(cur: number, prev: number | null | undefined) {
  if (prev === null || prev === undefined) return { abs: 0, pct: 0, has: false };
  const abs = cur - prev;
  const pct = prev !== 0 ? (abs / Math.abs(prev)) * 100 : 0;
  return { abs, pct, has: prev !== 0 || cur !== 0 };
}

export function operacion(etq: string) {
  const ingCob = D.ytd(etq, ING_COBERTURA);
  const costo = D.ytd(etq, COSTO_COBERTURA);
  const brutoCob = ingCob - costo;
  const ingTotal = D.ytd(etq, "4");
  const otrosIng = ingTotal - ingCob;
  const gastoTotal = D.ytd(etq, "5");
  const gastosAdmin = gastoTotal - costo;
  const utilAntesImp = ingTotal - gastoTotal;
  const pr = provisionRenta(etq);
  return { ingCob, costo, brutoCob, otrosIng, ingTotal, gastosAdmin, gastoTotal, utilAntesImp, impuesto: pr.provision, utilNeta: pr.neto, tasa: pr.tasa };
}

// Cascada (waterfall) lista para el gráfico: base transparente + valor visible.
// Estructura con ANCLAS de subtotal (vuelven al eje cero y re-anclan la lectura):
// sigue el modelo de los dos motores, no el orden contable crudo.
export function cascadaChart(etq: string, modo: "acum" | "mes" = "acum") {
  const c = contribucionPeriodo(etq, modo);
  const pasos: { label: string; tipo: "inc" | "dec" | "total"; valor: number }[] = [
    { label: "Ingresos por cobertura", tipo: "inc", valor: c.ingCob },
    { label: "(−) Costo de cobertura", tipo: "dec", valor: -c.costoCob },
    { label: "= Aporte de cobertura", tipo: "total", valor: c.contribCob },
    { label: "(+) Ingresos por inversiones", tipo: "inc", valor: c.contribInv },
    { label: "(+) Otros ingresos netos", tipo: "inc", valor: c.otrosNetos },
    { label: "(−) Gastos de administración", tipo: "dec", valor: -c.gastosAdmin },
    { label: "= Utilidad antes de impuestos", tipo: "total", valor: c.utilAntesImp },
    { label: "(−) Impuesto de renta", tipo: "dec", valor: -c.impuesto },
    { label: "= Utilidad neta", tipo: "total", valor: c.utilNeta },
  ];
  let run = 0;
  return pasos.map((s) => {
    if (s.tipo === "total") {
      run = s.valor;
      return { name: s.label, base: 0, value: Math.abs(s.valor), tipo: s.tipo, signo: s.valor >= 0 ? 1 : -1 };
    }
    const start = run;
    run += s.valor;
    return { name: s.label, base: Math.min(start, run), value: Math.abs(s.valor), tipo: s.tipo, signo: s.valor >= 0 ? 1 : -1 };
  });
}

// Detalle por área (para las pestañas Activos/Pasivos/Ingresos/Gastos).
export function areaDetalle(etq: string, clase: number) {
  const cod = String(clase);
  const flujo = clase >= 4; // ingresos/gastos → acumulado del año; balance → saldo puntual
  const val = (e: string, c: string) => (flujo ? D.ytd(e, c) : D.fact(e, c));
  const pm = D.prevPeriodo(etq)?.etiqueta ?? null;
  const py = D.sameMonthPrevYear(etq)?.etiqueta ?? null;
  const total = val(etq, cod);

  const grupos = D.children(cod)
    .map((g) => {
      const v = val(etq, g.codigo);
      return {
        codigo: g.codigo, nombre: g.nombre, valor: v, share: 0,
        pctMes: pm ? variacion(v, val(pm, g.codigo)).pct : null,
        pctAnio: py ? variacion(v, val(py, g.codigo)).pct : null,
      };
    })
    .filter((x) => x.valor !== 0)
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

  const totalAbs = grupos.reduce((s, g) => s + Math.abs(g.valor), 0) || 1;
  grupos.forEach((g) => (g.share = Math.abs(g.valor) / totalAbs));

  return {
    total, grupos, flujo,
    pctMes: pm ? variacion(total, val(pm, cod)).pct : null,
    pctAnio: py ? variacion(total, val(py, cod)).pct : null,
  };
}

// KPIs del resumen con comparativo interanual (mismo mes del año anterior).
// Usa los TOTALES del estado (pasivo + provisión, patrimonio + utilidad) para que
// en el Dashboard se cumpla la ecuación A = P + K, igual que en el Balance.
export function kpisResumen(etq: string) {
  const py = D.sameMonthPrevYear(etq)?.etiqueta ?? null;
  const s = esf(etq);
  const sPy = py ? esf(py) : null;
  return {
    activo: s.totalActivo, pasivo: s.totalPasivo, patrim: s.totalPatrim,
    utilNeta: s.neto, utilMes: D.fact(etq, "4") - D.fact(etq, "5"),
    activoYoY: sPy ? variacion(s.totalActivo, sPy.totalActivo).pct : null,
    pasivoYoY: sPy ? variacion(s.totalPasivo, sPy.totalPasivo).pct : null,
    patrimYoY: sPy ? variacion(s.totalPatrim, sPy.totalPatrim).pct : null,
    utilYoY: sPy ? variacion(s.neto, sPy.neto).pct : null,
  };
}

// ---------- Contribución: los dos motores de utilidad ----------
// FMC gana por dos vías que comparten una misma estructura administrativa:
// cubrir (4180 − 5199150101) e invertir (4150). Los gastos de administración son
// un COSTO CONJUNTO — parte de ellos gestiona las inversiones — así que NO se
// reparten entre los dos motores: se restan de la contribución total.
// Repartirlos daría un "resultado técnico" falso (validado con el analista).
export function contribucion(etq: string) {
  const ingCob = D.ytd(etq, ING_COBERTURA);
  const costoCob = D.ytd(etq, COSTO_COBERTURA);
  const contribCob = ingCob - costoCob;
  const contribInv = D.ytd(etq, ING_FINANCIERO);
  const contribTotal = contribCob + contribInv;
  const gastosAdmin = D.ytd(etq, "51") - costoCob; // admin reales, sin el costo de cobertura
  const ingYTD = D.ytd(etq, "4"), gasYTD = D.ytd(etq, "5");
  const utilAntesImp = ingYTD - gasYTD;
  // Todo lo demás (otros ingresos/gastos, devoluciones) va a un residuo explícito
  // para que la descomposición cuadre exactamente contra clase 4 − clase 5.
  const otrosNetos = utilAntesImp - (contribTotal - gastosAdmin);
  const pr = provisionRenta(etq);
  return {
    ingCob, costoCob, contribCob, contribInv, contribTotal, gastosAdmin, otrosNetos,
    utilAntesImp, impuesto: pr.provision, utilNeta: pr.neto,
    pctCob: contribTotal ? contribCob / contribTotal : 0,
    pctInv: contribTotal ? contribInv / contribTotal : 0,
  };
}

/** Gastos de administración REALES por categoría, ordenados.
 *  Excluye 5199 porque ahí vive el costo de cobertura (es el 84% de la clase 51):
 *  sin excluirlo, cualquier gráfico de gastos muestra una barra gigante llamada
 *  "Otros gastos" y no dice nada. */
export function gastosAdminDetalle(etq: string) {
  return D.children("51")
    .filter((g) => !g.codigo.startsWith("5199"))
    .map((g) => ({ codigo: g.codigo, name: g.nombre, value: D.ytd(etq, g.codigo) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Contribución en modo "acum" (año corrido) o "mes" (solo el mes seleccionado),
 *  para el toggle del Resumen. En modo mes el impuesto es la estimación proporcional. */
export function contribucionPeriodo(etq: string, modo: "acum" | "mes") {
  if (modo === "acum") return contribucion(etq);
  const v = (c: string) => D.fact(etq, c);
  const ingCob = v(ING_COBERTURA), costoCob = v(COSTO_COBERTURA);
  const contribCob = ingCob - costoCob;
  const contribInv = v(ING_FINANCIERO);
  const contribTotal = contribCob + contribInv;
  const gastosAdmin = v("51") - costoCob;
  const utilAntesImp = v("4") - v("5");
  const otrosNetos = utilAntesImp - (contribTotal - gastosAdmin);
  const tasa = D.paramNum("tasa_imporenta", 0.35);
  const impuesto = Math.max(utilAntesImp, 0) * tasa;
  return {
    ingCob, costoCob, contribCob, contribInv, contribTotal, gastosAdmin, otrosNetos,
    utilAntesImp, impuesto, utilNeta: utilAntesImp - impuesto,
    pctCob: contribTotal ? contribCob / contribTotal : 0,
    pctInv: contribTotal ? contribInv / contribTotal : 0,
  };
}

// ---------- Panel de Resultados del Dashboard ----------
// Cuentas de gastos que no son plata (para el EBITDA): depreciaciones y amortizaciones.
const CTA_DEPRECIACIONES = "5160";
const CTA_AMORTIZACIONES = "5165";
// La Junta lee el ER con estructura EBITDA: la sección Gastos EXCLUYE estas dos
// (del árbol y del total) y ambas reaparecen como líneas propias entre el EBITDA
// y la utilidad antes de impuestos.
export const DEP_AMORT = [CTA_DEPRECIACIONES, CTA_AMORTIZACIONES];

/** Impuesto de renta atribuible al MES: la provisión marginal (acumulada del mes
 *  menos la del mes anterior del MISMO año). Así los meses SUMAN el impuesto
 *  acumulado — antes el mes usaba una estimación proporcional que ignoraba el
 *  50% del GMF y no cuadraba con el acumulado. En enero (o si no hay mes previo
 *  del año) la base es 0, porque la provisión reinicia con el año fiscal. */
export function impuestoMes(etq: string): number {
  const p = D.periodo(etq);
  const prev = D.prevPeriodo(etq);
  const base = prev && prev.anio === p.anio ? provisionRenta(prev.etiqueta).provision : 0;
  return provisionRenta(etq).provision - base;
}

/** Valor mensual de una cuenta EXCLUYENDO las depreciaciones/amortizaciones que
 *  contenga (para la sección Gastos con estructura EBITDA). Solo afecta a los
 *  ancestros de 5160/5165 (la clase 5 y el grupo 51); en el resto = fact. */
function valOper(etq: string, codigo: string): number {
  let v = D.fact(etq, codigo);
  for (const d of DEP_AMORT) if (d !== codigo && d.startsWith(codigo)) v -= D.fact(etq, d);
  return v;
}
function valOperYtd(etq: string, codigo: string): number {
  let v = D.ytd(etq, codigo);
  for (const d of DEP_AMORT) if (d !== codigo && d.startsWith(codigo)) v -= D.ytd(etq, d);
  return v;
}

/** Cadena EBITDA del ER para un conjunto de meses (SUMA de los meses dados: sirve
 *  igual para un mes suelto o para un período — bimestre, trimestre, año). */
function cadenaEbitda(etqs: string[]) {
  const s = (c: string) => etqs.reduce((a, m) => a + D.fact(m, c), 0);
  const ing = s("4"), gas = s("5"), dep = s(CTA_DEPRECIACIONES), amort = s(CTA_AMORTIZACIONES);
  const gastosOper = gas - dep - amort;
  const uai = ing - gas;
  const impuesto = etqs.reduce((a, m) => a + impuestoMes(m), 0);
  return { ing, gastosOper, dep, amort, ebitda: ing - gastosOper, uai, impuesto, utilNeta: uai - impuesto };
}
/** Cadena EBITDA ACUMULADA del año hasta `etq` (el impuesto es la provisión completa). */
function cadenaEbitdaYtd(etq: string) {
  const ing = D.ytd(etq, "4"), gas = D.ytd(etq, "5");
  const dep = D.ytd(etq, CTA_DEPRECIACIONES), amort = D.ytd(etq, CTA_AMORTIZACIONES);
  const gastosOper = gas - dep - amort;
  const pr = provisionRenta(etq);
  return { ing, gastosOper, dep, amort, ebitda: ing - gastosOper, uai: ing - gas, impuesto: pr.provision, utilNeta: pr.neto };
}
export type ClaveEbitda = "ebitda" | "dep" | "amort" | "uai" | "impuesto" | "utilNeta";
/** Filas de cierre EBITDA (etiquetas + tipo de subtotal) — orden de la Junta. */
export const FILAS_EBITDA: { clave: ClaveEbitda; nombre: string; tipo?: "sub" | "total" }[] = [
  { clave: "ebitda", nombre: "(=) EBITDA", tipo: "sub" },
  { clave: "dep", nombre: "(−) Depreciaciones" },
  { clave: "amort", nombre: "(−) Amortizaciones" },
  { clave: "uai", nombre: "(=) Utilidad antes de impuestos", tipo: "sub" },
  { clave: "impuesto", nombre: "(−) Impuesto de renta" },
  { clave: "utilNeta", nombre: "(=) Utilidad neta", tipo: "total" },
];

/** KPIs del panel de Resultados, en modo acumulado del año o solo el mes. */
export function resultadosPanel(etq: string, modo: "acum" | "mes") {
  const v = (c: string) => (modo === "acum" ? D.ytd(etq, c) : D.fact(etq, c));
  const ingTotal = v("4"), gasTotal = v("5");
  const utilAntes = ingTotal - gasTotal;
  const depAmort = v(CTA_DEPRECIACIONES) + v(CTA_AMORTIZACIONES);
  const ebitda = utilAntes + depAmort;
  const c = contribucionPeriodo(etq, modo);
  return {
    ingCob: c.ingCob, contribCob: c.contribCob, contribInv: c.contribInv,
    gastosAdmin: c.gastosAdmin, ingTotal, utilAntes,
    ebitda, margenEbitda: ingTotal ? ebitda / ingTotal : 0,
    utilNeta: c.utilNeta, margenNeto: ingTotal ? c.utilNeta / ingTotal : 0,
  };
}

/** Serie mensual de EBITDA y utilidad neta (12 meses), para los gráficos del panel. */
export function serieResultados(etq: string, n = 12) {
  return D.ultimosPeriodos(etq, n).map((q) => {
    const res = D.fact(q.etiqueta, "4") - D.fact(q.etiqueta, "5");
    return {
      mes: mesLabel(q),
      ebitda: res + D.fact(q.etiqueta, CTA_DEPRECIACIONES) + D.fact(q.etiqueta, CTA_AMORTIZACIONES),
      utilNeta: res - impuestoMes(q.etiqueta),
    };
  });
}

/** Serie COMPLETA de ingresos/gastos por mes, para el explorador con
 *  multi-selección de años y meses (solo ese gráfico). */
export function trendCompleto() {
  return D.periodos.map((q) => ({
    anio: q.anio, mesNum: q.mes,
    mes: `${mesCorto[q.mes]} ${String(q.anio).slice(2)}`,
    ingresos: D.fact(q.etiqueta, "4"),
    gastos: D.fact(q.etiqueta, "5"),
  }));
}

/** Composición del patrimonio TOTAL (incluye la utilidad estimada del ejercicio),
 *  para que la participación sume el patrimonio con el que cuadra la ecuación. */
export function patrimonioComposicion(etq: string) {
  const pr = provisionRenta(etq);
  const partes = D.children("3")
    .map((g) => ({ name: g.nombre, value: D.fact(etq, g.codigo) }))
    .filter((x) => Math.abs(x.value) > 0.5);
  partes.push({ name: "Utilidad del ejercicio (estimada)", value: pr.neto });
  const total = partes.reduce((s, x) => s + x.value, 0);
  return { partes: partes.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)), total };
}

/** Análisis vertical/horizontal multi-mes, con la misma vista de árbol × meses.
 *  Vertical: participación % de cada cuenta sobre la base DE ESE MES.
 *  Horizontal: variación % de cada mes contra el MISMO MES del año anterior
 *  (null cuando no existe el comparativo → se imprime raya).                 */
export type NodoPct = {
  codigo: string; nombre: string; depth: number;
  vals: (number | null)[]; hijos: NodoPct[];
};

function nodoPct(
  codigo: string, meses: string[], depth: number,
  calc: (etq: string, codigo: string) => number | null,
  omitir?: string[],
): NodoPct | null {
  if (omitir?.includes(codigo)) return null;
  const c = D.cuentaByCodigo.get(codigo);
  if (!c) return null;
  const hijos = D.children(codigo)
    .map((ch) => nodoPct(ch.codigo, meses, depth + 1, calc, omitir))
    .filter((x): x is NodoPct => x !== null);
  const vals = meses.map((m) => calc(m, codigo));
  if (vals.every((v) => v === null || v === 0) && hijos.length === 0) return null;
  return { codigo, nombre: c.nombre, depth, vals, hijos };
}

/** `contra` (solo horizontal): "anio" = mismo mes del año anterior;
 *  "mes" = mes inmediatamente anterior. En la comparación interanual las
 *  columnas son el mismo mes de años consecutivos, así que "anio" compara
 *  cada columna contra la anterior de forma natural. */
export function analisisMatriz(
  estado: "esf" | "er", modo: "vertical" | "horizontal",
  meses: { etiqueta: string; anio: number; mes: number }[],
  contra: "anio" | "mes" = "anio",
) {
  const etqs = meses.map((m) => m.etiqueta);
  const flujo = estado === "er";
  // ER: los gastos se muestran SIN dep/amort (estructura EBITDA), así que su valor
  // y el de sus ancestros (5, 51) excluye esas cuentas. ESF: valor directo.
  const val = flujo ? (e: string, c: string) => valOper(e, c) : (e: string, c: string) => D.fact(e, c);
  const refDe = (e: string) => (contra === "anio" ? D.sameMonthPrevYear(e)?.etiqueta : D.prevPeriodo(e)?.etiqueta);
  const pct = (e: string, v: number | null): number | null => {
    if (v === null) return null;
    const base = flujo ? D.fact(e, "4") : D.fact(e, "1");
    return base ? (v / base) * 100 : null;
  };
  const varPct = (e: string, cur: number | null, prev: number | null): number | null =>
    cur === null || !prev ? null : ((cur - prev) / Math.abs(prev)) * 100;
  const calc: (e: string, c: string) => number | null =
    modo === "vertical"
      ? (e, c) => pct(e, val(e, c))
      : (e, c) => { const r = refDe(e); return r ? varPct(e, val(e, c), val(r, c)) : null; };
  const raices = flujo ? ["4", "5"] : ["1", "2", "3"];
  const titulos: Record<string, string> = { "1": "Activo", "2": "Pasivo", "3": "Patrimonio", "4": "Ingresos", "5": "Gastos" };

  // Cierre EBITDA (solo ER): cada fila como % de los ingresos (vertical) o su
  // variación contra el período de referencia (horizontal).
  const finCalc = (e: string, k: ClaveEbitda): number | null => {
    const cur = cadenaEbitda([e])[k];
    if (modo === "vertical") return pct(e, cur);
    const r = refDe(e);
    return r ? varPct(e, cur, cadenaEbitda([r])[k]) : null;
  };
  const filasFinales = flujo
    ? FILAS_EBITDA.map((f) => ({ nombre: f.nombre, tipo: f.tipo, vals: etqs.map((m) => finCalc(m, f.clave)) }))
    : [];

  return {
    labels: meses.map(mesLabel),
    secciones: raices.map((r) => ({
      titulo: titulos[r],
      arbol: nodoPct(r, etqs, -1, calc, flujo ? DEP_AMORT : undefined)?.hijos ?? [],
      totalVals: etqs.map((m) => calc(m, r)),
    })),
    filasFinales,
    base: modo === "vertical"
      ? (flujo ? "los ingresos del mes" : "el total de activos del mes")
      : (contra === "anio" ? "el mismo mes del año anterior" : "el mes anterior"),
  };
}

// ---------- Comparación interanual: un período comparado a través de los años ----------
// Unidad elegible (mes, bimestre, trimestre, cuatrimestre, semestre, año) e índice
// dentro del año (T1, S2...). Las columnas son SIEMPRE todos los años de
// funcionamiento: si un año no tiene datos para ese período se muestra raya (—),
// y si los tiene incompletos (p. ej. S1 de 2026 con datos hasta mayo) se marca *.
export type UnidadPeriodo = "mes" | "bimestre" | "trimestre" | "cuatrimestre" | "semestre" | "anio";
export const TAM_UNIDAD: Record<UnidadPeriodo, number> = { mes: 1, bimestre: 2, trimestre: 3, cuatrimestre: 4, semestre: 6, anio: 12 };

export type ColAnio = {
  anio: number; label: string; parcial: boolean;
  meses: { etiqueta: string; anio: number; mes: number }[];
  finEtq: string | null; // último mes con datos dentro del período (para saldos)
};

export function interanualCols(unidad: UnidadPeriodo, indice: number): ColAnio[] {
  const tam = TAM_UNIDAD[unidad];
  const ini = (indice - 1) * tam + 1;
  const fin = ini + tam - 1;
  const anios = [...new Set(D.periodos.map((p) => p.anio))].sort();
  return anios.map((anio) => {
    const meses = D.periodos.filter((p) => p.anio === anio && p.mes >= ini && p.mes <= fin);
    const parcial = meses.length > 0 && meses.length < tam;
    return {
      anio, meses, parcial,
      finEtq: meses.length ? meses[meses.length - 1].etiqueta : null,
      label: `${anio}${parcial ? "*" : ""}`,
    };
  });
}

type NodoNull = { codigo: string; nombre: string; depth: number; vals: (number | null)[]; acum: number | null; hijos: NodoNull[] };

function nodoCols(codigo: string, cols: ColAnio[], depth: number, valFn: (col: ColAnio, codigo: string) => number | null, omitir?: string[]): NodoNull | null {
  if (omitir?.includes(codigo)) return null;
  const c = D.cuentaByCodigo.get(codigo);
  if (!c) return null;
  const hijos = D.children(codigo)
    .map((ch) => nodoCols(ch.codigo, cols, depth + 1, valFn, omitir))
    .filter((x): x is NodoNull => x !== null);
  const vals = cols.map((col) => valFn(col, codigo));
  if (vals.every((v) => v === null || v === 0) && hijos.length === 0) return null;
  return { codigo, nombre: c.nombre, depth, vals, acum: null, hijos };
}

export function interanualData(estado: "esf" | "er", unidad: UnidadPeriodo, indice: number) {
  const cols = interanualCols(unidad, indice);
  const flujo = estado === "er";
  // ER (flujo): SUMA de los meses del período. ESF (saldo): saldo al CIERRE del período.
  const val = (col: ColAnio, codigo: string): number | null => {
    if (!col.meses.length) return null;
    return flujo
      ? col.meses.reduce((sum, m) => sum + D.fact(m.etiqueta, codigo), 0)
      : D.fact(col.finEtq as string, codigo);
  };
  // Igual que `val`, pero en el ER excluye dep/amort (estructura EBITDA). Se usa
  // para los árboles y los totales de sección; `val` (completo) se conserva para
  // la utilidad del período y el resumen de los dos motores.
  const valArbol = (col: ColAnio, codigo: string): number | null => {
    if (!col.meses.length) return null;
    return flujo
      ? col.meses.reduce((sum, m) => sum + valOper(m.etiqueta, codigo), 0)
      : D.fact(col.finEtq as string, codigo);
  };
  const omitir = flujo ? DEP_AMORT : undefined;
  const raices = flujo ? ["4", "5"] : ["1", "2", "3"];
  const titulos: Record<string, string> = { "1": "Activo", "2": "Pasivo", "3": "Patrimonio", "4": "Ingresos", "5": "Gastos" };
  // Cadena EBITDA por columna (una vez): sirve a las filas de cierre.
  const cadenas = cols.map((c) => (c.meses.length ? cadenaEbitda(c.meses.map((m) => m.etiqueta)) : null));

  const cifras = raices.map((r) => ({
    titulo: titulos[r],
    arbol: nodoCols(r, cols, -1, valArbol, omitir)?.hijos ?? [],
    totalVals: cols.map((c) => valArbol(c, r)),
  }));

  // Horizontal: cada año contra el año anterior CON DATOS del mismo período.
  const horiz = (codigo: string): (number | null)[] =>
    cols.map((c, i) => {
      const v = valArbol(c, codigo);
      if (v === null) return null;
      for (let j = i - 1; j >= 0; j--) {
        const prev = valArbol(cols[j], codigo);
        if (prev === null) continue;
        return prev === 0 ? null : ((v - prev) / Math.abs(prev)) * 100;
      }
      return null;
    });
  // Vertical: participación dentro de su propia columna.
  const vert = (codigo: string): (number | null)[] =>
    cols.map((c) => {
      const v = valArbol(c, codigo);
      const base = valArbol(c, flujo ? "4" : "1");
      return v === null || !base ? null : (v / base) * 100;
    });
  const analitico = (calc: (codigo: string) => (number | null)[]) =>
    raices.map((r) => ({
      titulo: titulos[r],
      arbol: nodoCols(r, cols, -1, (col, codigo) => calc(codigo)[cols.indexOf(col)], omitir)?.hijos ?? [],
      totalVals: calc(r),
    }));

  // Filas de cierre EBITDA por columna (solo ER): cifras en pesos, horizontal en
  // variación contra el año previo con datos, vertical como % de los ingresos.
  const finVals = (k: ClaveEbitda, tipo: "cifra" | "horiz" | "vert"): (number | null)[] => {
    if (tipo === "cifra") return cadenas.map((c) => (c ? c[k] : null));
    if (tipo === "vert") return cadenas.map((c, i) => { const base = valArbol(cols[i], "4"); return c && base ? (c[k] / base) * 100 : null; });
    return cadenas.map((c, i) => {
      if (!c) return null;
      for (let j = i - 1; j >= 0; j--) { const p = cadenas[j]; if (!p) continue; return p[k] === 0 ? null : ((c[k] - p[k]) / Math.abs(p[k])) * 100; }
      return null;
    });
  };
  const finales = (tipo: "cifra" | "horiz" | "vert") =>
    flujo ? FILAS_EBITDA.map((f) => ({ nombre: f.nombre, tipo: f.tipo, vals: finVals(f.clave, tipo) })) : [];

  // Utilidad del período por columna (solo flujo).
  const utilPeriodo: (number | null)[] = flujo
    ? cols.map((c) => {
        const ing = val(c, "4"), gas = val(c, "5");
        return ing === null || gas === null ? null : ing - gas;
      })
    : [];

  // Resumen del período (solo flujo): los dos motores + gastos + utilidad.
  const menos = (x: number | null) => (x === null ? null : -x);
  const resumen = flujo
    ? [
        { nombre: "Ingresos por cobertura de créditos", vals: cols.map((c) => val(c, ING_COBERTURA)) },
        { nombre: "(−) Costo de cobertura", vals: cols.map((c) => menos(val(c, COSTO_COBERTURA))) },
        { nombre: "Ingresos por inversiones", vals: cols.map((c) => val(c, ING_FINANCIERO)) },
        { nombre: "(−) Gastos totales (sin costo de cobertura)", vals: cols.map((c) => { const g = val(c, "5"), cc = val(c, COSTO_COBERTURA); return g === null || cc === null ? null : -(g - cc); }) },
        { nombre: "(=) Utilidad del período (antes de impuestos)", vals: utilPeriodo },
      ]
    : [];

  // Indicadores al cierre de cada período (solo columnas con datos).
  const periodosCierre = cols
    .filter((c) => c.finEtq)
    .map((c) => ({ etiqueta: c.finEtq as string, anio: c.anio, mes: c.meses[c.meses.length - 1].mes }));

  return {
    labels: cols.map((c) => c.label),
    finEtqs: cols.map((c) => c.finEtq),
    algunParcial: cols.some((c) => c.parcial),
    cifras, horizontal: analitico(horiz), vertical: analitico(vert),
    finalesCifras: finales("cifra"), finalesHorizontal: finales("horiz"), finalesVertical: finales("vert"),
    utilPeriodo, resumen, periodosCierre,
    labelsCierre: cols.filter((c) => c.finEtq).map((c) => c.label),
  };
}

/** Serie mensual de la contribución de cada motor, para ver cómo se mueve la mezcla. */
export function contribucionTrend(etq: string, n = 12) {
  return D.ultimosPeriodos(etq, n).map((q) => ({
    mes: `${mesCorto[q.mes]} ${String(q.anio).slice(2)}`,
    cobertura: D.fact(q.etiqueta, ING_COBERTURA) - D.fact(q.etiqueta, COSTO_COBERTURA),
    inversiones: D.fact(q.etiqueta, ING_FINANCIERO),
  }));
}

// ---------- Análisis Vertical (% de una base) y Horizontal (vs año anterior) ----------
export type LineaAnalisis = {
  codigo: string; nombre: string; nivel: number; depth: number; valor: number;
  pct: number; valorPrev: number | null; varAbs: number | null; varPct: number | null;
  hijos: LineaAnalisis[];
};

function enrich(node: Linea, base: number, etqPrev: string | null, conYtd: boolean): LineaAnalisis {
  const valorPrev = etqPrev ? (conYtd ? D.ytd(etqPrev, node.codigo) : D.fact(etqPrev, node.codigo)) : null;
  return {
    codigo: node.codigo, nombre: node.nombre, nivel: node.nivel, depth: node.depth, valor: node.valor,
    pct: base ? node.valor / base : 0,
    valorPrev,
    varAbs: valorPrev !== null ? node.valor - valorPrev : null,
    varPct: valorPrev ? ((node.valor - valorPrev) / Math.abs(valorPrev)) * 100 : null,
    hijos: node.hijos.map((h) => enrich(h, base, etqPrev, conYtd)),
  };
}

export function esfAnalisis(etq: string) {
  const s = esf(etq);
  const py = D.sameMonthPrevYear(etq)?.etiqueta ?? null;
  const base = s.totalActivo || 1; // vertical: % del total de activos
  return {
    py, base,
    activo: (s.activo?.hijos ?? []).map((h) => enrich(h, base, py, false)),
    pasivo: (s.pasivo?.hijos ?? []).map((h) => enrich(h, base, py, false)),
    patrimonio: (s.patrimonio?.hijos ?? []).map((h) => enrich(h, base, py, false)),
    totalActivo: s.totalActivo, totalPasivo: s.totalPasivo, totalPatrim: s.totalPatrim,
  };
}

export function erAnalisis(etq: string) {
  const s = er(etq);
  const py = D.sameMonthPrevYear(etq)?.etiqueta ?? null;
  const base = s.ingYTD || 1; // vertical: % de los ingresos
  return {
    py, base,
    ingresos: (s.ingresos?.hijos ?? []).map((h) => enrich(h, base, py, true)),
    gastos: (s.gastos?.hijos ?? []).map((h) => enrich(h, base, py, true)),
    ingYTD: s.ingYTD, gasYTD: s.gasYTD, resYTD: s.resYTD,
  };
}

// ---------- Estado de Flujos de Efectivo (método indirecto, mensual) ----------
// Flujo del mes: utilidad + Δ capital de trabajo (fuentes/usos) reconciliado contra
// el cambio del disponible (clase 11). Reconcilia por construcción al incluir todos
// los grupos. Clasificación de inversión/financiación ajustable.
const INVERSION_ASSET = ["12", "15", "16", "17", "18"];
const FINANCIERA_LIAB = ["21"];
type Mov = { codigo: string; nombre: string; valor: number };

export function flujoEfectivo(etq: string) {
  const prev = D.prevPeriodo(etq)?.etiqueta ?? null;
  if (!prev) return null;
  const util = D.fact(etq, "4") - D.fact(etq, "5"); // resultado del mes (antes de impuestos)
  const srcAsset = (c: string): number => D.fact(prev, c) - D.fact(etq, c); // fuente si el activo baja
  const srcLiab = (c: string): number => D.fact(etq, c) - D.fact(prev, c); // fuente si el pasivo sube

  const activos = D.children("1").filter((g) => g.codigo !== "11");
  const map = (arr: typeof activos, fn: (c: string) => number): Mov[] =>
    arr.map((g) => ({ codigo: g.codigo, nombre: g.nombre, valor: fn(g.codigo) })).filter((x) => Math.abs(x.valor) > 0.5);

  const opAssets = map(activos.filter((g) => !INVERSION_ASSET.includes(g.codigo)), srcAsset);
  const invAssets = map(activos.filter((g) => INVERSION_ASSET.includes(g.codigo)), srcAsset);
  const opLiab = map(D.children("2").filter((g) => !FINANCIERA_LIAB.includes(g.codigo)), srcLiab);
  const finLiab = map(D.children("2").filter((g) => FINANCIERA_LIAB.includes(g.codigo)), srcLiab);
  const finPat = map(D.children("3"), srcLiab);

  const sum = (a: Mov[]) => a.reduce((s, x) => s + x.valor, 0);
  const dispIni = D.fact(prev, "11");
  const dispReal = D.fact(etq, "11");
  const opBase = util + sum(opAssets) + sum(opLiab);
  const flujoInv = sum(invAssets);
  const flujoFin = sum(finLiab) + sum(finPat);
  // Residuo por partidas no monetarias / ajustes de datos → el estado cuadra exacto.
  const ajuste = dispReal - dispIni - (opBase + flujoInv + flujoFin);
  const flujoOp = opBase + ajuste;
  const neto = flujoOp + flujoInv + flujoFin;
  const dispFin = dispIni + neto;
  return {
    prev, util, opAssets, invAssets, opLiab, finLiab, finPat, ajuste,
    flujoOp, flujoInv, flujoFin, neto, dispIni, dispFin, dispReal,
    cuadra: true, dif: 0,
  };
}

// ---------- Estado de Cambios en el Patrimonio (acumulado del año) ----------
export function cambiosPatrimonio(etq: string) {
  const p = D.periodo(etq);
  const ini =
    D.periodos.find((q) => q.anio === p.anio - 1 && q.mes === 12)?.etiqueta ??
    D.periodos.find((q) => q.anio === p.anio && q.mes === 1)?.etiqueta ?? null;
  const comps = D.children("3").map((g) => ({
    codigo: g.codigo, nombre: g.nombre,
    inicial: ini ? D.fact(ini, g.codigo) : 0,
    final: D.fact(etq, g.codigo),
    movimiento: (ini ? D.fact(etq, g.codigo) - D.fact(ini, g.codigo) : 0),
  }));
  const resultado = D.ytd(etq, "4") - D.ytd(etq, "5"); // utilidad del ejercicio
  const totalInicial = comps.reduce((s, c) => s + c.inicial, 0);
  const totalFinalBase = comps.reduce((s, c) => s + c.final, 0);
  return { ini, comps, resultado, totalInicial, totalFinalBase, totalFinal: totalFinalBase + resultado };
}

// ---------- Gráficos de la hoja ESF (tendencia + participación) ----------
export function esfCharts(etq: string) {
  const trend = D.ultimosPeriodos(etq, 12).map((q) => ({
    mes: `${mesCorto[q.mes]} ${String(q.anio).slice(2)}`,
    activo: D.fact(q.etiqueta, "1"),
    pasivo: D.fact(q.etiqueta, "2"),
  }));
  const comp = (cod: string) =>
    D.children(cod).map((g) => ({ name: g.nombre, value: D.fact(etq, g.codigo) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  return { trend, compActivo: comp("1"), compInversiones: comp("12") };
}

// ---------- Estados multi-mes: árbol de cuentas × columnas de meses ----------
// La vista "Estado" muestra los meses de izquierda a derecha (segmentadores de
// meses y de año). El ER lleva además una columna de Acumulado separada; el ESF
// no la necesita porque cada saldo ya es acumulado por naturaleza.
export type NodoM = {
  codigo: string; nombre: string; depth: number;
  vals: number[]; acum: number | null; hijos: NodoM[];
};

const mesLabel = (p: { anio: number; mes: number }) => `${mesCorto[p.mes]} ${String(p.anio).slice(2)}`;

function nodoM(codigo: string, meses: string[], depth: number, flujo: boolean, etqAcum: string): NodoM | null {
  const c = D.cuentaByCodigo.get(codigo);
  if (!c) return null;
  const hijos = D.children(codigo)
    .map((ch) => nodoM(ch.codigo, meses, depth + 1, flujo, etqAcum))
    .filter((x): x is NodoM => x !== null);
  const vals = meses.map((m) => D.fact(m, codigo));
  const acum = flujo ? D.ytd(etqAcum, codigo) : null;
  if (vals.every((v) => v === 0) && !acum && hijos.length === 0) return null;
  return { codigo, nombre: c.nombre, depth, vals, acum, hijos };
}

/** Árbol de gastos con estructura EBITDA: omite dep/amort y descuenta su valor de
 *  cada ancestro (así los subtotales de 51 y del total siguen cuadrando). */
function nodoMOper(codigo: string, meses: string[], depth: number, etqAcum: string): NodoM | null {
  if (DEP_AMORT.includes(codigo)) return null;
  const c = D.cuentaByCodigo.get(codigo);
  if (!c) return null;
  const hijos = D.children(codigo)
    .map((ch) => nodoMOper(ch.codigo, meses, depth + 1, etqAcum))
    .filter((x): x is NodoM => x !== null);
  const vals = meses.map((m) => valOper(m, codigo));
  const acum = valOperYtd(etqAcum, codigo);
  if (vals.every((v) => v === 0) && !acum && hijos.length === 0) return null;
  return { codigo, nombre: c.nombre, depth, vals, acum, hijos };
}

/** ER multi-mes con árbol completo. `meses` viene de D.mesesVista(). */
export function erMatrizArbol(meses: { etiqueta: string; anio: number; mes: number }[]) {
  const etqs = meses.map((m) => m.etiqueta);
  const ultimo = etqs[etqs.length - 1];
  const cad = etqs.map((m) => cadenaEbitda([m]));
  const cadAcum = cadenaEbitdaYtd(ultimo);
  // Cada fila de cierre: valor por mes + acumulado del año.
  const pick = (k: ClaveEbitda) => ({ vals: cad.map((c) => c[k]), acum: cadAcum[k] });
  return {
    labels: meses.map(mesLabel),
    ingresos: nodoM("4", etqs, -1, true, ultimo)?.hijos ?? [],
    gastos: nodoMOper("5", etqs, -1, ultimo)?.hijos ?? [], // sin dep/amort, subtotales cuadrados
    totalIng: { vals: etqs.map((m) => D.fact(m, "4")), acum: D.ytd(ultimo, "4") },
    totalGas: { vals: cad.map((c) => c.gastosOper), acum: cadAcum.gastosOper }, // gastos operativos (sin dep/amort)
    ebitda: pick("ebitda"), dep: pick("dep"), amort: pick("amort"),
    utilAntes: pick("uai"), impuesto: pick("impuesto"), utilNeta: pick("utilNeta"),
    tasa: provisionRenta(ultimo).tasa,
  };
}

/** ESF multi-mes: saldos por mes (ya acumulados por naturaleza, sin columna extra).
 *  Incluye la provisión y la utilidad por mes para que A = P + K cuadre en cada columna. */
export function esfMatrizArbol(meses: { etiqueta: string; anio: number; mes: number }[]) {
  const etqs = meses.map((m) => m.etiqueta);
  const prs = etqs.map((m) => provisionRenta(m));
  const activoVals = etqs.map((m) => D.fact(m, "1"));
  const pasivoVals = etqs.map((m, i) => D.fact(m, "2") + prs[i].provision);
  const patrimVals = etqs.map((m, i) => D.fact(m, "3") + prs[i].neto);
  return {
    labels: meses.map(mesLabel),
    activo: nodoM("1", etqs, -1, false, etqs[etqs.length - 1])?.hijos ?? [],
    pasivo: nodoM("2", etqs, -1, false, etqs[etqs.length - 1])?.hijos ?? [],
    patrimonio: nodoM("3", etqs, -1, false, etqs[etqs.length - 1])?.hijos ?? [],
    provision: etqs.map((_, i) => prs[i].provision),
    utilidad: etqs.map((_, i) => prs[i].neto),
    totalActivo: activoVals, totalPasivo: pasivoVals, totalPatrim: patrimVals,
    descuadre: etqs.map((_, i) => activoVals[i] - pasivoVals[i] - patrimVals[i]),
  };
}

/** Flujo de efectivo multi-mes: las líneas principales, un mes por columna. */
export function flujoMatriz(meses: { etiqueta: string; anio: number; mes: number }[]) {
  const cols = meses.map((m) => ({ label: mesLabel(m), f: flujoEfectivo(m.etiqueta) }));
  const pick = (fn: (f: NonNullable<ReturnType<typeof flujoEfectivo>>) => number) =>
    cols.map((c) => (c.f ? fn(c.f) : null));
  return {
    labels: cols.map((c) => c.label),
    filas: [
      { id: "util", nombre: "Utilidad del período", vals: pick((f) => f.util) },
      { id: "ajuste", nombre: "Partidas no monetarias y ajustes", vals: pick((f) => f.ajuste) },
      { id: "op", nombre: "Flujo neto de operación", vals: pick((f) => f.flujoOp), sub: true },
      { id: "inv", nombre: "Flujo neto de inversión", vals: pick((f) => f.flujoInv), sub: true },
      { id: "fin", nombre: "Flujo neto de financiación", vals: pick((f) => f.flujoFin), sub: true },
      { id: "neto", nombre: "Variación neta del efectivo", vals: pick((f) => f.neto), total: true },
      { id: "ini", nombre: "Efectivo al inicio", vals: pick((f) => f.dispIni) },
      { id: "fin2", nombre: "Efectivo al final", vals: pick((f) => f.dispFin), total: true },
    ],
  };
}
