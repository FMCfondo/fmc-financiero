// Ejecución presupuestal: compara el Presupuesto 2026 (tabla `ppto`, cargado tal
// cual del Excel) contra el ER real. Cada línea trae su valor presupuestado y,
// si está mapeada a cuentas PUC o a una fórmula del ER, su valor real, la
// variación y el % de ejecución. Server-only (usa la capa de datos).
import "server-only";
import * as D from "./data";
import { provisionRenta, impuestoMes } from "./statements";

export type Semaforo = "bueno" | "malo" | "neutro" | null;
export type FilaEjec = {
  orden: number; etiqueta: string; tipo: "detalle" | "total";
  clase: "ingreso" | "gasto" | "resultado"; nota: string | null; mapeado: boolean;
  ppto: number; real: number | null; variacion: number | null; pctEjec: number | null;
  semaforo: Semaforo;
  formula: string | null; // clave del total estructural (ebitda, util_neta…) — la usa el Cockpit
};

// Totales estructurales del ER real (los detalles se leen por cuenta PUC).
// Exportada para el Cockpit (solo lectura, misma fuente única).
export function realFormula(f: string, etq: string, modo: "acum" | "mes"): number {
  const v = (c: string) => (modo === "acum" ? D.ytd(etq, c) : D.fact(etq, c));
  const dep = v("5160"), amort = v("5165");
  switch (f) {
    case "ing_operacion": return v("4") - v("5199150101"); // ingresos − costo de cobertura
    case "gastos_admin": return v("51") - v("5199") - dep - amort; // admin sin costo cobertura ni dep/amort
    case "ebitda": return v("4") - (v("5") - dep - amort);
    case "uai": return v("4") - v("5");
    case "impuesto": return modo === "acum" ? provisionRenta(etq).provision : impuestoMes(etq);
    case "util_neta": {
      const imp = modo === "acum" ? provisionRenta(etq).provision : impuestoMes(etq);
      return v("4") - v("5") - imp;
    }
    default: return 0;
  }
}

export function ejecucion(anio: number, mesHasta: number, modo: "acum" | "mes") {
  const lineas = D.presupuesto.filter((l) => l.anio === anio);
  // Período real: el último mes del año con datos que no pase el mes pedido.
  const disponibles = D.periodos.filter((p) => p.anio === anio && p.mes <= mesHasta);
  const etq = disponibles.length ? disponibles[disponibles.length - 1].etiqueta : null;
  const mesReal = disponibles.length ? disponibles[disponibles.length - 1].mes : 0;
  const idx = (modo === "acum" ? mesReal : mesHasta) - 1;

  const pptoDe = (l: D.PptoLinea): number =>
    modo === "acum" ? l.meses.slice(0, mesReal).reduce((s, x) => s + x, 0) : (l.meses[idx] ?? 0);
  const realDe = (l: D.PptoLinea): number | null => {
    if (!etq) return null;
    if (l.formula) return realFormula(l.formula, etq, modo);
    if (l.cuentas.length) return l.cuentas.reduce((s, c) => s + (modo === "acum" ? D.ytd(etq, c) : D.fact(etq, c)), 0);
    return null;
  };

  const filas: FilaEjec[] = lineas.map((l) => {
    const ppto = pptoDe(l);
    const real = realDe(l);
    const variacion = real === null ? null : real - ppto;
    const pctEjec = real === null || ppto <= 0 ? null : (real / ppto) * 100;
    let semaforo: Semaforo = null;
    if (real !== null && (ppto !== 0 || real !== 0)) {
      const dif = real - ppto;
      const favorable = l.clase === "gasto" ? dif <= 0 : dif >= 0;
      const tol = Math.abs(ppto) * 0.05;
      semaforo = favorable ? "bueno" : Math.abs(dif) <= tol ? "neutro" : "malo";
    }
    return {
      orden: l.orden, etiqueta: l.etiqueta, tipo: l.tipo, clase: l.clase, nota: l.nota,
      mapeado: real !== null, ppto, real, variacion, pctEjec, semaforo,
      formula: l.formula,
    };
  });

  return { filas, etq, mesReal, hayReal: etq !== null };
}
