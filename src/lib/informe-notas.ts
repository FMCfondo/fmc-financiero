// =============================================================================
// redactor-notas.ts — Redacción determinística de las notas del informe.
// -----------------------------------------------------------------------------
// SIN IA. Reproduce en TypeScript las plantillas con que hoy se escriben las
// notas del informe de Junta. Cubre ~85 % del texto publicado; el 15 % restante
// es la CAUSA de una variación atípica, que ninguna fórmula puede deducir y que
// escribe una persona (campo `causa`).
//
// Cómo se leyó el 85 %: se tomó una nota publicada y se separó en partes.
//   "Al cierre de {mes}, el Activo Total alcanzó ${X} millones, creciendo un
//    {Y} % frente al mismo mes del año anterior (+${Z} millones)."   → plantilla
//   "…tras recibirse el pago de la facturación pendiente de las mutuales."
//                                                                   → causa humana
//
// REGLAS QUE NO SE NEGOCIAN
//   · Toda cifra sale de los datos; nunca se escribe un número a mano.
//   · Nunca se afirma una causa que no venga de `causa` (o de la nota del mes
//     anterior). Si falta y la variación es material → requiereExplicacion.
//   · Español de Colombia: 1.234.567,89 · montos grandes en millones.
// =============================================================================

import type { Nota } from "./informe-tipos";

// ---------------------------------------------------------------- formato ---

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ORDINAL = ["primer", "segundo", "tercer", "cuarto", "quinto", "sexto",
                 "séptimo", "octavo", "noveno", "décimo", "undécimo", "duodécimo"];

/** Estilo de la casa: miles con punto y sin decimales por encima de mil
 *  millones; un decimal por debajo. Repo público: aquí no van cifras de ejemplo. */
