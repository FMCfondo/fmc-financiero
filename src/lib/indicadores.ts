import "server-only";
import * as D from "./data";
import { provisionRenta } from "./statements";

/*
  Catálogo de indicadores financieros de FMC.

  Para AÑADIR un indicador: agrega una entrada a DEFS. Nada más.
  Las categorías se derivan solas y la UI no se toca.

  Revisión de fórmulas 2026-07 (pedida por el analista):
  - Se eliminó "Prueba ácida": estaba mal implementada (sumaba inversiones; la
    fórmula estándar RESTA inventarios) y FMC no maneja inventarios — no aporta.
  - Se eliminó "Respaldo en efectivo": las inversiones también son respaldo
    líquido, así que duplicaba la razón de cobertura sin decir nada nuevo.
  - Se eliminó "Rendimiento de las inversiones": un % año-corrido al lado de
    CDTs cotizados en EA genera confusión. Irá en el módulo de Inversiones con
    la tasa bien calculada por instrumento.
  - Margen neto / ROA / ROE ahora usan la utilidad NETA (después de la provisión
    de renta), y el ROE usa el patrimonio total (incluida la utilidad).
*/

export const CUENTAS = {
  EFECTIVO: "11",
  INVERSIONES: "12",
  DEUDORES: "13",
  GARANTIAS: "2640",
  ING_ORDINARIOS: "41",
  ING_COBERTURA: "4180",
  ING_FINANCIERO: "4150",
  COSTO_COBERTURA: "5199150101",
  GASTOS_ADMIN: "51",
  GASTOS_VENTAS: "52",
  DEPRECIACIONES: "5160",
  AMORTIZACIONES: "5165",
} as const;

/** Clasificación corriente / no corriente.
 *  NO existe en los datos: es una decisión de presentación validada con el
 *  analista (2026-07-14). Inversiones (CDT/fiducias) y la provisión de
 *  garantías se consideran CORRIENTES: la obligación es exigible y el respaldo
 *  es líquido. */
const ACTIVO_CORRIENTE = ["11", "12", "13", "14"];

export type Formato = "pct" | "cop" | "veces";
export type Direccion = "alto" | "bajo";

export type Indicador = {
  id: string;
  nombre: string;
  categoria: string;
  valor: number;
  prev: number | null;
  formato: Formato;
  /** Hacia dónde es "bueno" que se mueva. Si falta, es neutro (ni verde ni rojo). */
  bueno?: Direccion;
  /** Cómo se calcula, en lenguaje llano. Se muestra al usuario. */
  formula: string;
  /** Advertencia obligatoria. Si existe, el indicador NUNCA se muestra pelado. */
  nota?: string;
  /** Destacar en el resumen ejecutivo. */
  clave?: boolean;
};

export const CATEGORIAS = [
  { id: "solidez", nombre: "Solidez y Cobertura", desc: "¿El respaldo alcanza para las obligaciones de garantía?" },
  { id: "ingresos", nombre: "Ingresos", desc: "¿Cuánto entra por cada vía y cuánto le queda al fondo?" },
  { id: "rentabilidad", nombre: "Rentabilidad", desc: "¿Cuánto rinde lo que se hace?" },
  { id: "crecimiento", nombre: "Crecimiento", desc: "¿Cómo se mueven los ingresos y los gastos mes a mes?" },
  { id: "liquidez", nombre: "Liquidez", desc: "¿Hay con qué responder en el corto plazo?" },
  { id: "endeudamiento", nombre: "Endeudamiento", desc: "¿Cuánto se debe de verdad?" },
  { id: "eficiencia", nombre: "Eficiencia", desc: "¿Cuánto cuesta operar?" },
] as const;

