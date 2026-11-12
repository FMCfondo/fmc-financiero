import "server-only";
import ExcelJS from "exceljs";
import * as D from "./data";
import { clave } from "./presupuesto-carga";
import { FORMATO, NAVY, relleno } from "./balances-excel";

/* PLANTILLA DEL PRESUPUESTO DEL AÑO SIGUIENTE (pedido del 2026-11-12). Es la hoja que
   después se sube en Presupuesto › Cargar: «PPTO <año>», los conceptos del último plan
   con sus niveles como grupos de Excel (de ahí lee el cargador el nivel), los doce meses
   y el total. Cada concepto se casa por (nivel, etiqueta) con el año anterior, así que
   las etiquetas salen idénticas para que hereden su mapeo.

   Viene llena con el último presupuesto, para ajustar en vez de digitar de cero. Los
   conceptos con detalle y los totales son FÓRMULAS: al cambiar un mes, se recalculan. Las
   fórmulas de los totales siguen el nombre de cada línea; se escriben con su resultado ya
   calculado, para que la hoja se pueda cargar aunque no se abra en Excel. */

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO",
  "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const COL_MES = (m: number) => String.fromCharCode(66 + m); // B..M
const COL_TOTAL = "N";

/** Los totales del estado de resultados, por su etiqueta: qué conceptos de primer nivel
 *  suman (+) o restan (−). Una etiqueta que no esté en el plan deja ese total como cifra,
 *  sin fórmula, y se avisa en `sinFormula`. */
const TOTALES: Record<string, string[]> = {
  "INGRESOS DE OPERACIÓN": ["+Ingresos por inversiones", "+Ingresos por comisiones", "+Ingresos por recuperaciones", "-Provisiones (Reservas Individuales)"],
  "SUBTOTAL EBITDA": ["+INGRESOS DE OPERACIÓN", "-Gastos de Administración"],
  "EBITDA ANTES DE DIFERENCIA EN CAMBIO": ["+SUBTOTAL EBITDA", "+Otros ingresos efectivos inherentes", "-Otros egresos efectivos inherentes"],
  "EBITDA": ["+EBITDA ANTES DE DIFERENCIA EN CAMBIO", "+Diferencia en cambio operación Ingreso", "-Diferencia en cambio operación Egreso"],
  "UTILIDAD OPERATIVA": ["+EBITDA", "-Depreciaciones", "-Amortizaciones", "-Provisiones"],
  "TOTAL FINANCIEROS": ["+Intereses deuda financiera", "+Intereses Leasing", "+Diferencia en cambio deuda financiera (neto)"],
  "UTILIDAD ANTES DE OTROS ING Y EGR": ["+UTILIDAD OPERATIVA", "-TOTAL FINANCIEROS"],
  "UTILIDAD ANTES DE IMPUESTOS": ["+UTILIDAD ANTES DE OTROS ING Y EGR", "+Otros ingresos efectivos no inherentes"],
  "UTILIDAD NETA": ["+UTILIDAD ANTES DE IMPUESTOS", "-Impuesto de Renta (provisión)", "-Efecto impuesto diferido NIIF"],
};
/** La provisión de renta del plan: la tasa de la app sobre la utilidad antes de impuestos. */
const RENTA = { fila: "Provisión Renta", base: "UTILIDAD ANTES DE IMPUESTOS" };

type Formula = { tipo: "suma"; filas: number[] } | { tipo: "terminos"; terminos: { fila: number; signo: 1 | -1 }[] } | { tipo: "renta"; fila: number; tasa: number };

