/* Fase 0 del Informe de Junta: concilia lo que calcula la APP contra las cifras
 * certificadas del Excel (`cifras-control.json`, fuera del repo por traer cifras
 * reales). No calcula nada nuevo: llama a los mismos motores que alimentan los
 * Estados Financieros, para que un desvío aquí signifique un desvío de verdad.
 *
 * Sin archivo de control la ruta responde 404 — en producción queda inerte.
 * Uso:  curl "http://localhost:3000/api/conciliacion"
 *       CIFRAS_CONTROL=/otra/ruta.json  para apuntar a otro archivo.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { ensureLoaded, fact, ytd, presupuesto, periodos, type PptoLinea } from "@/lib/data";
import { esf, provisionRenta } from "@/lib/statements";
import { realFormula } from "@/lib/ejecucion";
import { portafolio } from "@/lib/inversiones";

export const dynamic = "force-dynamic";

const TOLERANCIA = 1; // un peso: por debajo es redondeo

/* El bolsillo digital Bold está contabilizado en 11 (efectivo) pero el informe
 * lo presenta dentro de las inversiones, integrado a FIDUCIA y sin etiqueta
 * propia (HANDOFF §7: "es marginal y va a desaparecer, pero sí entra en los
 * totales"). No cambia el activo total: solo mueve la línea. */
const CTA_BOLD = "1110050104";

/* Las cuentas 4210 (financieros) y 4295 (diversos) NO entran en la línea
 * "Ingresos de operación" del Excel, aunque sí en el EBITDA. Derivado al
 * conciliar — PENDIENTE de confirmación del usuario. */
const FUERA_DE_OPERACION = ["4210", "4295"];

const MESES = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
const aEtq = (p: string) => {
  const [a, m] = p.split("-").map(Number);
  return `${MESES[m - 1]}${a}`;
};

type Fila = {
  grupo: string; concepto: string;
  control: number; app: number; diff: number; ok: boolean;
  mapeo: string; derivado?: boolean;
};

/* Mapeo de cada línea del informe a su origen en la app. Es el contrato que la
 * fase 1 tendrá que respetar; las marcadas `derivado` se dedujeron conciliando
 * y están pendientes de confirmación con el usuario. */
function filasBalance(etq: string, c: Record<string, number>): Fila[] {
  const e = esf(etq);
  const prov = provisionRenta(etq).provision;
  const def: [string, number, number, string, boolean?][] = [
    ["activo_total", c.activo_total, e.totalActivo, "esf().totalActivo"],
    ["pasivo_total", c.pasivo_total, e.totalPasivo, "esf().totalPasivo (pasivo + provisión de renta)"],
    ["patrimonio_total", c.patrimonio_total, e.totalPatrim, "esf().totalPatrim (patrimonio + utilidad neta)"],
    ["disponible", c.disponible, fact(etq, "11") - fact(etq, CTA_BOLD), "cuenta 11 − Bold", true],
    ["inversiones_liquidas", c.inversiones_liquidas, fact(etq, "12") + fact(etq, CTA_BOLD), "cuenta 12 + Bold", true],
    ["clientes", c.clientes, fact(etq, "1345") + fact(etq, "1380"), "1345 + 1380 (13 sin anticipos de impuestos)", true],
    ["pasivos_estimados", c.pasivos_estimados, fact(etq, "26") + prov - fact(etq, "2610"), "26 + provisión de renta − 2610", true],
    ["utilidad_neta_balance", c.utilidad_neta_balance, e.neto, "esf().neto"],
  ];
  return def.map(([concepto, control, app, mapeo, derivado]) => ({
    grupo: "balance", concepto, control, app,
    diff: app - control, ok: Math.abs(app - control) <= TOLERANCIA, mapeo, derivado,
  }));
}

function filasResultados(etq: string, c: Record<string, number>, modo: "mes" | "acum"): Fila[] {
  const grupo = modo === "mes" ? "resultados_mes" : "resultados_acumulado";
  const def: [string, string][] = [
    ["ingresos_operacion", "ing_operacion"],
    ["gastos_admin", "gastos_admin"],
    ["ebitda", "ebitda"],
    ["utilidad_neta", "util_neta"],
  ];
  const filas: Fila[] = def
    .filter(([k]) => c[k] !== undefined)
    .map(([concepto, formula]) => {
      const v = (x: string) => (modo === "acum" ? ytd(etq, x) : fact(etq, x));
      const fuera = formula === "ing_operacion"
        ? FUERA_DE_OPERACION.reduce((s2, x) => s2 + v(x), 0) : 0;
      const app = realFormula(formula, etq, modo) - fuera;
      return { grupo, concepto, control: c[concepto], app, diff: app - c[concepto],
        ok: Math.abs(app - c[concepto]) <= TOLERANCIA,
        mapeo: `realFormula("${formula}", "${modo}")` + (fuera ? ` − ${FUERA_DE_OPERACION.join(" − ")}` : ""),
        derivado: formula === "ing_operacion" || undefined };
    });
  if (c.impuesto_renta !== undefined) {
    const app = provisionRenta(etq).provision;
    filas.push({ grupo, concepto: "impuesto_renta", control: c.impuesto_renta, app,
      diff: app - c.impuesto_renta, ok: Math.abs(app - c.impuesto_renta) <= TOLERANCIA,
      mapeo: "provisionRenta().provision" });
  }
  return filas;
}

