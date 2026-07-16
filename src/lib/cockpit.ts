// Executive Financial Cockpit — contrato ÚNICO del informe para la Junta.
// `construirInforme()` devuelve un objeto estructurado con TODA la narrativa
// (resumen ejecutivo, signos vitales, qué cambió, presupuesto, evolución,
// portafolio, aspectos de atención). La página /cockpit lo RENDERIZA; el futuro
// informe PDF renderizará EXACTAMENTE el mismo objeto. La narrativa es un dato.
//
// Solo LECTURA sobre los motores validados (statements, ejecucion, inversiones):
// aquí no se calcula nada contable nuevo — se comparan y se redactan cifras que
// ya produce el motor. Cada frase del resumen nace de una regla con umbral
// explícito (R1..R5); si no hay datos suficientes, la frase no aparece.
import "server-only";
import * as D from "./data";
import { provisionRenta, impuestoMes, serieResultados } from "./statements";
import { ejecucion, realFormula } from "./ejecucion";
import { portafolio } from "./inversiones";
import { fmtPct, mesCorto, mesNombre } from "./format";

export type Base = "ppto" | "mes" | "anio";
export type Modo = "acum" | "mes";
export type Tono = "pos" | "neg" | "neutro";

export type Frase = { texto: string; tono: Tono; regla: string };
export type Kpi = {
  id: string; label: string;
  valor: number; unidad: "cop" | "pct";
  delta: number | null; deltaUnidad: "pct" | "pts"; deltaLabel: string;
  dir: Tono;               // lectura del delta (direccional; "neutro" = informativo)
  sub?: string;            // contexto corto bajo la cifra
  serie: number[] | null;  // 12 meses para la micro-tendencia
  ancla?: boolean;         // el KPI de la misión (cobertura)
};
export type Metrica = { label: string; valor: number; delta: number | null; subeEsBueno: boolean; bueno: boolean };
export type Variacion = { nombre: string; clase: "ingreso" | "gasto"; actual: number; ref: number; delta: number; impacto: number };
export type FilaTermo = { etiqueta: string; real: number; ppto: number; pct: number | null; semaforo: "bueno" | "malo" | "neutro" | null };
// Hallazgo = observación del período basada en datos (no una alerta permanente).
export type Hallazgo = { texto: string; tono: Tono; href?: string };

const BASE_LABEL: Record<Base, string> = {
  ppto: "lo presupuestado",
  mes: "el mes anterior",
  anio: "el mismo período del año anterior",
};
// Variantes gramaticales de la referencia ("por encima DE LO presupuestado",
// "N,N veces LO presupuestado") — módulo, las usan R1 y los hallazgos.
const BASE_DE: Record<Base, string> = { ppto: "de lo presupuestado", mes: "del mes anterior", anio: "del mismo período del año anterior" };
const BASE_VECES: Record<Base, string> = { ppto: "lo presupuestado", mes: "la del mes anterior", anio: "la del mismo período del año anterior" };
// Rótulos ejecutivos fijos del termómetro (la hoja trae "Provisión Renta", "SUBTOTAL EBITDA"…).
const LABEL_TERMO: Record<string, string> = {
  ing_operacion: "Ingresos de operación",
  gastos_admin: "Gastos de administración",
  ebitda: "EBITDA",
  impuesto: "Impuesto de renta",
  util_neta: "Utilidad neta",
};
/** Decimal con coma (es-CO): 91,2 — los toFixed dejan punto. */
const f1 = (n: number, dec = 1) => n.toFixed(dec).replace(".", ",");

// ---------- helpers de lectura ----------
const val = (etq: string, cod: string, modo: Modo) => (modo === "acum" ? D.ytd(etq, cod) : D.fact(etq, cod));
const utilNetaTramo = (etq: string, modo: Modo) =>
  modo === "acum" ? provisionRenta(etq).neto : D.fact(etq, "4") - D.fact(etq, "5") - impuestoMes(etq);
const razonCobertura = (etq: string) => {
  const o = D.fact(etq, "2640");
  return o ? (D.fact(etq, "11") + D.fact(etq, "12")) / o : 0;
};
const pctVar = (cur: number, prev: number | null | undefined): number | null =>
  prev === null || prev === undefined || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;

/** Línea del presupuesto que corresponde a una fórmula/cuenta (la última coincidencia,
 *  porque la hoja repite algunos rótulos padre/hijo con la misma cifra). */