/** Todo lo que un indicador puede necesitar, ya calculado una vez. */
type Ctx = {
  activo: number; pasivo: number; patrim: number; patrimTotal: number;
  efectivo: number; inversiones: number;
  activoCte: number; pasivoCte: number;
  garantias: number; respaldo: number; deudaReal: number;
  ingYTD: number; gasYTD: number; utilAntes: number; utilNeta: number; provision: number;
  ingCob: number; costoCob: number; ingFin: number;
  ingOrd: number; gasVentas: number; depAmort: number;
  gastosAdmin: number; contribCob: number; contribInv: number; contribTotal: number;
  ingMes: number; gasMes: number; ingMesPrev: number; gasMesPrev: number;
  ingCobMes: number; ingFinMes: number;
};

function ctx(etq: string): Ctx {
  const f = (c: string) => D.fact(etq, c);
  const y = (c: string) => D.ytd(etq, c);
  const pm = D.prevPeriodo(etq)?.etiqueta ?? null;
  const pr = provisionRenta(etq);
  const efectivo = f(CUENTAS.EFECTIVO);
  const inversiones = f(CUENTAS.INVERSIONES);
  const activo = f("1");
  const garantias = f(CUENTAS.GARANTIAS);
  const pasivo = f("2") + pr.provision; // pasivo total, con la provisión estimada
  const patrim = f("3");
  const ingCob = y(CUENTAS.ING_COBERTURA);
  const costoCob = y(CUENTAS.COSTO_COBERTURA);
  const ingFin = y(CUENTAS.ING_FINANCIERO);
  const gastosAdmin = y(CUENTAS.GASTOS_ADMIN) - costoCob;
  const contribCob = ingCob - costoCob;
  return {
    activo, pasivo, patrim,
    patrimTotal: patrim + pr.neto,
    efectivo, inversiones,
    activoCte: ACTIVO_CORRIENTE.reduce((s, c) => s + f(c), 0),
    pasivoCte: pasivo,
    garantias, respaldo: inversiones + efectivo, deudaReal: pasivo - garantias,
    ingYTD: pr.ingYTD, gasYTD: pr.gasYTD, utilAntes: pr.utilidad, utilNeta: pr.neto, provision: pr.provision,
    ingCob, costoCob, ingFin,
    ingOrd: y(CUENTAS.ING_ORDINARIOS), gasVentas: y(CUENTAS.GASTOS_VENTAS),
    depAmort: y(CUENTAS.DEPRECIACIONES) + y(CUENTAS.AMORTIZACIONES),
    gastosAdmin, contribCob, contribInv: ingFin, contribTotal: contribCob + ingFin,
    ingMes: f("4"), gasMes: f("5"),
    ingCobMes: f(CUENTAS.ING_COBERTURA), ingFinMes: f(CUENTAS.ING_FINANCIERO),

    ingMesPrev: pm ? D.fact(pm, "4") : 0, gasMesPrev: pm ? D.fact(pm, "5") : 0,
  };
}

const div = (a: number, b: number) => (b ? a / b : 0);

export type Nivel = "bien" | "regular" | "mal";
type Def = Omit<Indicador, "valor" | "prev"> & {
  fn: (c: Ctx) => number;
  /** Valor del MES (para las columnas de la matriz); si falta, fn es de saldo/razón y aplica igual. */
  fnMes?: (c: Ctx) => number;
  /** Qué es, qué mide y qué significa — en lenguaje llano. */
  explica: string;
  /** Guía de lectura CON su justificación. Solo cuando el umbral es defendible
   *  (definicional o convención contable citada); si no existe rango universal,
   *  el texto lo dice honestamente. */
  rango: string;
  /** Semáforo. Solo definido cuando el umbral es defendible. */
  evalua?: (v: number) => Nivel;
};

/* ============ EL CATÁLOGO — añade aquí y ya ============
   Los rangos (bien/regular/mal) solo se definen donde el umbral es DEFENDIBLE:
   · definicional (100% de cobertura, $0 de excedente, punto de equilibrio)
   · o convención contable citable (razón corriente ≥ 1)
   Donde no existe un rango universal, el texto lo dice — inventar umbrales
   sin soporte es peor que no tenerlos.                                       */