function filasPresupuesto(anio: number, mes: number, c: Record<string, number>, alcance: "acumulado" | "anual"): Fila[] {
  const lineas = presupuesto.filter((l: PptoLinea) => l.anio === anio);
  /* OJO: el presupuesto trae TRES filas con formula "ebitda" (SUBTOTAL EBITDA,
   * EBITDA ANTES DE DIFERENCIA EN CAMBIO, y EBITDA) con valores distintos. La
   * del informe es la última, rotulada "EBITDA" a secas. Elegir por fórmula sin
   * más devuelve la primera y descuadra en 2,3 M anuales. */
  const def: [string, string, string?][] = [
    ["ingresos_operacion", "ing_operacion"],
    ["gastos_admin", "gastos_admin"],
    ["ebitda", "ebitda", "EBITDA"],
    ["utilidad_neta", "util_neta"],
  ];
  return def.filter(([k]) => c[k] !== undefined).map(([concepto, formula, etiqueta]) => {
    const cand = lineas.filter((x) => x.formula === formula);
    const l = etiqueta ? cand.find((x) => x.etiqueta.trim().toUpperCase() === etiqueta) : cand[0];
    const app = !l ? NaN
      : alcance === "anual" ? l.total
      : l.meses.slice(0, mes).reduce((s, x) => s + x, 0);
    return { grupo: `presupuesto_${alcance}`, concepto, control: c[concepto], app,
      diff: app - c[concepto], ok: Math.abs(app - c[concepto]) <= TOLERANCIA,
      mapeo: !l ? `SIN LÍNEA ppto con formula="${formula}"`
        : alcance === "anual" ? `ppto.total (${l.etiqueta})` : `Σ ppto.meses[0..${mes - 1}] (${l.etiqueta})` };
  });
}

function filasPortafolio(etq: string, c: Record<string, number>): Fila[] {
  const p = portafolio(etq);
  const filas: Fila[] = [];
  if (c.total !== undefined)
    filas.push({ grupo: "portafolio", concepto: "total", control: c.total, app: p.total,
      diff: p.total - c.total, ok: Math.abs(p.total - c.total) <= TOLERANCIA, mapeo: "portafolio().total" });
  if (c.posiciones !== undefined) {
    // El informe no le da fila propia a Bold: se integra a FIDUCIA (HANDOFF §7).
    const app = p.posiciones.filter((x) => !x.cuentas.includes(CTA_BOLD)).length;
    filas.push({ grupo: "portafolio", concepto: "posiciones", control: c.posiciones, app,
      diff: app - c.posiciones, ok: app === c.posiciones,
      mapeo: "portafolio().posiciones sin la fila de Bold", derivado: true });
  }
  return filas;
}

export async function GET() {
  const ruta = process.env.CIFRAS_CONTROL ?? join(process.cwd(), "db", "cifras-control.json");
  if (!existsSync(ruta))
    return NextResponse.json(
      { error: "Sin archivo de cifras de control", ruta,
        ayuda: "Copia cifras-control.json a db/ (está en .gitignore: trae cifras reales)" },
      { status: 404 });

  await ensureLoaded();
  const control = JSON.parse(readFileSync(ruta, "utf8"));
  const cargados = new Set(periodos.map((p) => p.etiqueta));

  const resultado = control.periodos.map((p: Record<string, Record<string, number>> & { periodo: string }) => {
    const etq = aEtq(p.periodo);
    if (!cargados.has(etq))
      return { periodo: p.periodo, etq, error: "período NO cargado en Neon", filas: [] };
    const [anio, mes] = p.periodo.split("-").map(Number);
    const filas: Fila[] = [
      ...filasBalance(etq, p.balance ?? {}),
      ...filasResultados(etq, p.resultados_mes ?? {}, "mes"),
      ...filasResultados(etq, p.resultados_acumulado ?? {}, "acum"),
      ...filasPresupuesto(anio, mes, p.presupuesto_acumulado ?? {}, "acumulado"),
      ...filasPresupuesto(anio, mes, p.presupuesto_anual ?? {}, "anual"),
      ...filasPortafolio(etq, p.portafolio ?? {}),
    ];
    return { periodo: p.periodo, etq, filas,
      ok: filas.filter((f) => f.ok).length, fallan: filas.filter((f) => !f.ok).length };
  });

  const todas = resultado.flatMap((r: { filas: Fila[] }) => r.filas);
  return NextResponse.json({
    tolerancia: TOLERANCIA,
    resumen: { comparadas: todas.length, ok: todas.filter((f: Fila) => f.ok).length,
      fallan: todas.filter((f: Fila) => !f.ok).length },
    periodos: resultado,
  });
}
