import "server-only";
import ExcelJS from "exceljs";
import * as D from "./data";
import { mesCorto } from "./format";

/* Los balances procesados, en un Excel: reemplaza la hoja RESUMEN que el usuario armaba a
   mano (pedido del 2026-11-05). Una sola hoja, cuentas en filas y meses en columnas, con
   una columna en blanco entre años. No calcula nada: son las cifras del motor, las mismas
   de la pantalla Balances.

   DOS FORMAS DE VER LOS MESES:
   · «mes»: ingresos, gastos y costos con el movimiento de cada mes.
   · «acumulado»: esas mismas cuentas sumadas de enero a cada mes (`D.ytd`).
   Las cuentas de balance (activo, pasivo, patrimonio y orden) son el saldo al cierre en
   los dos casos: un saldo ya es acumulado por naturaleza.

   Se usa ExcelJS y no SheetJS porque la edición libre de SheetJS no escribe estilos ni
   inmoviliza paneles, y con más de 40 columnas sin encabezado fijo la hoja no se lee. */

export type ModoBalance = "mes" | "acumulado";

/** Clases que se des-acumulan (RN1): las demás son saldo puntual. */
const esDeResultado = (clase: number) => clase >= 4 && clase <= 7;

/** 0 clase · 1 grupo · 2 cuenta · 3+ subcuenta y auxiliar. Es la jerarquía de la pantalla. */
const nivelDe = (longitud: number) => ({ 1: 0, 2: 1, 4: 2, 6: 3, 8: 4, 10: 5 }[longitud] ?? 5);

export const NAVY = "FF13286E";
export const relleno = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const FONDO_NIVEL: Record<number, string> = { 0: NAVY, 1: "FFE2E8F7", 2: "FFF1F4FB" };

/** Miles sin decimales, negativos entre paréntesis y raya en cero, como en los estados.
 *  El centavo sigue en la celda: el formato solo cambia lo que se ve. */
export const FORMATO = '#,##0;(#,##0);"-"';

export async function balancesExcel(modo: ModoBalance): Promise<{ archivo: ExcelJS.Buffer; nombre: string }> {
  const periodos = D.periodos;
  const anios = [...new Set(periodos.map((p) => p.anio))];
  const titulo = modo === "mes" ? "Balances del mes" : "Balances acumulados";

  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet(titulo, {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });

  /* Columnas: Código, Cuenta y los meses de cada año. `null` es la columna en blanco que
     separa un año del siguiente. */
  const columnas: (D.Periodo | null)[] = anios.flatMap((a, i) => [
    ...(i ? [null] : []),
    ...periodos.filter((p) => p.anio === a),
  ]);
  hoja.columns = [
    { width: 13 }, { width: 46 },
    ...columnas.map((c) => ({ width: c ? 15 : 3 })),
  ];

  const encabezado = hoja.addRow([
    "Código", "Cuenta", ...columnas.map((c) => (c ? `${mesCorto[c.mes]} ${c.anio}` : null)),
  ]);
  encabezado.eachCell((celda, n) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = relleno(NAVY);
    celda.alignment = { horizontal: n <= 2 ? "left" : "right" };
  });

  for (const c of D.cuentas) {
    const acumula = modo === "acumulado" && esDeResultado(c.clase);
    // Redondeado al centavo: sumar decimales deja restos como 0,30000000000000004.
    const valor = (etq: string) => Math.round((acumula ? D.ytd(etq, c.codigo) : D.fact(etq, c.codigo)) * 100) / 100;
    const vals = columnas.map((p) => (p ? valor(p.etiqueta) : null));
    // Una cuenta sin valor en ningún mes solo estorba, igual que en la pantalla.
    if (vals.every((v) => !v)) continue;

    const nivel = nivelDe(c.longitud);
    const fila = hoja.addRow([Number(c.codigo), c.nombre, ...vals]);
    const fondo = FONDO_NIVEL[nivel];
    fila.eachCell((celda, n) => {
      if (n > 2) celda.numFmt = FORMATO;
      if (fondo) celda.fill = relleno(fondo);
      if (nivel === 0) celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
      else if (nivel === 1) celda.font = { bold: true };
    });
    fila.getCell(1).numFmt = "0";
    fila.getCell(1).alignment = { horizontal: "left" };
    fila.getCell(2).alignment = { indent: nivel };
  }

  const ultimo = periodos[periodos.length - 1]?.etiqueta ?? "";
  return {
    archivo: await wb.xlsx.writeBuffer(),
    nombre: `FMC-${titulo}-${ultimo}.xlsx`.replace(/ /g, "-"),
  };
}
