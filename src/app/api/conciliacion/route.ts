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
import * as C from "@/lib/informe-cuentas";
import { portafolio } from "@/lib/inversiones";

export const dynamic = "force-dynamic";

const TOLERANCIA = 1; // un peso: por debajo es redondeo

/* El informe certificado imprime las cifras del balance redondeadas a pesos
 * enteros, y sus subtotales son sumas de valores ya redondeados. Un peso no
 * alcanza: se compara contra el entero impreso con margen de la propia suma. */
const TOLERANCIA_INFORME = 2;

/* Las composiciones de linea viven en informe-cuentas.ts: un solo sitio para
 * toda la app. Aqui solo se comparan contra el Excel certificado. */

const MESES = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
const aEtq = (p: string) => {
  const [a, m] = p.split("-").map(Number);
  return `${MESES[m - 1]}${a}`;
};

type Fila = {
  grupo: string; concepto: string;
  control: number; app: number; diff: number; ok: boolean;
  mapeo: string; derivado?: boolean; excepcion?: boolean;
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
    ["disponible", c.disponible, C.disponible(etq), "cuenta 11 − Bold", true],
    ["inversiones_liquidas", c.inversiones_liquidas, C.inversionesLiquidas(etq), "cuenta 12 + Bold", true],
    ["clientes", c.clientes, C.clientes(etq), "1345 + 138005", true],
    ["pasivos_estimados", c.pasivos_estimados, C.pasivosEstimados(etq), "26 + provisión de renta − 2610 − 2615", true],
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
      const esIngOp = formula === "ing_operacion";
      const app = esIngOp ? C.ingOperacion(etq, modo) : realFormula(formula, etq, modo);
      return { grupo, concepto, control: c[concepto], app, diff: app - c[concepto],
        ok: Math.abs(app - c[concepto]) <= TOLERANCIA,
        mapeo: esIngOp ? `informe-cuentas.ingOperacion("${modo}")` : `realFormula("${formula}", "${modo}")`,
        derivado: esIngOp || undefined };
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
    /* El informe imprime UNA FILA POR POSICIÓN CON SALDO. Bold SÍ lleva fila —
     * lo que hace el informe es rotularla como FIDUCIA, no ocultarla. Excluirla
     * daba el número correcto en julio sólo porque otra posición (Mi Banco,
     * abierta en agosto) estaba en cero: dos errores que se cancelaban. */
    const app = p.posiciones.filter((x) => x.monto !== 0).length;
    filas.push({ grupo: "portafolio", concepto: "posiciones", control: c.posiciones, app,
      diff: app - c.posiciones, ok: app === c.posiciones,
      mapeo: "portafolio().posiciones con saldo distinto de cero", derivado: true });
  }
  return filas;
}

/* Páginas 2 y 3 del informe: 30 líneas × 5 meses contra el informe certificado.
 * Es lo que cubre el hueco real — la conciliación por período solo miraba tres
 * partidas del balance en dos meses, y ahí vivían los bugs que aparecieron. */
function filasInformeBalance(ib: {
  meses: string[];
  activos: { etiqueta: string; valores: (number | null)[] }[];
  pasivos: { etiqueta: string; valores: (number | null)[] }[];
  excepciones?: { mes: string; concepto: string; difEsperada: number }[];
}, cargados: Set<string>) {
  /* Divergencias conocidas y explicadas: no son fallos, pero tampoco pasan por
   * verdes. Se comprueba que la diferencia siga siendo la registrada; si cambia,
   * vuelve a fallar. */
  const excepcion = (mes: string, concepto: string) =>
    (ib.excepciones ?? []).find((x) => x.mes === mes && x.concepto === concepto);
  const secciones: [string, C.LineaBalance[], typeof ib.activos][] = [
    ["activos", C.LINEAS_ACTIVO, ib.activos],
    ["pasivos", C.LINEAS_PASIVO, ib.pasivos],
  ];
  const filas: (Fila & { mes: string })[] = [];
  const sinContrato: string[] = [];

  for (const [grupo, contrato, certificado] of secciones) {
    for (const cert of certificado) {
      const linea = contrato.find((l) => l.etiqueta === cert.etiqueta);
      if (!linea) { sinContrato.push(`${grupo}: ${cert.etiqueta}`); continue; }
      ib.meses.forEach((mes, i) => {
        const control = cert.valores[i];
        if (control === null || control === undefined) return;  // el informe imprime "—"
        if (!cargados.has(mes)) return;
        const app = linea.valor(mes);
        const diff = app - control;
        const exc = excepcion(mes, cert.etiqueta);
        filas.push({ grupo: `informe_${grupo}`, concepto: cert.etiqueta, mes,
          control, app, diff,
          ok: exc ? Math.abs(diff - exc.difEsperada) <= TOLERANCIA_INFORME
                  : Math.abs(diff) <= TOLERANCIA_INFORME,
          excepcion: exc ? true : undefined,
          mapeo: `LINEAS_${grupo === "activos" ? "ACTIVO" : "PASIVO"}[${cert.etiqueta}]` });
      });
    }
  }
  return { filas, sinContrato };
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
  const bal = control.informe_balance
    ? filasInformeBalance(control.informe_balance, cargados)
    : { filas: [], sinContrato: [] };

  const cuenta = (fs: { ok: boolean }[]) => ({
    comparadas: fs.length, ok: fs.filter((f) => f.ok).length, fallan: fs.filter((f) => !f.ok).length });

  return NextResponse.json({
    tolerancia: TOLERANCIA,
    toleranciaInforme: TOLERANCIA_INFORME,
    resumen: { ...cuenta([...todas, ...bal.filas]),
      porPeriodo: cuenta(todas), balanceDelInforme: cuenta(bal.filas),
      divergenciasDocumentadas: bal.filas.filter((f) => f.excepcion).length },
    periodos: resultado,
    informeBalance: { sinContrato: bal.sinContrato, filas: bal.filas },
  });
}