export function money(v: number): string {
  const m = v / 1e6;
  const abs = Math.abs(m);
  const txt = abs >= 1000
    ? abs.toLocaleString("es-CO", { maximumFractionDigits: 0 })
    : abs.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${m < 0 ? "−" : ""}$${txt} millones`;
}

export function pct(v: number | null, dec = 0): string {
  if (v === null || v === undefined) return "—";
  return `${Math.abs(v).toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;
}

const signo = (v: number) => (v >= 0 ? "+" : "−");
const creceCae = (v: number) => (v >= 0 ? "creciendo" : "disminuyendo");
const subeBaja = (v: number) => (v >= 0 ? "el incremento" : "la disminución");

// ------------------------------------------------------------- estructura ---

export type DatosNotas = {
  mes: number;                    // 1..12
  anio: number;
  balance: Record<string, { actual: number; anterior: number; interanual: number;
                            varMesPesos: number; varIAPesos: number; varIAPct: number | null }>;
  resultados: Record<string, { mes: number; acumulado: number;
                               pptoAcumulado: number | null; pptoAnual: number | null;
                               cumplAcumPct: number | null; ejecAnualPct: number | null }>;
  indicadores: { pctRespaldoSobreActivo: number; pctReservasSobrePasivo: number };
  /** Causas escritas por el analista, por clave de partida. */
  causas?: Record<string, string>;
  /** Partidas que el detector de anomalías marcó y siguen sin causa. */
  pendientes?: string[];
};

const necesitaCausa = (d: DatosNotas, clave: string) =>
  (d.pendientes ?? []).includes(clave) && !(d.causas ?? {})[clave];

const conCausa = (d: DatosNotas, clave: string, base: string) => {
  const c = (d.causas ?? {})[clave];
  return c ? `${base.replace(/\.$/, "")}, ${c.replace(/^,\s*/, "")}` : base;
};

// ----------------------------------------------------------------- notas ---

/** Página 2 — Activos. */
export function notasActivos(d: DatosNotas): Nota[] {
  const b = d.balance;
  const mes = MESES[d.mes - 1];
  const mesAnt = MESES[(d.mes + 10) % 12];
  const act = b.activoTotal;
  const out: Nota[] = [];

  out.push({
    bloque: "activos",
    texto: `Al cierre de ${mes}, el Activo Total alcanzó ${money(act.actual)}, ` +
      `${creceCae(act.varIAPesos)} un ${pct(act.varIAPct)} frente al mismo mes del año anterior ` +
      `(${signo(act.varIAPesos)}${money(Math.abs(act.varIAPesos)).slice(1)}). ` +
      `Respecto a ${mesAnt} (${money(act.anterior)}), ${subeBaja(act.varMesPesos)} fue de ` +
      `${money(Math.abs(act.varMesPesos))}.`,
  });

  out.push({
    bloque: "activos",
    texto: `Las Inversiones Líquidas cerraron en ${money(b.inversionesLiquidas.actual)} y el ` +
      `Disponible en ${money(b.disponible.actual)}. En conjunto, el Total Disponible e Inversiones ` +
      `se ubicó en ${money(b.totalDisponibleInversiones.actual)}, representando el ` +
      `${pct(d.indicadores.pctRespaldoSobreActivo, 1)} del activo total, nivel que garantiza la ` +
      `cobertura integral de las reservas técnicas.`,
  });

  const cli = b.clientes;
  const verbo = cli.varMesPesos >= 0 ? "se incrementó a" : "se redujo a";
  out.push({
    bloque: "activos",
    codigoPuc: "13",
    texto: conCausa(d, "clientes",
      `En las partidas operativas, la cartera de Clientes ${verbo} ${money(cli.actual)} ` +
      `(desde ${money(cli.anterior)} en ${mesAnt}).`) +
      ` Los Anticipos de Impuestos presentan saldo de ${money(b.anticipoImpuestos.actual)}.`,
    causa: (d.causas ?? {}).clientes,
    requiereExplicacion: necesitaCausa(d, "clientes"),
  });

  out.push({
    bloque: "activos",
    texto: `Los Activos Fijos Netos se sitúan en ${money(b.ppeNeto.actual)} y el Activo Diferido ` +
      `en ${money(b.activosDiferidos.actual)}.`,
  });

  return out;
}

/** Página 3 — Pasivos y patrimonio. */
export function notasPasivos(d: DatosNotas): Nota[] {
  const b = d.balance;
  const mes = MESES[d.mes - 1];
  const mesAnt = MESES[(d.mes + 10) % 12];
  const pas = b.pasivoTotal;

  return [
    {
      bloque: "pasivos",
      texto: `Al cierre de ${mes}, el Pasivo Total ascendió a ${money(pas.actual)}, registrando ` +
        `${pas.varIAPesos >= 0 ? "un incremento" : "una disminución"} del ${pct(pas.varIAPct)} frente ` +
        `al mismo periodo del año anterior (${signo(pas.varIAPesos)}${money(Math.abs(pas.varIAPesos)).slice(1)}). ` +
        `Respecto a ${mesAnt} (${money(pas.anterior)}), la variación fue de ${money(Math.abs(pas.varMesPesos))}.`,
    },
    {
      bloque: "pasivos",
      texto: `Los Pasivos Estimados y Provisiones representan el ` +
        `${pct(d.indicadores.pctReservasSobrePasivo, 1)} del pasivo total con ` +
        `${money(b.pasivosEstimados.actual)}, sustentados en las reservas técnicas individuales ` +
        `de cobertura para las mutuales vinculadas.`,
    },
    {
      bloque: "pasivos",
      codigoPuc: "24",
      texto: conCausa(d, "impuestosPorPagar",
        `En el mes, los Impuestos por Pagar ${b.impuestosPorPagar.varMesPesos >= 0 ? "se incrementaron a" : "se redujeron a"} ` +
        `${money(b.impuestosPorPagar.actual)}.`),
      causa: (d.causas ?? {}).impuestosPorPagar,
      requiereExplicacion: necesitaCausa(d, "impuestosPorPagar"),
    },
    {
      bloque: "pasivos",
      texto: `El Patrimonio cerró en ${money(b.patrimonioTotal.actual)}, con ` +
        `${b.patrimonioTotal.varIAPesos >= 0 ? "un crecimiento" : "una disminución"} del ` +
        `${pct(b.patrimonioTotal.varIAPct)} frente al mismo periodo del año anterior. Este resultado ` +
        `se sustenta en el capital social y las utilidades del ejercicio actual, que al corte del mes ` +
        `suman ${money(b.utilidadNetaBalance.actual)}.`,
    },
  ];
}

/** Página 4 — Estado de resultados. */
export function notasResultados(d: DatosNotas): Nota[] {
  const r = d.resultados;
  const mes = MESES[d.mes - 1];
  const ing = r.ingresosOperacion, gas = r.gastosAdmin, un = r.utilidadNeta;

  return [
    {
      bloque: "resultados",
      texto: `Durante ${mes}, los ingresos de operación se situaron en ${money(ing.mes)}. ` +
        `El acumulado anual alcanza ${money(ing.acumulado)}, representando un cumplimiento del ` +
        `${pct(ing.cumplAcumPct)} frente a la meta acumulada a ${mes} de ${money(ing.pptoAcumulado ?? 0)}.`,
    },
    {
      bloque: "resultados",
      codigoPuc: "51",
      texto: conCausa(d, "gastosAdmin",
        `Los gastos de administración del mes cerraron en ${money(gas.mes)}.`) +
        ` En el acumulado, los gastos suman ${money(gas.acumulado)}, equivalente al ` +
        `${pct(gas.cumplAcumPct)} respecto a la meta presupuestada acumulada de ${money(gas.pptoAcumulado ?? 0)}.`,
      causa: (d.causas ?? {}).gastosAdmin,
      requiereExplicacion: necesitaCausa(d, "gastosAdmin"),
    },
    {
      bloque: "resultados",
      texto: `La Utilidad Neta acumulada cerró en ${money(un.acumulado)}, alcanzando un cumplimiento ` +
        `del ${pct(un.cumplAcumPct)} frente a la meta acumulada al mes de ${money(un.pptoAcumulado ?? 0)}.`,
    },
  ];
}

/** Página 1 — Situación del período (cierra el resumen ejecutivo). */
export function notasSituacion(d: DatosNotas): Nota[] {
  const r = d.resultados;
  const mes = MESES[d.mes - 1];
  const eb = r.ebitda, un = r.utilidadNeta, ing = r.ingresosOperacion, gas = r.gastosAdmin;

  return [
    {
      bloque: "situacion",
      texto: `Al cierre del ${ORDINAL[d.mes - 1]} mes del ejercicio ${d.anio}, el EBITDA acumulado ` +
        `se sitúa en ${money(eb.acumulado)}, representando una ejecución del ${pct(eb.ejecAnualPct, 2)} ` +
        `de la meta anual de ${money(eb.pptoAnual ?? 0)}. A nivel mensual, el EBITDA fue de ${money(eb.mes)}.`,
    },
    {
      bloque: "situacion",
      texto: `La Utilidad Neta acumulada cerró en ${money(un.acumulado)}, alcanzando un cumplimiento ` +
        `del ${pct(un.ejecAnualPct, 2)} frente a la meta anual de ${money(un.pptoAnual ?? 0)}.`,
    },
    {
      bloque: "situacion",
      texto: `Los ingresos de operación acumulados suman ${money(ing.acumulado)} ` +
        `(${pct(ing.ejecAnualPct, 2)} vs meta anual de ${money(ing.pptoAnual ?? 0)}), mientras los ` +
        `Gastos Administrativos acumulados cierran en ${money(gas.acumulado)}, con una ejecución del ` +
        `${pct(gas.ejecAnualPct, 2)}.`,
    },
  ];
}

/** Ensambla todas las notas del informe. */
export function redactarNotas(d: DatosNotas) {
  return {
    situacion: notasSituacion(d),
    activos: notasActivos(d),
    pasivos: notasPasivos(d),
    resultados: notasResultados(d),
  };
}

/** Barrera de calidad: con alguna nota pendiente, el PDF no se genera. */
export function puedeExportar(notas: Nota[]): { ok: boolean; pendientes: string[] } {
  const p = notas.filter((n) => n.requiereExplicacion).map((n) => n.codigoPuc ?? n.bloque);
  return { ok: p.length === 0, pendientes: p };
}