function lineaPpto(anio: number, pred: (l: D.PptoLinea) => boolean): D.PptoLinea | null {
  const ls = D.presupuesto.filter((l) => l.anio === anio && pred(l));
  return ls.length ? ls[ls.length - 1] : null;
}
const tramoPpto = (l: D.PptoLinea | null, mesReal: number, modo: Modo): number | null =>
  l ? (modo === "acum" ? l.meses.slice(0, mesReal).reduce((s, x) => s + x, 0) : (l.meses[mesReal - 1] ?? 0)) : null;

// ---------- el informe ----------
export function construirInforme(etq: string, modo: Modo, baseIn: Base) {
  const per = D.periodo(etq);
  const anio = per.anio, mes = per.mes;
  const hayPpto = D.presupuesto.some((l) => l.anio === anio);
  const prevM = D.prevPeriodo(etq);
  const prevA = D.sameMonthPrevYear(etq);
  // Si piden comparar contra un plan que no existe, caemos al año anterior.
  const base: Base = baseIn === "ppto" && !hayPpto ? (prevA ? "anio" : "mes") : baseIn;

  const e = hayPpto ? ejecucion(anio, mes, modo) : null;
  const tramoLabel = modo === "acum" ? `acumulada a ${mesNombre[mes].toLowerCase()}` : `de ${mesNombre[mes].toLowerCase()}`;
  // "lo presupuestado hasta junio" / "para junio" — reemplaza la jerga "tramo" en la UI.
  const planLabel = `lo presupuestado ${modo === "acum" ? "hasta" : "para"} ${mesNombre[mes].toLowerCase()}`;

  // ----- cifras del tramo (real) -----
  const utilReal = utilNetaTramo(etq, modo);
  const ebitdaReal = realFormula("ebitda", etq, modo);
  const ingReal = val(etq, "4", modo);
  const gasAdmReal = realFormula("gastos_admin", etq, modo);

  // ----- referencia según la base elegida -----
  // Flujo (utilidad, EBITDA, ingresos): vs ppto = mismo tramo del plan;
  // vs mes = el MES contra el mes anterior; vs año = mismo tramo del año anterior.
  const refFlujo = (fReal: (q: string, m: Modo) => number, fPpto: () => number | null): { delta: number | null; label: string } => {
    if (base === "ppto") {
      const p = fPpto();
      return { delta: p === null ? null : pctVar(fReal(etq, modo), p), label: "vs. presupuesto" };
    }
    if (base === "mes")
      return { delta: prevM ? pctVar(fReal(etq, "mes"), fReal(prevM.etiqueta, "mes")) : null, label: "mes vs. mes anterior" };
    return { delta: prevA ? pctVar(fReal(etq, modo), fReal(prevA.etiqueta, modo)) : null, label: "vs. año anterior" };
  };
  // Saldos (reservas, liquidez, patrimonio): el plan no presupuesta saldos →
  // con base ppto se comparan contra el año anterior (etiqueta explícita).
  const refSaldo = (f: (q: string) => number): { delta: number | null; label: string } => {
    if (base === "mes") return { delta: prevM ? pctVar(f(etq), f(prevM.etiqueta)) : null, label: "vs. mes anterior" };
    return { delta: prevA ? pctVar(f(etq), f(prevA.etiqueta)) : null, label: "vs. año anterior" };
  };

  // ----- KPIs (negocio primero) -----
  const doce = D.ultimosPeriodos(etq, 12);
  const s12 = (f: (q: string) => number) => doce.map((q) => f(q.etiqueta));
  const cob = razonCobertura(etq);
  const cobPrev = base === "mes" ? (prevM ? razonCobertura(prevM.etiqueta) : null) : (prevA ? razonCobertura(prevA.etiqueta) : null);
  const port = portafolio(etq);
  const respaldo = D.fact(etq, "11") + D.fact(etq, "12");
  const reservas = D.fact(etq, "2640");
  const patrimTotal = (q: string) => D.fact(q, "3") + provisionRenta(q).neto;
  const mezclaCob = ingReal ? val(etq, "4180", modo) / ingReal : 0;

  const dUtil = refFlujo(utilNetaTramo, () => tramoPpto(lineaPpto(anio, (l) => l.formula === "util_neta"), mes, modo));
  const dEbitda = refFlujo((q, m) => realFormula("ebitda", q, m), () => tramoPpto(lineaPpto(anio, (l) => l.formula === "ebitda" && l.tipo === "total"), mes, modo));
  const dIngBase = refFlujo((q, m) => val(q, "4", m), () => {
    const inv = tramoPpto(lineaPpto(anio, (l) => l.cuentas.includes("4150")), mes, modo);
    const com = tramoPpto(lineaPpto(anio, (l) => l.cuentas.includes("4180")), mes, modo);
    return inv === null || com === null ? null : inv + com; // el plan solo presupuesta las dos vías
  });
  // Rotular la base real evita que se lea como "total vs. presupuesto total" al
  // lado del 138% de ejecución (que es el ingreso de operación, neto de costo).
  const dIng = base === "ppto" ? { ...dIngBase, label: "vs. presupuesto (comisiones + inversiones)" } : dIngBase;
  const dReservas = refSaldo((q) => D.fact(q, "2640"));
  const dLiquidez = refSaldo((q) => D.fact(q, "11") + D.fact(q, "12"));
  const dPatrim = refSaldo(patrimTotal);

  const dirDe = (delta: number | null, buenoSiSube = true): Tono =>
    delta === null ? "neutro" : (delta >= 0) === buenoSiSube ? "pos" : "neg";

  const kpis: Kpi[] = [
    {
      id: "cobertura", label: "Razón de cobertura", valor: cob, unidad: "pct", ancla: true,
      delta: cobPrev === null ? null : (cob - cobPrev) * 100, deltaUnidad: "pts",
      deltaLabel: base === "mes" ? "vs. mes anterior" : "vs. año anterior",
      dir: cobPrev === null ? "neutro" : cob >= cobPrev ? "pos" : "neg",
      sub: "misión: mantenerse sobre el 100%", serie: s12(razonCobertura),
    },
    {
      id: "reservas", label: "Reservas individuales", valor: reservas, unidad: "cop",
      delta: dReservas.delta, deltaUnidad: "pct", deltaLabel: dReservas.label, dir: "neutro",
      sub: "obligaciones de garantía", serie: s12((q) => D.fact(q, "2640")),
    },
    {
      id: "rendimiento", label: "Rendimiento del portafolio", valor: port.tasaPonderada, unidad: "pct",
      delta: port.benchmark ? (port.tasaPonderada - port.benchmark) * 100 : null, deltaUnidad: "pts",
      deltaLabel: port.benchmark ? "vs. referencia CDT 180d" : "referencia CDT sin definir (Portafolio › Mantenimiento)",
      dir: port.benchmark ? (port.tasaPonderada >= port.benchmark ? "pos" : "neg") : "neutro",
      sub: `tasa ponderada E.A. · ${port.posiciones.length} posiciones`, serie: null,
    },
    {
      id: "utilidad", label: `Utilidad neta (${modo === "acum" ? "año" : "mes"})`, valor: utilReal, unidad: "cop",
      delta: dUtil.delta, deltaUnidad: "pct", deltaLabel: dUtil.label, dir: dirDe(dUtil.delta),
      serie: serieResultados(etq).map((x) => x.utilNeta),
    },
    {
      id: "ebitda", label: `EBITDA (${modo === "acum" ? "año" : "mes"})`, valor: ebitdaReal, unidad: "cop",
      delta: dEbitda.delta, deltaUnidad: "pct", deltaLabel: dEbitda.label, dir: dirDe(dEbitda.delta),
      sub: ingReal ? `margen ${f1((ebitdaReal / ingReal) * 100)}%` : undefined,
      serie: serieResultados(etq).map((x) => x.ebitda),
    },
    {
      id: "ingresos", label: `Ingresos (${modo === "acum" ? "año" : "mes"})`, valor: ingReal, unidad: "cop",
      delta: dIng.delta, deltaUnidad: "pct", deltaLabel: dIng.label, dir: dirDe(dIng.delta),
      sub: `cobertura ${(mezclaCob * 100).toFixed(0)}% · inversiones ${(ingReal ? (val(etq, "4150", modo) / ingReal) * 100 : 0).toFixed(0)}%`,
      serie: s12((q) => D.fact(q, "4")),
    },
    {
      id: "liquidez", label: "Respaldo líquido", valor: respaldo, unidad: "cop",
      delta: dLiquidez.delta, deltaUnidad: "pct", deltaLabel: dLiquidez.label, dir: dirDe(dLiquidez.delta),
      sub: `cubre ${fmtPct(cob)} de las garantías`, serie: s12((q) => D.fact(q, "11") + D.fact(q, "12")),
    },
    {
      id: "patrimonio", label: "Patrimonio total", valor: patrimTotal(etq), unidad: "cop",
      delta: dPatrim.delta, deltaUnidad: "pct", deltaLabel: dPatrim.label, dir: dirDe(dPatrim.delta),
      sub: "incluye la utilidad del ejercicio", serie: s12(patrimTotal),
    },
  ];

  // ----- qué cambió: variaciones materiales -----
  // Materialidad: |Δ| ≥ máx(1 millón, 2% de los ingresos del tramo).
  const umbral = Math.max(1_000_000, Math.abs(ingReal) * 0.02);
  let variaciones: Variacion[] = [];
  if (base === "ppto" && e) {
    const vistos = new Set<string>();
    variaciones = e.filas
      .filter((f) => f.tipo === "detalle" && !f.formula && f.real !== null && f.clase !== "resultado")
      .filter((f) => (vistos.has(f.etiqueta) ? false : (vistos.add(f.etiqueta), true)))
      .map((f) => ({
        nombre: f.etiqueta, clase: f.clase as "ingreso" | "gasto", actual: f.real as number, ref: f.ppto,
        delta: (f.real as number) - f.ppto,
        impacto: f.clase === "gasto" ? -((f.real as number) - f.ppto) : (f.real as number) - f.ppto,
      }));
  } else {
    const refP = base === "mes" ? prevM : prevA;
    const modoVar: Modo = base === "mes" ? "mes" : modo;
    if (refP) {
      variaciones = D.cuentas
        .filter((c) => c.longitud === 4 && (c.clase === 4 || c.clase === 5))
        .map((c) => {
          const a = val(etq, c.codigo, modoVar), r = val(refP.etiqueta, c.codigo, modoVar);
          const delta = a - r;
          return {
            nombre: c.nombre, clase: (c.clase === 4 ? "ingreso" : "gasto") as "ingreso" | "gasto",
            actual: a, ref: r, delta, impacto: c.clase === 5 ? -delta : delta,
          };
        });
    }
  }
  variaciones = variaciones
    .filter((x) => Math.abs(x.delta) >= umbral)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);

  // ----- comportamiento del período: 4 magnitudes con su crecimiento -----
  // (Reemplaza al waterfall: cada barra responde una pregunta obvia, sin
  //  requerir que la Junta interprete un gráfico de puente.)
  const crecFlujo = (fReal: (q: string, m: Modo) => number, fPpto: () => number | null): number | null => {
    if (base === "ppto") { const p = fPpto(); return p === null ? null : pctVar(fReal(etq, modo), p); }
    if (base === "mes") return prevM ? pctVar(fReal(etq, "mes"), fReal(prevM.etiqueta, "mes")) : null;
    return prevA ? pctVar(fReal(etq, modo), fReal(prevA.etiqueta, modo)) : null;
  };
  const comportamiento: Metrica[] = [
    {
      label: "Ingresos", valor: ingReal, subeEsBueno: true,
      delta: crecFlujo((q, m) => val(q, "4", m), () => {
        const inv = tramoPpto(lineaPpto(anio, (l) => l.cuentas.includes("4150")), mes, modo);
        const com = tramoPpto(lineaPpto(anio, (l) => l.cuentas.includes("4180")), mes, modo);
        return inv === null || com === null ? null : inv + com;
      }),
    },
    {
      label: "Gastos de administración", valor: gasAdmReal, subeEsBueno: false,
      delta: crecFlujo((q, m) => realFormula("gastos_admin", q, m), () => tramoPpto(lineaPpto(anio, (l) => l.formula === "gastos_admin"), mes, modo)),
    },
    {
      label: "EBITDA", valor: ebitdaReal, subeEsBueno: true,
      delta: crecFlujo((q, m) => realFormula("ebitda", q, m), () => tramoPpto(lineaPpto(anio, (l) => l.formula === "ebitda" && l.tipo === "total"), mes, modo)),
    },
    {
      label: "Patrimonio", valor: patrimTotal(etq), subeEsBueno: true,
      delta: base === "mes" ? (prevM ? pctVar(patrimTotal(etq), patrimTotal(prevM.etiqueta)) : null)
        : (prevA ? pctVar(patrimTotal(etq), patrimTotal(prevA.etiqueta)) : null),
    },
  ].map((m) => ({ ...m, bueno: m.delta === null ? true : (m.delta >= 0) === m.subeEsBueno }));

  // ----- termómetro del presupuesto (siempre contra el plan, si existe) -----
  let termometro: FilaTermo[] = [];
  if (e) {
    const orden = ["ing_operacion", "gastos_admin", "ebitda", "impuesto", "util_neta"];
    termometro = orden
      .map((k) => {
        const filas = e.filas.filter((f) => f.formula === k);
        return filas.length ? filas[filas.length - 1] : null; // la última = la definitiva (EBITDA final, no el subtotal)
      })
      .filter((f): f is NonNullable<typeof f> => f !== null && f.real !== null)
      .map((f) => ({
        etiqueta: LABEL_TERMO[f.formula as string] ?? f.etiqueta,
        real: f.real as number, ppto: f.ppto, pct: f.pctEjec, semaforo: f.semaforo,
      }));
  }

  // ----- R1..R5: el resumen ejecutivo (narrativa por reglas) -----
  const frases: Frase[] = [];
  const fmtMi = (n: number) => `COP ${(n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} M`;

  // R1 — resultado vs. base + su driver principal (sale de las variaciones materiales).
  if (dUtil.delta !== null) {
    const sube = dUtil.delta >= 0;
    // Nombre ejecutivo de los rubros que la Junta conoce por otro nombre que el PUC.
    const ALIAS: Record<string, string> = {
      "servicios": "los ingresos por comisiones",
      "actividad financiera": "los ingresos por inversiones",
      "ingresos por comisiones": "los ingresos por comisiones",
      "ingresos por inversiones": "los ingresos por inversiones",
      "provisiones (reservas individuales)": "el costo de cobertura (reservas)",
    };
    const nombreDe = (x: Variacion) => ALIAS[x.nombre.toLowerCase()] ?? x.nombre.toLowerCase();
    const textoDriver = (x: Variacion) =>
      x.clase === "gasto"
        ? (x.impacto > 0 ? `un menor gasto en ${nombreDe(x)}` : `un mayor gasto en ${nombreDe(x)}`)
        : nombreDe(x);
    const drivers = variaciones
      .filter((x) => (sube ? x.impacto > 0 : x.impacto < 0))
      .slice(0, 2)
      .map(textoDriver);
    // Conjunción correcta: "y" → "e" ante palabra que empieza por i-.
    const unir = (a: string[]) => (a.length < 2 ? a[0] ?? "" : `${a[0]} ${a[1].startsWith("i") ? "e" : "y"} ${a[1]}`);
    const driverTxt = drivers.length
      ? `, ${sube ? "impulsada principalmente por" : "explicada principalmente por"} ${unir(drivers)}`
      : "";
    // Con desvíos muy grandes, "N,N veces" se lee mejor que "230% por encima".
    const magnitud = sube && dUtil.delta >= 200
      ? `${f1(1 + dUtil.delta / 100)} veces ${BASE_VECES[base]}`
      : `${f1(Math.abs(dUtil.delta), 0)}% ${sube ? "por encima" : "por debajo"} ${BASE_DE[base]}`;
    frases.push({
      regla: "R1", tono: sube ? "pos" : "neg",
      texto: `La utilidad neta ${tramoLabel} alcanzó ${fmtMi(utilReal)}, ${magnitud}${driverTxt}.`,
    });
  }
  // R2 — gastos de administración frente al plan (±5% = dentro de lo esperado).
  if (e) {
    const g = termometro.find((t) => t.etiqueta.toLowerCase().includes("administra"));
    if (g && g.pct !== null) {
      const dentro = g.pct <= 105;
      frases.push({
        regla: "R2", tono: dentro ? "pos" : "neg",
        texto: dentro
          ? `Los gastos de administración permanecen dentro de lo presupuestado (${f1(g.pct, 0)}% de ejecución).`
          : `Los gastos de administración se ubican ${f1(g.pct - 100, 0)}% por encima del plan (${fmtMi(g.real)} frente a ${fmtMi(g.ppto)}).`,
      });
    }
  }
  // R3 — racha del EBITDA (≥3 meses consecutivos positivos).
  const serieEb = serieResultados(etq, 24).map((x) => x.ebitda);
  let racha = 0;
  for (let i = serieEb.length - 1; i >= 0 && serieEb[i] > 0; i--) racha++;
  if (racha >= 3) {
    frases.push({ regla: "R3", tono: "pos", texto: `El EBITDA completa ${racha} meses consecutivos en terreno positivo.` });
  } else if (serieEb[serieEb.length - 1] <= 0) {
    frases.push({ regla: "R3", tono: "neg", texto: `El EBITDA del mes fue negativo.` });
  }
  // R4 — la misión: cobertura de las garantías.
  frases.push({
    regla: "R4", tono: cob >= 1 ? "pos" : "neg",
    texto: cob >= 1
      ? `El respaldo líquido (efectivo e inversiones) cubre el ${fmtPct(cob)} de las obligaciones de garantía, por encima del umbral del 100%.`
      : `El respaldo líquido cubre solo el ${fmtPct(cob)} de las obligaciones de garantía — por debajo del umbral del 100%.`,
  });
  // R5 — crecimiento del negocio: reservas y patrimonio interanual.
  {
    const rY = prevA ? pctVar(reservas, D.fact(prevA.etiqueta, "2640")) : null;
    const pY = prevA ? pctVar(patrimTotal(etq), patrimTotal(prevA.etiqueta)) : null;
    if (rY !== null && pY !== null) {
      frases.push({
        regla: "R5", tono: pY >= 0 ? "pos" : "neg",
        texto: `Las reservas individuales ${rY >= 0 ? "crecieron" : "disminuyeron"} ${f1(Math.abs(rY), 0)}% interanual y el patrimonio ${pY >= 0 ? "creció" : "cayó"} ${f1(Math.abs(pY), 0)}%.`,
      });
    }
  }

  // ----- evolución (las 4 tendencias estratégicas, 12 meses) -----
  const evolucion = {
    ingGas: doce.map((q) => ({ mes: `${mesCorto[q.mes]} ${String(q.anio).slice(2)}`, ingresos: D.fact(q.etiqueta, "4"), gastos: D.fact(q.etiqueta, "5") })),
    ebitdaUn: serieResultados(etq),
    respaldo: doce.map((q) => ({
      mes: `${mesCorto[q.mes]} ${String(q.anio).slice(2)}`,
      a: D.fact(q.etiqueta, "11") + D.fact(q.etiqueta, "12"),
      b: D.fact(q.etiqueta, "2640"),
    })),
    patrimonio: doce.map((q) => ({ mes: `${mesCorto[q.mes]} ${String(q.anio).slice(2)}`, a: patrimTotal(q.etiqueta), b: null as number | null })),
  };

  // ----- portafolio (mini) -----
  const mini = {
    hayDatos: port.hayDatos, total: port.total, tasaPonderada: port.tasaPonderada, benchmark: port.benchmark,
    pctLiquido: port.pctLiquido,
    proxVenc: port.proxVenc ? { entidad: port.proxVenc.entidad, dias: port.proxVenc.diasRestantes, fecha: port.proxVenc.fechaVencimiento } : null,
    top1: port.top1, porTipo: port.porTipo.map((t) => ({ tipo: t.tipo, pct: t.pct })),
  };

  // ----- HALLAZGOS del período (observaciones por datos, no alertas) -----
  // Reemplaza "Aspectos que requieren atención": frases que un gerente diría
  // en la Junta. Rojo SOLO para lo verdaderamente importante (misión/resultado);
  // el resto se enuncia como observación neutra o positiva. Nunca queda vacío.
  const hallazgos: Hallazgo[] = [];
  // 1) La misión primero.
  if (cob < 1)
    hallazgos.push({ tono: "neg", href: "/estados/situacion", texto: `La cobertura descendió al ${fmtPct(cob)} de las obligaciones de garantía, por debajo del umbral del 100%.` });
  else
    hallazgos.push({ tono: "pos", texto: `El respaldo líquido cubre el ${fmtPct(cob)} de las obligaciones de garantía${cob < 1.05 ? " (margen estrecho)" : ""}.` });
  // 2) Resultado y su ritmo.
  if (utilReal < 0)
    hallazgos.push({ tono: "neg", href: "/estados/resultados", texto: `La utilidad neta ${tramoLabel} fue negativa (${fmtMi(utilReal)}).` });
  else if (dUtil.delta !== null)
    hallazgos.push({
      tono: "pos",
      texto: dUtil.delta >= 200
        ? `La utilidad neta ${tramoLabel} (${fmtMi(utilReal)}) llegó a ${f1(1 + dUtil.delta / 100)} veces ${BASE_VECES[base]}.`
        : `La utilidad neta ${tramoLabel} (${fmtMi(utilReal)}) supera ${BASE_LABEL[base]} en ${f1(Math.abs(dUtil.delta), 0)}%.`,
    });
  if (racha >= 3) hallazgos.push({ tono: "pos", texto: `El EBITDA acumula ${racha} meses consecutivos en terreno positivo.` });
  // 3) Disciplina de gasto.
  if (e) {
    const g = termometro.find((t) => t.etiqueta.toLowerCase().includes("administra"));
    if (g && g.pct !== null)
      hallazgos.push(g.pct <= 105
        ? { tono: "pos", texto: `Los gastos de administración se mantienen dentro del presupuesto (${f1(g.pct, 0)}% de ejecución).` }
        : { tono: "neutro", href: "/estados/resultados?vista=ejec-acum", texto: `Los gastos de administración van al ${f1(g.pct, 0)}% de ${planLabel} (${fmtMi(g.real)} frente a ${fmtMi(g.ppto)}).` });
    // Rubro puntual muy por encima del plan (material).
    const rub = e.filas.find((f) => f.tipo === "detalle" && !f.formula && f.clase === "gasto" && f.pctEjec !== null && f.pctEjec >= 150 && (f.variacion ?? 0) >= 2_000_000);
    if (rub) hallazgos.push({ tono: "neutro", href: "/estados/resultados?vista=ejec-acum", texto: `${rub.etiqueta} va al ${f1(rub.pctEjec!, 0)}% del presupuesto (${fmtMi(rub.variacion as number)} por encima de ${planLabel}).` });
  }
  // 4) Portafolio.
  if (port.hayDatos) {
    if (port.benchmark)
      hallazgos.push({ tono: port.tasaPonderada >= port.benchmark ? "pos" : "neutro", texto: `El portafolio rinde ${f1(port.tasaPonderada * 100)}% E.A., ${port.tasaPonderada >= port.benchmark ? "por encima de" : "por debajo de"} la referencia de ${f1(port.benchmark * 100)}%.` });
    if (port.top1 > 0.3)
      hallazgos.push({ tono: "neutro", href: "/portafolio", texto: `La concentración del portafolio alcanza el ${f1(port.top1 * 100, 0)}% en una sola entidad (referencia prudencial: 30%).` });
    const venc = port.posiciones.find((p) => p.estadoVenc === "vencido") ?? port.posiciones.find((p) => p.estadoVenc === "decision");
    if (venc) hallazgos.push({ tono: venc.estadoVenc === "vencido" ? "neg" : "neutro", href: "/portafolio", texto: venc.estadoVenc === "vencido" ? `El ${venc.tipo} de ${venc.entidad} (${fmtMi(venc.monto)}) está vencido y requiere decisión.` : `El ${venc.tipo} de ${venc.entidad} vence en ${venc.diasRestantes} días.` });
  }
  // 5) Crecimiento del negocio.
  {
    const rY = prevA ? pctVar(reservas, D.fact(prevA.etiqueta, "2640")) : null;
    if (rY !== null && Math.abs(rY) >= 3) hallazgos.push({ tono: "neutro", texto: `Las reservas individuales ${rY >= 0 ? "crecieron" : "disminuyeron"} ${f1(Math.abs(rY), 0)}% frente al año anterior.` });
  }

  // Estado global: "grave" solo si la misión (cobertura) o el resultado están mal;
  // "vigilar" si hay un hallazgo importante (rojo). Un CDT por vencer no tiñe todo.
  const estado: "solida" | "vigilar" | "grave" =
    cob < 1 || utilReal < 0 ? "grave" : hallazgos.some((h) => h.tono === "neg") ? "vigilar" : "solida";

  return {
    estado,
    periodo: { etq, anio, mes, nombre: `${mesNombre[mes]} ${anio}` },
    modo, base, hayPpto, hayPrevMes: !!prevM, hayPrevAnio: !!prevA,
    tramoLabel, baseLabel: BASE_LABEL[base], planLabel,
    frases, kpis, comportamiento, variaciones, utilReal, termometro,
    evolucion, portafolio: mini, hallazgos,
    ejecGlobal: e ? {
      ing: termometro.find((t) => t.etiqueta.toLowerCase().includes("ingresos"))?.pct ?? null,
      gas: termometro.find((t) => t.etiqueta.toLowerCase().includes("administra"))?.pct ?? null,
    } : null,
  };
}
export type Informe = ReturnType<typeof construirInforme>;
