/* Selector de filas del presupuesto para el informe.
 *
 * Existe por una trampa concreta: la tabla `ppto` tiene filas DUPLICADAS por fórmula.
 * En 2026 hay TRES con `ebitda` (SUBTOTAL EBITDA · EBITDA ANTES DE DIFERENCIA EN CAMBIO ·
 * EBITDA), CUATRO con `uai` —una de ellas vale cero— y DOS con `impuesto`. Buscar por
 * fórmula devuelve la primera, que no siempre es la del informe: para el EBITDA eso
 * descuadra 2,3 millones anuales contra el Excel certificado.
 *
 * Regla: cuando la fórmula es ambigua hay que nombrar la etiqueta exacta.
 */
import "server-only";
import * as D from "./data";

/** Fórmulas que deben tener UNA sola fila. Si aparece otra, algo cambió en el
 *  presupuesto y hay que revisarlo antes de publicar cifras. */
const UNICAS = ["ing_operacion", "gastos_admin", "util_neta"];

export function filasPorFormula(anio: number, formula: string): D.PptoLinea[] {
  return D.presupuesto.filter((l) => l.anio === anio && l.formula === formula);
}

/** La fila del presupuesto que usa el informe. `etiqueta` es obligatoria cuando la
 *  fórmula tiene más de una fila; sin ella se devuelve la primera y se avisa. */
export function filaPpto(anio: number, formula: string, etiqueta?: string): D.PptoLinea | null {
  const cand = filasPorFormula(anio, formula);
  if (!cand.length) return null;
  if (etiqueta) {
    const objetivo = etiqueta.trim().toUpperCase();
    return cand.find((l) => l.etiqueta.trim().toUpperCase() === objetivo) ?? null;
  }
  return cand[0];
}

/** Presupuesto del tramo enero..mes (acumulado) de una fila. */
export const pptoAcumulado = (l: D.PptoLinea, mes: number) =>
  l.meses.slice(0, mes).reduce((s, x) => s + x, 0);

/** Presupuesto del mes suelto. */
export const pptoMes = (l: D.PptoLinea, mes: number) => l.meses[mes - 1] ?? 0;

/** Barrera: revienta si el presupuesto dejó de cumplir lo que el informe asume.
 *  Se corre antes de publicar, no en cada render. */
export function verificarPpto(anio: number): string[] {
  const problemas: string[] = [];
  for (const f of UNICAS) {
    const n = filasPorFormula(anio, f).length;
    if (n === 0) problemas.push(`No hay fila de presupuesto con fórmula "${f}" en ${anio}.`);
    if (n > 1) problemas.push(`La fórmula "${f}" tiene ${n} filas en ${anio}; el informe asume una sola.`);
  }
  const ebitda = filaPpto(anio, "ebitda", "EBITDA");
  if (!ebitda) problemas.push(`Falta la fila de presupuesto rotulada exactamente "EBITDA" en ${anio}.`);
  const primera = filasPorFormula(anio, "ebitda")[0];
  if (ebitda && primera && primera.orden !== ebitda.orden && primera.total === ebitda.total)
    problemas.push(`Las filas "${primera.etiqueta}" y "EBITDA" valen lo mismo: ya no se distinguen.`);
  return problemas;
}
