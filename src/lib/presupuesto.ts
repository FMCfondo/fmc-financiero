// Presupuesto anual COMPLETO como árbol expandible. Reconstruye la jerarquía de
// la hoja "PPTO 2026" (niveles de agrupación de Excel) a partir de las filas
// planas de la tabla `ppto`: nivel 0 = espina del P&L e ingresos, nivel 1 =
// rubros de gasto, nivel 2 = cuentas de detalle. Solo LECTURA — no calcula nada.
import "server-only";
import * as D from "./data";
import { ejecucion, type Semaforo } from "./ejecucion";
import { mesCorto, mesNombre } from "./format";

export type NodoPpto = {
  orden: number; nivel: number; etiqueta: string;
  tipo: "detalle" | "total"; clase: "ingreso" | "gasto" | "resultado";
  formula: string | null; nota: string | null; meses: number[]; total: number; hijos: NodoPpto[];
  // Alias para enchufar con el sistema de expandir compartido (statementShared).
  codigo: string; depth: number;
};

/** Convierte las filas planas (ordenadas, con `nivel`) en un árbol anidado:
 *  los hijos de una fila son las filas siguientes de mayor nivel, hasta que el
 *  nivel vuelve a bajar (misma semántica que la agrupación de Excel). */
export function presupuestoArbol(anio: number) {
  const filas = D.presupuesto.filter((l) => l.anio === anio).sort((a, b) => a.orden - b.orden);
  const roots: NodoPpto[] = [];
  const stack: NodoPpto[] = [];
  for (const f of filas) {
    const nodo: NodoPpto = {
      orden: f.orden, nivel: f.nivel, etiqueta: f.etiqueta, tipo: f.tipo, clase: f.clase,
      formula: f.formula, nota: f.nota, meses: f.meses, total: f.total, hijos: [],
      codigo: String(f.orden), depth: f.nivel,
    };
    while (stack.length && stack[stack.length - 1].nivel >= f.nivel) stack.pop();
    (stack.length ? stack[stack.length - 1].hijos : roots).push(nodo);
    stack.push(nodo);
  }
  // ¿Hay algún mes con cifra? (si el año se cargó solo con el total anual)
  const conMeses = filas.some((f) => f.meses.some((v) => v !== 0));
  const anualDe = (formula: string) => filas.find((f) => f.formula === formula)?.total ?? 0;
  // Curva mensual presupuestada de la utilidad neta (estacionalidad del plan).
  const utilFila = filas.find((f) => f.formula === "util_neta");
  return {
    anio, roots, hay: filas.length > 0, conMeses,
    labels: Array.from({ length: 12 }, (_, i) => mesCorto[i + 1]),
    resumen: {
      ingOperacion: anualDe("ing_operacion"), gastosAdmin: anualDe("gastos_admin"),
      ebitda: anualDe("ebitda"), utilNeta: anualDe("util_neta"),
    },
    utilMensual: (utilFila?.meses ?? []).map((v, i) => ({ mes: mesCorto[i + 1], valor: v })),
    conNotas: filas.filter((f) => f.nota).length,
    totalAnual: anualDe("util_neta"),
  };
}
export type Presupuesto = ReturnType<typeof presupuestoArbol>;

// ---------- Ejecución presupuestal como ÁRBOL (comparación por nodo) ----------
// Reutiliza el motor `ejecucion()` (ya validado) para el Real/Variación/% de cada
// línea, y arma la misma jerarquía del presupuesto para poder expandir/contraer.
export type NodoEjec = {
  orden: number; nivel: number; etiqueta: string;
  tipo: "detalle" | "total"; clase: "ingreso" | "gasto" | "resultado";
  formula: string | null; nota: string | null; codigo: string; depth: number;
  ppto: number; real: number | null; variacion: number | null; pctEjec: number | null;
  semaforo: Semaforo; hijos: NodoEjec[];
};

