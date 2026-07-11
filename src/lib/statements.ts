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

// ---------- Estado de Situación Financiera ----------
export function esf(etq: string) {
  const activo = nodo("1", etq, -1, false);
  const pasivo = nodo("2", etq, -1, false);
  const patrimonio = nodo("3", etq, -1, false);
  const totalActivo = D.fact(etq, "1");
  const pasivoBase = D.fact(etq, "2");
  const patrimBase = D.fact(etq, "3");
  const ingYTD = D.ytd(etq, "4");
  const gasYTD = D.ytd(etq, "5");
  const preTax = ingYTD - gasYTD;
  const tasa = D.tasaImpuesto;
  const impuesto = Math.max(preTax, 0) * tasa;
  const neto = preTax - impuesto;
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
  const tasa = D.tasaImpuesto;
  const impuestoMes = Math.max(resMes, 0) * tasa, netoMes = resMes - impuestoMes;
  const impuestoYTD = Math.max(resYTD, 0) * tasa, netoYTD = resYTD - impuestoYTD;
  return { ingresos, gastos, ingMes, gasMes, ingYTD, gasYTD, resMes, resYTD, tasa, impuestoMes, netoMes, impuestoYTD, netoYTD };
}

// ---------- Provisión de impuesto (con tasa configurable) ----------
export function impuesto(etq: string, tasa: number) {
  const ingYTD = D.ytd(etq, "4"), gasYTD = D.ytd(etq, "5");
  const preTax = ingYTD - gasYTD;
  const prov = Math.max(preTax, 0) * tasa;
  const neto = preTax - prov;
  return { ingYTD, gasYTD, preTax, tasa, prov, neto };
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
  const tasa = D.tasaImpuesto;
  const impuesto = Math.max(utilAntesImp, 0) * tasa;
  const utilNeta = utilAntesImp - impuesto;
  return { ingCob, costo, brutoCob, otrosIng, ingTotal, gastosAdmin, gastoTotal, utilAntesImp, impuesto, utilNeta, tasa };
}

// Cascada (waterfall) lista para el gráfico: base transparente + valor visible.
export function cascadaChart(etq: string) {
  const o = operacion(etq);
  const pasos: { label: string; tipo: "inc" | "dec" | "total"; valor: number }[] = [
    { label: "Ing. cobertura", tipo: "inc", valor: o.ingCob },
    { label: "(−) Costo", tipo: "dec", valor: -o.costo },
    { label: "Bruto cobertura", tipo: "total", valor: o.brutoCob },
    { label: "(+) Otros ingresos", tipo: "inc", valor: o.otrosIng },
    { label: "(−) Gastos admón.", tipo: "dec", valor: -o.gastosAdmin },
    { label: "(−) Impuesto", tipo: "dec", valor: -o.impuesto },
    { label: "Utilidad neta", tipo: "total", valor: o.utilNeta },
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
export function kpisResumen(etq: string) {
  const py = D.sameMonthPrevYear(etq)?.etiqueta ?? null;
  const activo = D.fact(etq, "1"), pasivo = D.fact(etq, "2"), patrim = D.fact(etq, "3");
  const o = operacion(etq);
  const oPy = py ? operacion(py) : null;
  return {
    activo, pasivo, patrim, utilNeta: o.utilNeta, utilMes: D.fact(etq, "4") - D.fact(etq, "5"),
    activoYoY: py ? variacion(activo, D.fact(py, "1")).pct : null,
    pasivoYoY: py ? variacion(pasivo, D.fact(py, "2")).pct : null,
    patrimYoY: py ? variacion(patrim, D.fact(py, "3")).pct : null,
    utilYoY: oPy ? variacion(o.utilNeta, oPy.utilNeta).pct : null,
  };
}
