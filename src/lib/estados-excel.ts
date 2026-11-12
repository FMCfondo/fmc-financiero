import "server-only";
import ExcelJS from "exceljs";
import * as D from "./data";
import { mesCorto } from "./format";
import { esfMatrizArbol, type NodoM } from "./statements";
import { erJunta } from "./er-junta";
import { FORMATO, NAVY, relleno } from "./balances-excel";

/* Estado de Resultados y Situación Financiera en Excel, con el mismo árbol y los mismos
   totales de la pantalla (pedido del 2026-11-06, para armar el presupuesto sobre esa
   estructura). Todos los meses en una hoja y una columna en blanco entre años. El ER lleva
   además el acumulado de cada año, como su pantalla; el ESF no, porque un saldo ya es
   acumulado. No calcula nada: las filas salen de `erJunta` (las líneas del Informe de
   Junta, desde el 2026-11-12) y de `esfMatrizArbol`.

   EL DETALLE VA AGRUPADO con la función de agrupar de Excel: abre contraído, y cada cuenta
   se despliega con su botón + o con los botones de nivel de la esquina. La fila que resume
   un grupo queda ENCIMA de su detalle, por eso `summaryBelow: false`. */

export type Estado = "er" | "esf";

type Estilo = "seccion" | "grupo" | "cuenta" | "detalle" | "linea" | "sub" | "total";
type Fila = { codigo?: string; nombre: string; vals?: number[]; nivel: number; estilo: Estilo };

/** Una fila por cuenta del árbol, de arriba abajo. La profundidad es el nivel de grupo. */
function filasDelArbol(arbol: NodoM[]): Fila[] {
  return arbol.flatMap((n) => [
    {
      codigo: n.codigo, nombre: n.nombre, vals: n.vals, nivel: n.depth,
      estilo: (n.depth === 0 ? "grupo" : n.depth === 1 ? "cuenta" : "detalle") as Estilo,
    },
    ...filasDelArbol(n.hijos),
  ]);
}

const seccion = (nombre: string): Fila => ({ nombre, nivel: 0, estilo: "seccion" });
const linea = (nombre: string, vals: number[], estilo: Estilo = "linea"): Fila => ({ nombre, vals, nivel: 0, estilo });

/** Las líneas del Informe de Junta; las de detalle llevan agrupadas sus cuentas. */
function filasER(meses: D.Periodo[]): Fila[] {
  return erJunta(meses).lineas.flatMap((l) =>
    l.nivel === "det"
      ? [linea(`${l.signo} ${l.etiqueta}`, l.vals, "grupo"), ...filasDelArbol(l.hijos)]
      : [linea(`${l.signo} ${l.etiqueta}`, l.vals, l.nivel === "tot" ? "total" : "sub")],
  );
}

function filasESF(meses: D.Periodo[]): Fila[] {
  const m = esfMatrizArbol(meses);
  return [
    seccion("Activo"),
    ...filasDelArbol(m.activo),
    linea("Total activos", m.totalActivo, "total"),
    seccion("Pasivo"),
    ...filasDelArbol(m.pasivo),
    linea("Provisión impuesto de renta (estimada)", m.provision),
    linea("Total pasivos", m.totalPasivo, "total"),
    seccion("Patrimonio"),
    ...filasDelArbol(m.patrimonio),
    linea("Utilidad del ejercicio (estimada)", m.utilidad),
    linea("Total patrimonio", m.totalPatrim, "total"),
  ];
}

const FONDO: Partial<Record<Estilo, string>> = {
  seccion: NAVY, total: NAVY, grupo: "FFE2E8F7", sub: "FFE2E8F7", cuenta: "FFF1F4FB",
};
const FONDO_ACUMULADO = "FFFDF6E3";
const NEGRITA: Estilo[] = ["seccion", "total", "sub", "grupo"];

/** Lo que va en cada columna de cifras. */
type Columna = { tipo: "mes"; i: number; titulo: string } | { tipo: "acum"; anio: number; titulo: string } | { tipo: "blanco" };

export async function estadoExcel(estado: Estado): Promise<{ archivo: ExcelJS.Buffer; nombre: string }> {
  const periodos = D.periodos;
  const titulo = estado === "er" ? "Estado de Resultados" : "Situación Financiera";
  const filas = estado === "er" ? filasER(periodos) : filasESF(periodos);

  const columnas: Columna[] = [...new Set(periodos.map((p) => p.anio))].flatMap((anio, a) => [
    ...(a ? [{ tipo: "blanco" } as Columna] : []),
    ...periodos.flatMap((p, i) => (p.anio === anio ? [{ tipo: "mes", i, titulo: `${mesCorto[p.mes]} ${p.anio}` } as Columna] : [])),
    ...(estado === "er" ? [{ tipo: "acum", anio, titulo: `Acumulado ${anio}` } as Columna] : []),
  ]);

  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet(titulo, {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    properties: { defaultRowHeight: 15, outlineProperties: { summaryBelow: false, summaryRight: false } },
  });
  hoja.columns = [
    { width: 13 }, { width: 50 },
    ...columnas.map((c) => ({ width: c.tipo === "blanco" ? 3 : c.tipo === "acum" ? 17 : 15 })),
  ];

  const encabezado = hoja.addRow(["Código", "Cuenta", ...columnas.map((c) => (c.tipo === "blanco" ? null : c.titulo))]);
  encabezado.eachCell((celda, n) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = relleno(NAVY);
    celda.alignment = { horizontal: n <= 2 ? "left" : "right" };
  });

  // Redondeado al centavo: sumar decimales deja restos como 0,30000000000000004.
  const centavos = (v: number) => Math.round(v * 100) / 100;
  /** El acumulado del año es la suma de sus meses, igual que en la pantalla: el impuesto
   *  de cada mes es la provisión marginal, justamente para que sumen. */
  const celda = (c: Columna, vals: number[]) => {
    if (c.tipo === "blanco") return null;
    if (c.tipo === "mes") return centavos(vals[c.i] ?? 0);
    return centavos(periodos.reduce((s, p, i) => (p.anio === c.anio ? s + (vals[i] ?? 0) : s), 0));
  };

  for (const f of filas) {
    const fila = hoja.addRow([
      f.codigo ? Number(f.codigo) : null, f.nombre,
      ...columnas.map((c) => (f.vals ? celda(c, f.vals) : null)),
    ]);
    if (f.nivel > 0) { fila.outlineLevel = f.nivel; fila.hidden = true; }

    const fondo = FONDO[f.estilo];
    const blanco = f.estilo === "seccion" || f.estilo === "total";
    for (let n = 1; n <= columnas.length + 2; n++) {
      const col = n > 2 ? columnas[n - 3] : null;
      if (col?.tipo === "blanco") continue; // la columna en blanco queda en blanco de verdad
      const c = fila.getCell(n);
      if (col) c.numFmt = FORMATO;
      const tono = fondo ?? (col?.tipo === "acum" ? FONDO_ACUMULADO : undefined);
      if (tono) c.fill = relleno(tono);
      if (blanco) c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      else if (NEGRITA.includes(f.estilo)) c.font = { bold: true };
    }
    fila.getCell(1).numFmt = "0";
    fila.getCell(1).alignment = { horizontal: "left" };
    fila.getCell(2).alignment = { indent: f.nivel };
  }

  const ultimo = periodos[periodos.length - 1]?.etiqueta ?? "";
  const base = estado === "er" ? "Estado-de-Resultados" : "Situacion-Financiera";
  return { archivo: await wb.xlsx.writeBuffer(), nombre: `FMC-${base}-${ultimo}.xlsx` };
}