export function ejecucionArbol(anio: number, mesHasta: number, modo: "acum" | "mes") {
  const e = ejecucion(anio, mesHasta, modo);
  const by = new Map(e.filas.map((f) => [f.orden, f]));
  const filas = D.presupuesto.filter((l) => l.anio === anio).sort((a, b) => a.orden - b.orden);
  const roots: NodoEjec[] = [];
  const stack: NodoEjec[] = [];
  for (const f of filas) {
    const fe = by.get(f.orden);
    const nodo: NodoEjec = {
      orden: f.orden, nivel: f.nivel, etiqueta: f.etiqueta, tipo: f.tipo, clase: f.clase,
      formula: f.formula, nota: f.nota, codigo: String(f.orden), depth: f.nivel,
      ppto: fe?.ppto ?? 0, real: fe?.real ?? null, variacion: fe?.variacion ?? null,
      pctEjec: fe?.pctEjec ?? null, semaforo: fe?.semaforo ?? null, hijos: [],
    };
    while (stack.length && stack[stack.length - 1].nivel >= f.nivel) stack.pop();
    (stack.length ? stack[stack.length - 1].hijos : roots).push(nodo);
    stack.push(nodo);
  }

  // KPIs de ejecución: los totales estructurales (la última coincidencia = la definitiva).
  const totalDe = (formula: string) => { const fs = e.filas.filter((x) => x.formula === formula); return fs.length ? fs[fs.length - 1] : null; };
  const kpis = { ingOp: totalDe("ing_operacion"), gastosAdmin: totalDe("gastos_admin"), ebitda: totalDe("ebitda"), utilNeta: totalDe("util_neta") };

  // Rubros de detalle mapeados; base para "fuera de rango" y "top desviaciones".
  const vistos = new Set<string>();
  const detalles = e.filas
    .filter((f) => f.tipo === "detalle" && !f.formula && f.real !== null && f.clase !== "resultado")
    .filter((f) => (vistos.has(f.etiqueta) ? false : (vistos.add(f.etiqueta), true)));
  const fueraDeRango = detalles.filter((f) => f.pctEjec !== null && Math.abs(f.pctEjec - 100) > 15).length;
  const top = detalles
    .filter((f) => Math.abs(f.variacion ?? 0) >= 1_000_000)
    .sort((a, b) => Math.abs(b.variacion as number) - Math.abs(a.variacion as number))
    .slice(0, 5)
    .map((f) => ({ etiqueta: f.etiqueta, clase: f.clase, variacion: f.variacion as number, pctEjec: f.pctEjec, ppto: f.ppto, real: f.real as number }));

  // Proyección de cierre (solo acumulado): ritmo actual anualizado vs. plan anual.
  const anual = (formula: string) => { const ls = D.presupuesto.filter((l) => l.anio === anio && l.formula === formula); return ls.length ? ls[ls.length - 1].total : 0; };
  const proyeccion = modo === "acum" && e.hayReal && e.mesReal > 0
    ? ([["Ingresos de operación", "ing_operacion"], ["EBITDA", "ebitda"], ["Utilidad neta", "util_neta"]] as const)
        .map(([label, fx]) => {
          const realAcum = totalDe(fx)?.real ?? null;
          const planAnual = anual(fx);
          const proyectado = realAcum === null ? null : (realAcum / e.mesReal) * 12;
          return { label, proyectado, planAnual, pct: proyectado !== null && planAnual ? (proyectado / planAnual) * 100 : null };
        })
    : null;

  return {
    anio, roots, hay: filas.length > 0, hayReal: e.hayReal, etq: e.etq, mesReal: e.mesReal, modo,
    periodoLabel: e.mesReal ? `${modo === "acum" ? "acumulado a" : "mes de"} ${mesNombre[e.mesReal].toLowerCase()}` : "",
    kpis, fueraDeRango, top, proyeccion,
  };
}
export type Ejecucion = ReturnType<typeof ejecucionArbol>;
