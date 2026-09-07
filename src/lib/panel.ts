// Executive Financial Panel — contrato ÚNICO del informe para la Junta.
// `construirPanel()` devuelve un objeto estructurado con TODA la narrativa y
// las cifras. La página /panel lo RENDERIZA; el futuro informe PDF renderizará
// EXACTAMENTE el mismo objeto. La narrativa es un dato, no un layout.
//
// Solo LECTURA sobre los motores validados (statements, ejecucion, indicadores):
// aquí no se calcula nada contable nuevo — se comparan y se redactan cifras que
// ya produce el motor. Todas las cifras salen en MILLONES de pesos.
//
// NOMENCLATURA (decisión del analista, rige en toda la app):
//   · «Facturación por garantías»          = cuenta 4180, cobrado antes de IVA
//   · «Ingresos por cobertura de créditos» = 4180 − reserva (5199150101)
//   · «Ingresos por inversiones»           = cuenta 4150
// Vocabularios separados a propósito: "facturación/garantías" para lo que se
// cobra y "cobertura" para lo que el fondo gana — así no pueden confundirse.
// El facturado NUNCA se muestra solo: siempre junto a su reserva y al ingreso real.
//
// COMPARACIÓN CONTRA EL PLAN: se compara contra el plan ANUAL usando el tiempo
// transcurrido como referencia, y NO contra el reparto mensual del Excel, porque
// el presupuesto se distribuyó sin una estacionalidad conocida (empresa joven,
// pocos clientes). Comparar contra el tramo daría porcentajes sin significado.
import "server-only";
import * as D from "./data";
import { provisionRenta, impuestoMes, COSTO_COBERTURA, ING_COBERTURA, ING_FINANCIERO } from "./statements";
import { realFormula } from "./ejecucion";
import { ingOperacion, gastosOperativos } from "./informe-cuentas";
import { indicadoresPanel, type IndPanel } from "./indicadores";
import { mesCorto, mesNombre } from "./format";

export type Modo = "acum" | "mes";
export type Tono = "pos" | "neg" | "neutro";

/** Rótulos canónicos — la UI los importa para no repetir literales. */
export const TERMINOS = {
  facturado: "Facturación por garantías",
  reserva: "Reserva constituida",
  comisiones: "Ingresos por cobertura de créditos",
  inversiones: "Ingresos por inversiones",
  ingOperacion: "Ingreso de operación",
} as const;

export type ItemComp = { nombre: string; valor: number; pct: number };
export type CuentaMov = { nombre: string; serie: number[]; actual: number; cambio: number | null };
export type FilaEj = {
  nivel: 0 | 1; tipo: "detalle" | "total" | "gran"; etiqueta: string;
  real: number | null; planAnual: number; pct: number | null; vsRitmo: number | null;
  favorable: boolean | null; esGasto: boolean; hijos?: FilaEj[];
};

const f1 = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

