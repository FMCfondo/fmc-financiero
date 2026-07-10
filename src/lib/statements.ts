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
