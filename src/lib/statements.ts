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
  // El mes lleva una estimación proporcional; el acumulado lleva la provisión completa.
  const impuestoMes = Math.max(resMes, 0) * tasa, netoMes = resMes - impuestoMes;
  const impuestoYTD = pr.provision, netoYTD = pr.neto;
  return { ingresos, gastos, ingMes, gasMes, ingYTD, gasYTD, resMes, resYTD, tasa, impuestoMes, netoMes, impuestoYTD, netoYTD };
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
): NodoPct | null {
  const c = D.cuentaByCodigo.get(codigo);
  if (!c) return null;
  const hijos = D.children(codigo)
    .map((ch) => nodoPct(ch.codigo, meses, depth + 1, calc))
    .filter((x): x is NodoPct => x !== null);
  const vals = meses.map((m) => calc(m, codigo));
  if (vals.every((v) => v === null || v === 0) && hijos.length === 0) return null;
  return { codigo, nombre: c.nombre, depth, vals, hijos };
}

export function analisisMatriz(
  estado: "esf" | "er", modo: "vertical" | "horizontal",
  meses: { etiqueta: string; anio: number; mes: number }[],
) {
  const etqs = meses.map((m) => m.etiqueta);
  const flujo = estado === "er";
  const val = (e: string, c: string) => (flujo ? D.fact(e, c) : D.fact(e, c)); // ambos: valor del mes
  const calc: (e: string, c: string) => number | null =
    modo === "vertical"
      ? (e, c) => {
          const base = flujo ? D.fact(e, "4") : D.fact(e, "1");
          return base ? (val(e, c) / base) * 100 : null;
        }
      : (e, c) => {
          const py = D.sameMonthPrevYear(e)?.etiqueta;
          if (!py) return null;
          const prev = val(py, c);
          if (!prev) return null;
          return ((val(e, c) - prev) / Math.abs(prev)) * 100;
        };
  const raices = flujo ? ["4", "5"] : ["1", "2", "3"];
  const titulos: Record<string, string> = { "1": "Activo", "2": "Pasivo", "3": "Patrimonio", "4": "Ingresos", "5": "Gastos" };
  return {
    labels: meses.map(mesLabel),
    secciones: raices.map((r) => ({
      titulo: titulos[r],
      arbol: nodoPct(r, etqs, -1, calc)?.hijos ?? [],
      totalVals: etqs.map((m) => calc(m, r)),
    })),
    base: modo === "vertical" ? (flujo ? "los ingresos del mes" : "el total de activos del mes") : "el mismo mes del año anterior",
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

/** ER multi-mes con árbol completo. `meses` viene de D.mesesVista(). */
export function erMatrizArbol(meses: { etiqueta: string; anio: number; mes: number }[]) {
  const etqs = meses.map((m) => m.etiqueta);
  const ultimo = etqs[etqs.length - 1];
  const fila = (codigo: string) => ({ vals: etqs.map((m) => D.fact(m, codigo)), acum: D.ytd(ultimo, codigo) });
  const ing = fila("4"), gas = fila("5");
  const prs = etqs.map((m) => provisionRenta(m));
  const prUlt = prs[prs.length - 1];
  return {
    labels: meses.map(mesLabel),
    ingresos: nodoM("4", etqs, -1, true, ultimo)?.hijos ?? [],
    gastos: nodoM("5", etqs, -1, true, ultimo)?.hijos ?? [],
    totalIng: ing, totalGas: gas,
    utilAntes: { vals: etqs.map((m, i) => ing.vals[i] - gas.vals[i]), acum: ing.acum - gas.acum },
    impuesto: { vals: etqs.map((m, i) => Math.max(ing.vals[i] - gas.vals[i], 0) * prs[i].tasa), acum: prUlt.provision },
    utilNeta: { vals: etqs.map((m, i) => (ing.vals[i] - gas.vals[i]) * (ing.vals[i] - gas.vals[i] > 0 ? 1 - prs[i].tasa : 1)), acum: prUlt.neto },
    tasa: prUlt.tasa,
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