const DEFS: Def[] = [
  // --- Solidez y cobertura ---
  {
    id: "cobertura", nombre: "Razón de cobertura", categoria: "solidez", formato: "pct", bueno: "alto", clave: true,
    formula: "(Inversiones + Efectivo) ÷ Obligaciones de garantías",
    explica: "Mide si el fondo tiene con qué responder por TODAS las garantías otorgadas. Compara el respaldo líquido (inversiones + efectivo) contra la provisión de garantías. Es el indicador que define la salud de FMC.",
    rango: "Bien: 100% o más · Alerta: entre 90% y 100% · Mal: menos de 90%. El umbral del 100% no es una opinión: por definición, debajo de 100% el respaldo no alcanza para cubrir todas las obligaciones. La banda 90–100% es alerta temprana por cercanía al umbral.",
    evalua: (v) => (v >= 1 ? "bien" : v >= 0.9 ? "regular" : "mal"),
    fn: (c) => div(c.respaldo, c.garantias),
  },
  {
    id: "excedente", nombre: "Excedente de respaldo", categoria: "solidez", formato: "cop", bueno: "alto", clave: true,
    formula: "(Inversiones + Efectivo) − Obligaciones de garantías",
    explica: "Los pesos que sobran después de cubrir todas las garantías: la razón de cobertura, pero en plata. Es el colchón del fondo.",
    rango: "Bien: mayor que $0 · Mal: menor que $0. Umbral definicional: en negativo faltaría respaldo para honrar las garantías.",
    evalua: (v) => (v >= 0 ? "bien" : "mal"),
    fn: (c) => c.respaldo - c.garantias,
  },

  // --- Ingresos ---
  {
    id: "ing_cobertura", nombre: "Ingresos por cobertura de créditos", categoria: "ingresos", formato: "cop", bueno: "alto", clave: true,
    formula: "Comisiones de cobertura del período (cuenta 4180)",
    explica: "Lo facturado por el servicio de cobertura: las comisiones que pagan los intermediarios por cada crédito garantizado.",
    rango: "Es un valor absoluto: no tiene umbral bueno/malo. Se lee contra su propia historia (¿crece?) y contra el presupuesto.",
    fn: (c) => c.ingCob,
    fnMes: (c) => c.ingCobMes,
  },
  {
    id: "ing_inversiones", nombre: "Ingresos por inversiones", categoria: "ingresos", formato: "cop", bueno: "alto", clave: true,
    formula: "Rendimientos financieros del período (cuenta 4150)",
    explica: "Lo que rinden los CDTs y fiducias donde está invertido el respaldo. Es el segundo motor del fondo: aporta cerca de la mitad de la contribución.",
    rango: "Valor absoluto, sin umbral universal. Se lee contra su historia y contra las tasas pactadas de cada inversión (módulo de Inversiones, próximamente).",
    fn: (c) => c.ingFin,
    fnMes: (c) => c.ingFinMes,
  },
  {
    id: "margen_cobertura", nombre: "Margen de cobertura", categoria: "ingresos", formato: "pct", bueno: "alto",
    formula: "(Ingresos de cobertura − Costo de cobertura) ÷ Ingresos de cobertura",
    explica: "De cada $100 que entran por coberturas, cuántos le quedan al fondo después de apartar el costo de cobertura (las reservas para siniestros). Si marca 13%, quedan $13 de cada $100 cobrados.",
    rango: "Bien: mayor que 0% · Mal: menor que 0%. El 0% es el punto de equilibrio: por debajo, cada cobertura cuesta más de lo que ingresa. No existe un porcentaje ideal universal — depende de la siniestralidad del nicho; compárese contra la historia propia.",
    evalua: (v) => (v > 0 ? "bien" : "mal"),
    fn: (c) => div(c.contribCob, c.ingCob),
  },

  // --- Rentabilidad ---
  {
    id: "margen_bruto", nombre: "Margen bruto", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "(Contribución de cobertura + inversiones) ÷ Ingresos totales",
    explica: "De cada $100 de ingresos, cuántos quedan después de los costos directos (el costo de cobertura), antes de gastos administrativos e impuestos.",
    rango: "Bien: mayor que 0% (punto de equilibrio bruto) · Mal: menor que 0%. Por encima no hay umbral universal; se lee contra la historia propia.",
    evalua: (v) => (v > 0 ? "bien" : "mal"),
    fn: (c) => div(c.contribTotal, c.ingYTD),
  },
  {
    id: "margen_ebitda", nombre: "Margen EBITDA", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "(Utilidad antes de impuestos + Depreciaciones + Amortizaciones) ÷ Ingresos totales",
    explica: "La utilidad operativa en efectivo: lo que genera el negocio antes de impuestos y de los gastos contables que no son plata (depreciaciones y amortizaciones). Sirve para comparar sin que la antigüedad de los activos distorsione.",
    rango: "Bien: mayor que 0% · Mal: menor que 0% (equilibrio). En FMC los activos fijos son mínimos, así que quedará casi igual al margen antes de impuestos.",
    evalua: (v) => (v > 0 ? "bien" : "mal"),
    fn: (c) => div(c.utilAntes + c.depAmort, c.ingYTD),
  },
  {
    id: "margen_operativo", nombre: "Margen operativo", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "(Ingresos ordinarios − Gastos de administración y ventas) ÷ Ingresos ordinarios",
    explica: "Cuánto queda de la operación ordinaria después de TODOS los gastos de operar (incluido el costo de cobertura), antes de partidas extraordinarias e impuestos.",
    rango: "Bien: mayor que 0% · Mal: menor que 0% (equilibrio operativo). Sin umbral universal por encima.",
    evalua: (v) => (v > 0 ? "bien" : "mal"),
    fn: (c) => div(c.ingOrd - (c.gastosAdmin + c.costoCob) - c.gasVentas, c.ingOrd),
  },
  {
    id: "margen_neto", nombre: "Margen neto", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "Utilidad neta (después de la provisión de renta) ÷ Ingresos totales",
    explica: "La última línea: de cada $100 de ingresos, cuántos quedan como utilidad después de todo, impuestos incluidos.",
    rango: "Bien: mayor que 0% · Mal: menor que 0%. El equilibrio es el único umbral objetivo; el nivel deseable se fija contra el presupuesto.",
    evalua: (v) => (v > 0 ? "bien" : "mal"),
    fn: (c) => div(c.utilNeta, c.ingYTD),
  },
  {
    id: "roa", nombre: "ROA", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "Utilidad neta ÷ Activos totales",
    explica: "Cuánto le saca el fondo a cada peso de activos. Para FMC es EL indicador de rentabilidad comparable, porque no lo distorsiona el patrimonio pequeño.",
    rango: "Bien: mayor que 0%. Referencia con soporte: si el ROA anualizado queda por debajo de la inflación del año, el activo pierde poder adquisitivo en términos reales — compárese contra el IPC.",
    evalua: (v) => (v > 0 ? "bien" : "mal"),
    fn: (c) => div(c.utilNeta, c.activo),
  },
  {
    id: "roe", nombre: "ROE", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "Utilidad neta ÷ Patrimonio total (incluida la utilidad)",
    explica: "Cuánto rinde el patrimonio de los accionistas. En una empresa normal es el indicador estrella; en FMC no lo es.",
    rango: "Sin rango útil en FMC: el denominador (patrimonio) es mínimo por diseño del negocio, así que el ROE sale inflado siempre. Úsese el ROA.",
    nota: "Está inflado: el patrimonio de FMC es mínimo frente al activo, porque el activo respalda la provisión de garantías, no al accionista. El ROA es el número comparable.",
    fn: (c) => div(c.utilNeta, c.patrimTotal),
  },

  // --- Crecimiento ---
  {
    id: "crec_ing_mes", nombre: "Variación de ingresos (vs mes anterior)", categoria: "crecimiento", formato: "pct", bueno: "alto",
    formula: "(Ingresos del mes − Ingresos del mes anterior) ÷ Ingresos del mes anterior",
    explica: "Cuánto subieron o bajaron los ingresos frente al mes pasado. Ojo: un mes malo no es una tendencia — los ingresos del fondo tienen estacionalidad.",
    rango: "Sin semáforo, a propósito: la variación de UN mes es volátil por naturaleza y colorearla induce a leer ruido como señal. La tendencia se ve en el gráfico de 12 meses.",
    fn: (c) => div(c.ingMes - c.ingMesPrev, Math.abs(c.ingMesPrev)),
  },
  {
    id: "crec_gas_mes", nombre: "Variación de gastos (vs mes anterior)", categoria: "crecimiento", formato: "pct", bueno: "bajo",
    formula: "(Gastos del mes − Gastos del mes anterior) ÷ Gastos del mes anterior",
    explica: "Cuánto subieron o bajaron los gastos frente al mes pasado. Que suban no es malo en sí: si los ingresos suben más, el negocio mejora.",
    rango: "Sin semáforo, por la misma razón que los ingresos: un solo mes es ruido. La lectura útil es compararla contra la variación de ingresos del mismo mes.",
    fn: (c) => div(c.gasMes - c.gasMesPrev, Math.abs(c.gasMesPrev)),
  },

  // --- Liquidez ---
  {
    id: "razon_corriente", nombre: "Razón corriente", categoria: "liquidez", formato: "veces", bueno: "alto",
    formula: "Activo corriente ÷ Pasivo corriente",
    explica: "Cuántos pesos de activos de corto plazo hay por cada peso de deudas de corto plazo. Con 1,07: por cada $1 que se debe pronto, hay $1,07 con qué pagarlo.",
    rango: "Bien: 1,0 o más · Mal: menos de 1,0. El 1,0 es la convención contable clásica: debajo de 1, los pasivos corrientes superan los activos corrientes. (La banda cómoda de 1,5–2,0 de los manuales está pensada para empresas con inventarios; no aplica bien a un fondo.)",
    nota: "La clasificación corriente/no corriente no viene en el balance de prueba: se define en la app. Hoy inversiones y provisión de garantías cuentan como corrientes.",
    evalua: (v) => (v >= 1 ? "bien" : "mal"),
    fn: (c) => div(c.activoCte, c.pasivoCte),
  },
  {
    id: "capital_trabajo", nombre: "Capital de trabajo", categoria: "liquidez", formato: "cop", bueno: "alto",
    formula: "Activo corriente − Pasivo corriente",
    explica: "La razón corriente en pesos: cuánto sobra (o falta) tras cubrir las obligaciones de corto plazo con los recursos de corto plazo.",
    rango: "Bien: mayor que $0 · Mal: menor que $0. Umbral definicional (mismo criterio que la razón corriente).",
    evalua: (v) => (v >= 0 ? "bien" : "mal"),
    fn: (c) => c.activoCte - c.pasivoCte,
  },

  // --- Endeudamiento ---
  {
    id: "endeud_real", nombre: "Endeudamiento real", categoria: "endeudamiento", formato: "pct", bueno: "bajo", clave: true,
    formula: "(Pasivo − Provisión de garantías) ÷ Activo",
    explica: "Cuánto del activo está financiado con deuda DE VERDAD (proveedores, impuestos, laborales), quitando la provisión de garantías, que es el negocio y no deuda.",
    rango: "No hay umbral universal, pero la lectura es directa: hoy ronda el 3% — FMC casi no debe. Vigilar la tendencia más que el nivel.",
    fn: (c) => div(c.deudaReal, c.activo),
  },
  {
    id: "endeud_contable", nombre: "Endeudamiento contable", categoria: "endeudamiento", formato: "pct", bueno: "bajo",
    formula: "Pasivo total ÷ Activo total",
    explica: "El endeudamiento de libro de texto. En FMC sale ~93% y asusta — pero es un espejismo: el 97% de ese pasivo es la provisión de garantías, el objeto social del fondo, no deuda financiera.",
    rango: "Sin rango aplicable a FMC: el indicador clásico presupone que el pasivo es deuda. Se publica por completitud y SIEMPRE con su nota.",
    nota: "Engañoso si se lee como deuda: el 97% del pasivo es la provisión de garantías, que es el negocio del fondo y está respaldada por las inversiones. La deuda real es el indicador de arriba.",
    fn: (c) => div(c.pasivo, c.activo),
  },
  {
    id: "pasivo_patrimonio", nombre: "Pasivo / Patrimonio", categoria: "endeudamiento", formato: "veces", bueno: "bajo",
    formula: "Pasivo total ÷ Patrimonio total",
    explica: "Cuántas veces cabe el patrimonio en el pasivo. En una empresa normal más de 2x preocupa; en FMC sale alto por la misma razón del endeudamiento contable.",
    rango: "Sin rango aplicable a FMC (mismo motivo que el endeudamiento contable).",
    nota: "Mismo caso que el endeudamiento contable: mide la estructura del fondo, no su solvencia.",
    fn: (c) => div(c.pasivo, c.patrimTotal),
  },
  {
    id: "autonomia", nombre: "Autonomía", categoria: "endeudamiento", formato: "pct", bueno: "alto",
    formula: "Patrimonio total ÷ Activo",
    explica: "Qué parte del activo pertenece a los accionistas. Es el complemento del endeudamiento contable.",
    rango: "Sin rango aplicable: es baja por diseño del negocio, no por debilidad.",
    nota: "Bajo por diseño: el activo respalda la provisión de garantías, no al accionista.",
    fn: (c) => div(c.patrimTotal, c.activo),
  },

  // --- Eficiencia ---
  {
    id: "gastos_sobre_ing", nombre: "Gastos de administración sobre ingresos", categoria: "eficiencia", formato: "pct", bueno: "bajo",
    formula: "Gastos admin. (sin el costo de cobertura) ÷ Ingresos totales",
    explica: "De cada $100 que entran, cuántos se van en operar la empresa (nómina, honorarios, arriendos…). Más bajo = estructura más liviana.",
    rango: "Sin umbral universal — depende del tamaño y la etapa. La lectura útil: que NO crezca más rápido que los ingresos a lo largo de los meses.",
    fn: (c) => div(c.gastosAdmin, c.ingYTD),
  },
  {
    id: "gastos_sobre_contrib", nombre: "Gastos sobre contribución", categoria: "eficiencia", formato: "pct", bueno: "bajo",
    formula: "Gastos admin. ÷ Contribución total",
    explica: "De cada $100 que aportan los dos motores (cobertura + inversiones), cuántos consume la administración. Si supera 100%, la estructura se come toda la contribución.",
    rango: "Bien: menos de 100% · Mal: 100% o más. El 100% es definicional: en ese punto la administración consume todo lo que el negocio aporta.",
    evalua: (v) => (v < 1 ? "bien" : "mal"),
    fn: (c) => div(c.gastosAdmin, c.contribTotal),
  },
];

