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
    ingMesPrev: pm ? D.fact(pm, "4") : 0, gasMesPrev: pm ? D.fact(pm, "5") : 0,
  };
}

const div = (a: number, b: number) => (b ? a / b : 0);

type Def = Omit<Indicador, "valor" | "prev"> & { fn: (c: Ctx) => number };

/* ============ EL CATÁLOGO — añade aquí y ya ============ */
const DEFS: Def[] = [
  // --- Solidez y cobertura: lo que de verdad mide a FMC ---
  {
    id: "cobertura", nombre: "Razón de cobertura", categoria: "solidez", formato: "pct", bueno: "alto", clave: true,
    formula: "(Inversiones + Efectivo) ÷ Obligaciones de garantías",
    fn: (c) => div(c.respaldo, c.garantias),
  },
  {
    id: "excedente", nombre: "Excedente de respaldo", categoria: "solidez", formato: "cop", bueno: "alto", clave: true,
    formula: "(Inversiones + Efectivo) − Obligaciones de garantías",
    fn: (c) => c.respaldo - c.garantias,
  },

  // --- Ingresos: las dos vías y lo que le queda al fondo ---
  {
    id: "ing_cobertura", nombre: "Ingresos por cobertura de créditos", categoria: "ingresos", formato: "cop", bueno: "alto", clave: true,
    formula: "Comisiones de cobertura acumuladas del año (cuenta 4180)",
    fn: (c) => c.ingCob,
  },
  {
    id: "ing_inversiones", nombre: "Ingresos por inversiones", categoria: "ingresos", formato: "cop", bueno: "alto", clave: true,
    formula: "Rendimientos financieros acumulados del año (cuenta 4150)",
    fn: (c) => c.ingFin,
  },
  {
    id: "margen_cobertura", nombre: "Margen de cobertura", categoria: "ingresos", formato: "pct", bueno: "alto",
    formula: "De cada $100 que entran por coberturas, esto es lo que le queda al fondo después de pagar el costo de cobertura (siniestros): (Ingresos de cobertura − Costo de cobertura) ÷ Ingresos de cobertura",
    fn: (c) => div(c.contribCob, c.ingCob),
  },

  // --- Rentabilidad ---
  { id: "margen_bruto", nombre: "Margen bruto", categoria: "rentabilidad", formato: "pct", bueno: "alto", formula: "(Contribución de cobertura + inversiones) ÷ Ingresos totales", fn: (c) => div(c.contribTotal, c.ingYTD) },
  {
    id: "margen_ebitda", nombre: "Margen EBITDA", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "(Utilidad antes de impuestos + Depreciaciones + Amortizaciones) ÷ Ingresos totales",
    fn: (c) => div(c.utilAntes + c.depAmort, c.ingYTD),
  },
  {
    id: "margen_operativo", nombre: "Margen operativo", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "(Ingresos ordinarios − Gastos de administración y ventas) ÷ Ingresos ordinarios",
    fn: (c) => div(c.ingOrd - (c.gastosAdmin + c.costoCob) - c.gasVentas, c.ingOrd),
  },
  { id: "margen_neto", nombre: "Margen neto", categoria: "rentabilidad", formato: "pct", bueno: "alto", formula: "Utilidad neta (después de la provisión de renta) ÷ Ingresos totales", fn: (c) => div(c.utilNeta, c.ingYTD) },
  { id: "roa", nombre: "ROA", categoria: "rentabilidad", formato: "pct", bueno: "alto", formula: "Utilidad neta ÷ Activos totales", fn: (c) => div(c.utilNeta, c.activo) },
  {
    id: "roe", nombre: "ROE", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "Utilidad neta ÷ Patrimonio total (incluida la utilidad)",
    nota: "Está inflado: el patrimonio de FMC es mínimo frente al activo, porque el activo respalda la provisión de garantías, no al accionista. El ROA es el número comparable.",
    fn: (c) => div(c.utilNeta, c.patrimTotal),
  },

  // --- Crecimiento (mes contra mes anterior) ---
  {
    id: "crec_ing_mes", nombre: "Variación de ingresos (vs mes anterior)", categoria: "crecimiento", formato: "pct", bueno: "alto",
    formula: "(Ingresos del mes − Ingresos del mes anterior) ÷ Ingresos del mes anterior",
    fn: (c) => div(c.ingMes - c.ingMesPrev, Math.abs(c.ingMesPrev)),
  },
  {
    id: "crec_gas_mes", nombre: "Variación de gastos (vs mes anterior)", categoria: "crecimiento", formato: "pct", bueno: "bajo",
    formula: "(Gastos del mes − Gastos del mes anterior) ÷ Gastos del mes anterior",
    fn: (c) => div(c.gasMes - c.gasMesPrev, Math.abs(c.gasMesPrev)),
  },

  // --- Liquidez ---
  {
    id: "razon_corriente", nombre: "Razón corriente", categoria: "liquidez", formato: "veces", bueno: "alto",
    formula: "Activo corriente ÷ Pasivo corriente",
    nota: "La clasificación corriente/no corriente no viene en el balance de prueba: se define en la app. Hoy inversiones y provisión de garantías cuentan como corrientes.",
    fn: (c) => div(c.activoCte, c.pasivoCte),
  },
  { id: "capital_trabajo", nombre: "Capital de trabajo", categoria: "liquidez", formato: "cop", bueno: "alto", formula: "Activo corriente − Pasivo corriente", fn: (c) => c.activoCte - c.pasivoCte },

  // --- Endeudamiento ---
  {
    id: "endeud_real", nombre: "Endeudamiento real", categoria: "endeudamiento", formato: "pct", bueno: "bajo", clave: true,
    formula: "(Pasivo − Provisión de garantías) ÷ Activo",
    fn: (c) => div(c.deudaReal, c.activo),
  },
  {
    id: "endeud_contable", nombre: "Endeudamiento contable", categoria: "endeudamiento", formato: "pct", bueno: "bajo",
    formula: "Pasivo total ÷ Activo total",
    nota: "Engañoso si se lee como deuda: el 97% del pasivo es la provisión de garantías, que es el negocio del fondo y está respaldada por las inversiones. La deuda real es el indicador de arriba.",
    fn: (c) => div(c.pasivo, c.activo),
  },
  {
    id: "pasivo_patrimonio", nombre: "Pasivo / Patrimonio", categoria: "endeudamiento", formato: "veces", bueno: "bajo",
    formula: "Pasivo total ÷ Patrimonio total",
    nota: "Mismo caso que el endeudamiento contable: mide la estructura del fondo, no su solvencia.",
    fn: (c) => div(c.pasivo, c.patrimTotal),
  },
  { id: "autonomia", nombre: "Autonomía", categoria: "endeudamiento", formato: "pct", bueno: "alto", formula: "Patrimonio total ÷ Activo", nota: "Bajo por diseño: el activo respalda la provisión de garantías, no al accionista.", fn: (c) => div(c.patrimTotal, c.activo) },

  // --- Eficiencia ---
  { id: "gastos_sobre_ing", nombre: "Gastos de administración sobre ingresos", categoria: "eficiencia", formato: "pct", bueno: "bajo", formula: "Gastos admin. (sin el costo de cobertura) ÷ Ingresos totales", fn: (c) => div(c.gastosAdmin, c.ingYTD) },
  { id: "gastos_sobre_contrib", nombre: "Gastos sobre contribución", categoria: "eficiencia", formato: "pct", bueno: "bajo", formula: "Gastos admin. ÷ Contribución total", fn: (c) => div(c.gastosAdmin, c.contribTotal) },
];

/** Todos los indicadores del período, con su valor del año anterior. */
export function indicadores(etq: string): Indicador[] {
  const c = ctx(etq);
  const py = D.sameMonthPrevYear(etq)?.etiqueta ?? null;
  const cPrev = py ? ctx(py) : null;
  return DEFS.map(({ fn, ...def }) => ({
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

/** Matriz para la vista por meses: cada indicador en fila, cada mes en columna. */
export function indicadoresMatriz(meses: { etiqueta: string; anio: number; mes: number }[]) {
  const ctxs = meses.map((m) => ctx(m.etiqueta));
  return CATEGORIAS.map((cat) => ({
    ...cat,
    filas: DEFS.filter((d) => d.categoria === cat.id).map(({ fn, ...def }) => ({
      ...def,
      vals: ctxs.map((c) => fn(c)),
    })),
  })).filter((c) => c.filas.length > 0);
}