export function construirPanel(etq: string, modo: Modo) {
  const per = D.periodo(etq);
  const anio = per.anio, mes = per.mes;
  const meses = D.periodos.filter((p) => p.anio === anio && p.mes <= mes);
  const etqs = meses.map((m) => m.etiqueta);
  const labels = meses.map((m) => mesCorto[m.mes]);
  const n = meses.length || 1;

  // ---------- helpers (todo en millones) ----------
  const serie = (cod: string) => etqs.map((e) => D.fact(e, cod) / 1e6);
  const val = (cod: string) => (modo === "acum" ? D.ytd(etq, cod) : D.fact(etq, cod)) / 1e6;
  const last = <T,>(a: T[]): T => a[a.length - 1];
  const suma = (a: number[]) => a.reduce((x, y) => x + y, 0);
  /** Flujo: el ritmo del período anualizado. */
  const projFlujo = (acumM: number) => (acumM / n) * 12;
  /** Saldo: la tendencia extrapolada al cierre (un saldo no se anualiza). */
  const projSaldo = (s: number[]) => (s.length < 2 ? last(s) : last(s) + ((last(s) - s[0]) / (s.length - 1)) * (12 - s.length));

  // ---------- la misión: respaldo vs. obligaciones ----------
  const sEfe = serie("11"), sInv12 = serie("12"), sGar = serie("2640");
  const sResp = sEfe.map((v, i) => v + sInv12[i]);
  const cobertura = last(sGar) ? last(sResp) / last(sGar) : 0;
  const excedente = last(sResp) - last(sGar);

  // ---------- comisiones: facturado → reserva → ingreso real ----------
  const facturado = val(ING_COBERTURA);
  const reserva = val(COSTO_COBERTURA);
  const comisiones = facturado - reserva;
  const inversiones = val(ING_FINANCIERO);
  const sFact = serie(ING_COBERTURA), sRsv = serie(COSTO_COBERTURA);
  const sCom = sFact.map((v, i) => v - sRsv[i]), sInvIng = serie(ING_FINANCIERO);

  // ---------- resultado ----------
  /* Ingresos de operacion sale de informe-cuentas: es la MISMA definicion que usa
   * el informe de Junta y la conciliacion. Antes iba directo a realFormula, que no
   * resta 4210/4295, y la misma linea valia dos cosas distintas en la app.
   * OJO la asimetria, deliberada: el real excluye esas cuentas y el presupuesto de
   * la fila 7 SI las incluye, porque el Excel no las separa. */
  const ingOp = ingOperacion(etq, modo) / 1e6;
  const ebitda = realFormula("ebitda", etq, modo) / 1e6;
  const pr = provisionRenta(etq);
  const utilNeta = (modo === "acum" ? pr.neto : D.fact(etq, "4") - D.fact(etq, "5") - impuestoMes(etq)) / 1e6;
  const sIngOp = etqs.map((e) => ingOperacion(e, "mes") / 1e6);
  const sEbitda = etqs.map((e) => realFormula("ebitda", e, "mes") / 1e6);
  /* Se calcula aparte, no como ingOp - ebitda: esa resta valia lo mismo mientras
   * ingOp incluia 4210/4295, y al sacarlos habria restado otros ingresos de los
   * gastos. La serie no se mueve. */
  const sGastOp = etqs.map((e) => gastosOperativos(e, "mes") / 1e6);
  const sUn = etqs.map((e) => (D.fact(e, "4") - D.fact(e, "5") - impuestoMes(e)) / 1e6);

  // ---------- balance ----------
  const composicion = (padre: string, extra?: ItemComp[]) => {
    const hijos = D.children(padre)
      .map((c) => ({ nombre: c.nombre, valor: D.fact(etq, c.codigo) / 1e6, pct: 0 }))
      .filter((x) => Math.abs(x.valor) > 0.05);
    const todos = [...hijos, ...(extra ?? [])].sort((a, b) => b.valor - a.valor);
    const t = suma(todos.map((x) => x.valor)) || 1;
    todos.forEach((x) => (x.pct = x.valor / t));
    return todos;
  };
  const sAct = serie("1");
  const sPas = serie("2").map((v, i) => v + provisionRenta(etqs[i]).provision / 1e6);
  const sPat = serie("3").map((v, i) => v + provisionRenta(etqs[i]).neto / 1e6);
  const balance = [
    { id: "activo", titulo: "Activo", total: last(sAct), serie: sAct, proyeccion: projSaldo(sAct),
      nota: "las inversiones que respaldan las garantías son la mayor parte", items: composicion("1") },
    { id: "pasivo", titulo: "Pasivo", total: last(sPas), serie: sPas, proyeccion: projSaldo(sPas),
      nota: "casi todo son obligaciones de garantía — no es deuda financiera",
      items: composicion("2", [{ nombre: "Provisión de renta (estimada)", valor: pr.provision / 1e6, pct: 0 }]) },
    { id: "patrimonio", titulo: "Patrimonio", total: last(sPat), serie: sPat,
      proyeccion: last(sPat) - pr.neto / 1e6 + projFlujo(suma(sUn)),
      nota: "incluye la utilidad estimada del ejercicio",
      items: composicion("3", [{ nombre: "Utilidad del ejercicio (estimada)", valor: pr.neto / 1e6, pct: 0 }]) },
  ];
  /** Small multiples: cada cuenta con SU propia escala. Si compartieran eje, las
   *  pequeñas (Deudores, Efectivo) se aplastarían contra Inversiones. */
  const movimientos = (padre: string): CuentaMov[] =>
    D.children(padre)
      .map((c) => {
        const s = serie(c.codigo);
        return { nombre: c.nombre, serie: s, actual: last(s), cambio: s[0] ? ((last(s) - s[0]) / Math.abs(s[0])) * 100 : null };
      })
      .filter((x) => x.serie.some((v) => Math.abs(v) > 0.05))
      .sort((a, b) => Math.abs(b.actual) - Math.abs(a.actual));

  // ---------- ejecución contra el PLAN ANUAL ----------
  const hayPpto = D.presupuesto.some((l) => l.anio === anio);
  const planAnual = (pred: (l: D.PptoLinea) => boolean): number => {
    const ls = D.presupuesto.filter((l) => l.anio === anio && pred(l));
    return ls.length ? ls[ls.length - 1].total / 1e6 : 0;
  };
  const tiempo = modo === "acum" ? (n / 12) * 100 : (1 / 12) * 100;
  const fila = (etiqueta: string, real: number | null, plan: number, esGasto: boolean,
                tipo: FilaEj["tipo"] = "detalle", nivel: 0 | 1 = 0, hijos?: FilaEj[]): FilaEj => {
    const pct = plan ? ((real ?? 0) / plan) * 100 : null;
    const vsRitmo = real === null ? null : real - (plan * tiempo) / 100;
    return { nivel, tipo, etiqueta, real, planAnual: plan, pct, vsRitmo,
      favorable: vsRitmo === null ? null : esGasto ? vsRitmo <= 0 : vsRitmo >= 0, esGasto, hijos };
  };
  const GASTOS: [string, string][] = [
    ["Gastos de personal", "5105"], ["Gastos comerciales", "5170"], ["Impuestos (ICA)", "5115"],
    ["Honorarios", "5110"], ["Sistematización", "5175"], ["Arrendamientos", "5120"],
    ["Gastos legales", "5140"], ["Servicios", "5135"], ["Contribuciones", "5125"],
    ["Diversos", "5195"], ["Gastos de viaje", "5155"],
  ];
  const gastosAdmin = realFormula("gastos_admin", etq, modo) / 1e6;
  const ejecucion: FilaEj[] = !hayPpto ? [] : [
    fila(TERMINOS.inversiones, inversiones, planAnual((l) => l.cuentas.includes(ING_FINANCIERO)), false),
    fila(TERMINOS.facturado, facturado, planAnual((l) => l.cuentas.includes(ING_COBERTURA)), false),
    fila(`(−) ${TERMINOS.reserva}`, reserva, planAnual((l) => l.cuentas.includes(COSTO_COBERTURA)), true),
    fila(`= ${TERMINOS.ingOperacion}`, ingOp, planAnual((l) => l.formula === "ing_operacion"), false, "total"),
    fila("Gastos de administración", gastosAdmin, planAnual((l) => l.formula === "gastos_admin"), true, "detalle", 0,
      GASTOS.map(([nm, cod]) => fila(nm, val(cod), planAnual((l) => l.cuentas.includes(cod)), true, "detalle", 1))
        .sort((a, b) => (b.real ?? 0) - (a.real ?? 0))),
    fila("= EBITDA", ebitda, planAnual((l) => l.formula === "ebitda" && l.tipo === "total"), false, "total"),
    fila("(−) Depreciaciones y amortizaciones", val("5160") + val("5165"),
      planAnual((l) => l.cuentas.includes("5160")) + planAnual((l) => l.cuentas.includes("5165")), true),
    fila("(−) Impuesto de renta", (modo === "acum" ? pr.provision : impuestoMes(etq)) / 1e6,
      planAnual((l) => l.formula === "impuesto"), true),
    fila("Utilidad neta", utilNeta, planAnual((l) => l.formula === "util_neta"), false, "gran"),
  ];

  // ---------- indicadores, repartidos donde tienen contexto ----------
  const ind = indicadoresPanel(etq);
  const pick = (ids: string[]) => ids.map((i) => ind.find((x) => x.id === i)).filter((x): x is IndPanel => !!x);

  // ---------- narrativa por reglas ----------
  const planUn = planAnual((l) => l.formula === "util_neta");
  const pctPlanUn = planUn ? (suma(sUn) / planUn) * 100 : null;
  const pctTiempo = (n / 12) * 100;
  const tramo = modo === "acum" ? `acumulada a ${mesNombre[mes].toLowerCase()}` : `de ${mesNombre[mes].toLowerCase()}`;
  const estado: "solida" | "vigilar" | "grave" = cobertura < 1 || utilNeta < 0 ? "grave" : cobertura < 1.03 ? "vigilar" : "solida";
  const titular = estado === "grave"
    ? "El resultado del período requiere la atención de la Junta."
    : pctPlanUn !== null && pctPlanUn > pctTiempo
      ? "El respaldo cubre la misión y el resultado va adelantado frente al plan."
      : "El respaldo cubre la misión; el resultado avanza según lo previsto.";
  const partes: string[] = [];
  if (pctPlanUn !== null) partes.push(`La utilidad neta ${tramo} suma ${f1(utilNeta)} millones: ya es el ${f1(pctPlanUn, 0)}% de todo lo planeado para el año, con el ${f1(pctTiempo, 0)}% del ejercicio transcurrido.`);
  if (comisiones > 0 && inversiones > 0) {
    const r = inversiones / comisiones;
    // Cuando las dos vías están parejas, decir "1,0 veces" no informa nada.
    partes.push(
      r > 1.1 ? `Las inversiones son el motor del período: aportaron ${f1(r)} veces lo que la cobertura.`
        : r < 0.9 ? `La cobertura sigue siendo la vía principal: aportó ${f1(1 / r)} veces lo que las inversiones.`
          : `Las dos vías aportan hoy casi lo mismo: ${f1(comisiones)} millones la cobertura y ${f1(inversiones)} las inversiones.`,
    );
  }

  return {
    periodo: { etq, anio, mes, nombre: `${mesNombre[mes]} ${anio}` },
    modo, labels, nMeses: n, hayPpto, tiempoPct: tiempo,
    tramoLabel: modo === "acum" ? `acumulado enero–${mesCorto[mes].toLowerCase()}` : `solo ${mesNombre[mes].toLowerCase()}`,
    estado, titular, lede: partes.join(" "),
    mision: { cobertura, excedente, respaldo: last(sResp), obligaciones: last(sGar), sResp, sGar },
    comisiones: {
      facturado, reserva, real: comisiones,
      pctReserva: facturado ? reserva / facturado : 0,
      pctReal: facturado ? comisiones / facturado : 0,
      projFacturado: modo === "acum" ? projFlujo(facturado) : null,
      projReal: modo === "acum" ? projFlujo(comisiones) : null,
    },
    resultado: {
      ingOp, ebitda, utilNeta, inversiones, comisiones,
      margenEbitda: ingOp ? ebitda / ingOp : 0,
      pctComisiones: ingOp ? comisiones / ingOp : 0,
      pctInversiones: ingOp ? inversiones / ingOp : 0,
      projIngOp: modo === "acum" ? projFlujo(ingOp) : null,
      projEbitda: modo === "acum" ? projFlujo(ebitda) : null,
      projUtil: modo === "acum" ? projFlujo(utilNeta) : null,
      pctPlanUn,
    },
    balance,
    movimientos: [
      { grupo: "Activo", cuentas: movimientos("1") },
      { grupo: "Pasivo", cuentas: movimientos("2") },
      { grupo: "Patrimonio", cuentas: movimientos("3") },
    ],
    dosVias: labels.map((m, i) => ({ mes: m, comisiones: sCom[i], inversiones: sInvIng[i], total: sCom[i] + sInvIng[i] })),
    ejecucion,
    trayectoria: { ingOp: sIngOp, gastos: sGastOp, ebitda: sEbitda, utilNeta: sUn, patrimonio: sPat },
    // Se muestran los DOS márgenes EBITDA porque miden cosas distintas y ambas
    // importan: el tradicional sobre ingresos totales (que incluyen el facturado
    // de garantías) y el «limpio» sobre el ingreso de operación (lo que de verdad
    // entra al fondo). Van juntos y rotulados para que no se confundan.
    indicadores: {
      solidez: pick(["cobertura", "razon_corriente", "endeud_real"]),
      margen: pick(["margen_ebitda", "margen_ebitda_limpio", "margen_neto", "roa"]),
    },
  };
}
export type Panel = ReturnType<typeof construirPanel>;