/** Todos los indicadores del período, con su valor del año anterior. */
export function indicadores(etq: string): Indicador[] {
  const c = ctx(etq);
  const py = D.sameMonthPrevYear(etq)?.etiqueta ?? null;
  const cPrev = py ? ctx(py) : null;
  return DEFS.map(({ fn, fnMes, evalua, explica, rango, ...def }) => ({
    ...def,
    valor: fn(c),
    prev: cPrev ? fn(cPrev) : null,
  }));
}

/** Agrupados por categoría, en el orden de CATEGORIAS. */
export function indicadoresPorCategoria(etq: string) {
  const todos = indicadores(etq);
  return CATEGORIAS.map((cat) => ({
    ...cat,
    indicadores: todos.filter((i) => i.categoria === cat.id),
  })).filter((c) => c.indicadores.length > 0);
}

export function indicadoresClave(etq: string) {
  return indicadores(etq).filter((i) => i.clave);
}

/* Indicadores INTERPRETADOS para el Cockpit: no un número pelado, sino su
   lectura (palabra + meta + tendencia vs. mes anterior). Curados a los que la
   Junta necesita. Donde no hay umbral defendible, no se inventa un nivel: se
   muestra solo la tendencia (honestidad > semáforo falso). */
export type IndCockpit = {
  id: string; nombre: string; valor: number; formato: Formato;
  nivel: Nivel | null; palabra: string | null; meta: string | null;
  deltaMes: number | null; bueno?: Direccion; nota?: string;
};
const META_CORTA: Record<string, string> = {
  cobertura: "meta ≥ 100%",
  razon_corriente: "meta ≥ 1,0",
  margen_ebitda: "meta > 0%",
  margen_neto: "meta > 0%",
  roa: "meta > 0%",
};
const PALABRA: Record<Nivel, string> = { bien: "Adecuado", regular: "En vigilancia", mal: "Bajo umbral" };
const PALABRA_ID: Record<string, Partial<Record<Nivel, string>>> = {
  cobertura: { bien: "Saludable", regular: "Margen estrecho", mal: "Insuficiente" },
  razon_corriente: { bien: "Holgada" },
};
export function indicadoresCockpit(etq: string): IndCockpit[] {
  // ROA y no ROE: el propio catálogo advierte que el ROE de FMC sale inflado
  // (patrimonio pequeño por diseño) y que el comparable es el ROA. El ROE sigue
  // disponible en la vista completa de Indicadores, siempre con su nota.
  const ORDEN = ["cobertura", "margen_ebitda", "margen_neto", "razon_corriente", "roa", "endeud_real"];
  const c = ctx(etq);
  const pm = D.prevPeriodo(etq)?.etiqueta ?? null;
  const cPrev = pm ? ctx(pm) : null;
  const byId = new Map(DEFS.map((d) => [d.id, d]));
  return ORDEN.flatMap((id) => {
    const d = byId.get(id);
    if (!d) return [];
    const v = d.fn(c);
    const nivel = d.evalua ? d.evalua(v) : null;
    const palabra = nivel ? (PALABRA_ID[id]?.[nivel] ?? PALABRA[nivel]) : null;
    return [{
      id, nombre: d.nombre, valor: v, formato: d.formato,
      nivel, palabra, meta: META_CORTA[id] ?? null,
      deltaMes: cPrev ? v - d.fn(cPrev) : null,
      bueno: d.bueno, nota: d.nota,
    }];
  });
}

/** Matriz para la vista por meses: indicador en fila, meses en columnas.
 *  - Los de flujo (ingresos) muestran el valor DEL MES y llevan Acumulado aparte.
 *  - Los de saldo/razón muestran su valor al cierre de cada mes; su columna
 *    final es el valor al cierre del último mes visible.
 *  - `niveles` trae el semáforo por celda (solo si el umbral es defendible). */
export function indicadoresMatriz(meses: { etiqueta: string; anio: number; mes: number }[]) {
  const ctxs = meses.map((m) => ctx(m.etiqueta));
  const ult = ctxs[ctxs.length - 1];
  return CATEGORIAS.map((cat) => ({
    ...cat,
    filas: DEFS.filter((d) => d.categoria === cat.id).map(({ fn, fnMes, evalua, ...def }) => {
      const vals = ctxs.map((c) => (fnMes ?? fn)(c));
      const acum = fn(ult);
      return {
        ...def,
        vals,
        acum,
        niveles: evalua ? vals.map((v) => evalua(v)) : null,
        nivelAcum: evalua ? evalua(acum) : null,
      };
    }),
  })).filter((c) => c.filas.length > 0);
}