export async function plantillaPresupuesto(): Promise<{ archivo: ExcelJS.Buffer; nombre: string; anio: number; sinFormula: string[] } | null> {
  const anios = [...new Set(D.presupuesto.map((l) => l.anio))].sort((a, b) => a - b);
  const base = anios[anios.length - 1];
  if (base === undefined) return null;
  const anio = base + 1;
  const lineas = D.presupuesto.filter((l) => l.anio === base).sort((a, b) => a.orden - b.orden);

  // Fila de cada concepto de primer nivel, para las fórmulas de los totales.
  const primerNivel = new Map<string, number>();
  lineas.forEach((l, i) => { if (l.nivel === 0 && !primerNivel.has(clave(l.etiqueta))) primerNivel.set(clave(l.etiqueta), i); });

  const sinFormula: string[] = [];
  const formulas: (Formula | null)[] = lineas.map((l, i) => {
    const hijas: number[] = [];
    for (let j = i + 1; j < lineas.length && lineas[j].nivel > l.nivel; j++) if (lineas[j].nivel === l.nivel + 1) hijas.push(j);
    if (hijas.length) return { tipo: "suma", filas: hijas };
    const terminos = l.nivel === 0 ? TOTALES[Object.keys(TOTALES).find((k) => clave(k) === clave(l.etiqueta)) ?? ""] : undefined;
    if (terminos) {
      const t = terminos.map((x) => ({ fila: primerNivel.get(clave(x.slice(1))), signo: (x[0] === "-" ? -1 : 1) as 1 | -1 }));
      if (t.every((x) => x.fila !== undefined)) return { tipo: "terminos", terminos: t as { fila: number; signo: 1 | -1 }[] };
      sinFormula.push(l.etiqueta);
      return null;
    }
    if (clave(l.etiqueta) === clave(RENTA.fila)) {
      const b = primerNivel.get(clave(RENTA.base));
      if (b !== undefined) return { tipo: "renta", fila: b, tasa: D.paramNum("tasa_imporenta", 0.35) };
      sinFormula.push(l.etiqueta);
    }
    if (l.tipo === "total") sinFormula.push(l.etiqueta);
    return null;
  });

  // El resultado de cada fórmula, mes a mes, para dejarlo escrito junto a la fórmula.
  const memo = new Map<string, number>();
  const valor = (i: number, m: number): number => {
    const k = `${i}:${m}`;
    if (memo.has(k)) return memo.get(k)!;
    const f = formulas[i];
    const v = !f ? lineas[i].meses[m] ?? 0
      : f.tipo === "suma" ? f.filas.reduce((s, j) => s + valor(j, m), 0)
      : f.tipo === "terminos" ? f.terminos.reduce((s, t) => s + t.signo * valor(t.fila, m), 0)
      : valor(f.fila, m) * f.tasa;
    memo.set(k, v);
    return v;
  };

  const wb = new ExcelJS.Workbook();
  wb.calcProperties = { fullCalcOnLoad: true };
  const hoja = wb.addWorksheet(`PPTO ${anio}`, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
    properties: { defaultRowHeight: 15, outlineProperties: { summaryBelow: false, summaryRight: false } },
  });
  hoja.columns = [{ width: 62 }, ...MESES.map(() => ({ width: 14 })), { width: 16 }];
  const enc = hoja.addRow(["CONCEPTO", ...MESES, `TOTAL ${anio}`]);
  enc.eachCell((c, n) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = relleno(NAVY);
    c.alignment = { horizontal: n === 1 ? "left" : "right" };
  });

  const filaDe = (i: number) => i + 2; // la fila 1 es la cabecera
  lineas.forEach((l, i) => {
    const f = formulas[i];
    const r = filaDe(i);
    const celdas = MESES.map((_, m) => {
      const col = COL_MES(m);
      const result = Math.round(valor(i, m) * 100) / 100;
      if (!f) return result;
      const formula = f.tipo === "suma" ? `SUM(${f.filas.map((j) => `${col}${filaDe(j)}`).join(",")})`
        : f.tipo === "terminos" ? f.terminos.map((t, n) => `${t.signo < 0 ? "-" : n ? "+" : ""}${col}${filaDe(t.fila)}`).join("")
        : `${col}${filaDe(f.fila)}*${f.tasa}`;
      return { formula, result };
    });
    const total = { formula: `SUM(B${r}:M${r})`, result: Math.round(MESES.reduce((s, _, m) => s + valor(i, m), 0) * 100) / 100 };
    const fila = hoja.addRow([l.etiqueta, ...celdas, total]);
    if (l.nivel > 0) fila.outlineLevel = l.nivel;
    const esTotal = l.tipo === "total";
    fila.eachCell((c, n) => {
      if (n > 1) c.numFmt = FORMATO;
      if (esTotal) { c.font = { bold: true }; c.fill = relleno("FFE2E8F7"); }
      else if (f && n > 1) c.font = { color: { argb: "FF4A5A78" } }; // fórmula: se recalcula sola
    });
    fila.getCell(1).alignment = { indent: l.nivel };
    fila.getCell(COL_TOTAL).font = { bold: true };
  });

  return { archivo: await wb.xlsx.writeBuffer(), nombre: `FMC-Plantilla-PPTO-${anio}.xlsx`, anio, sinFormula };
}
