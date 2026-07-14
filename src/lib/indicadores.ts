import "server-only";
import * as D from "./data";

/*
  Catálogo de indicadores financieros de FMC.

  Para AÑADIR un indicador: agrega una entrada a DEFS. Nada más.
  Las categorías se derivan solas y la UI no se toca.

  Contexto de negocio (ver también statements.ts):
  FMC es una garantizadora, no una empresa operativa. El 97,5% del pasivo es la
  provisión de garantías (2640) — es el negocio, NO deuda. Por eso los indicadores
  clásicos de endeudamiento engañan y llevan `nota` obligatoria.
*/

export const CUENTAS = {
  EFECTIVO: "11",
  INVERSIONES: "12",
  DEUDORES: "13",
  INVENTARIOS: "14",
  GARANTIAS: "2640",
  ING_COBERTURA: "4180",
  ING_FINANCIERO: "4150",
  COSTO_COBERTURA: "5199150101",
  GASTOS_ADMIN: "51",
} as const;

/** Clasificación corriente / no corriente.
 *  NO existe en los datos: es una decisión de presentación validada con el
 *  analista (2026-07-14). Inversiones (CDT/fiducias) y la provisión de
 *  garantías se consideran CORRIENTES: la obligación es exigible y el respaldo
 *  es líquido. Cambiar esto mueve la razón corriente entre 0,10 y 3,58. */
const ACTIVO_CORRIENTE = ["11", "12", "13", "14"];
const PASIVO_CORRIENTE_TODO = true;

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
  { id: "contribucion", nombre: "Contribución", desc: "¿De dónde sale la utilidad: de cubrir o de invertir?" },
  { id: "rentabilidad", nombre: "Rentabilidad", desc: "¿Cuánto rinde lo que se hace?" },
  { id: "liquidez", nombre: "Liquidez", desc: "¿Hay con qué responder en el corto plazo?" },
  { id: "endeudamiento", nombre: "Endeudamiento", desc: "¿Cuánto se debe de verdad?" },
  { id: "eficiencia", nombre: "Eficiencia", desc: "¿Cuánto cuesta operar y cómo crece?" },
] as const;

/** Todo lo que un indicador puede necesitar, ya calculado una vez. */
type Ctx = {
  activo: number; pasivo: number; patrim: number;
  efectivo: number; inversiones: number; deudores: number;
  activoCte: number; pasivoCte: number;
  garantias: number; respaldo: number; deudaReal: number;
  ingYTD: number; gasYTD: number; resYTD: number;
  ingCob: number; costoCob: number; ingFin: number;
  gastosAdmin: number; contribCob: number; contribInv: number; contribTotal: number;
};

function ctx(etq: string): Ctx {
  const f = (c: string) => D.fact(etq, c);
  const y = (c: string) => D.ytd(etq, c);
  const efectivo = f(CUENTAS.EFECTIVO);
  const inversiones = f(CUENTAS.INVERSIONES);
  const deudores = f(CUENTAS.DEUDORES);
  const activo = f("1"), pasivo = f("2"), patrim = f("3");
  const garantias = f(CUENTAS.GARANTIAS);
  const ingCob = y(CUENTAS.ING_COBERTURA);
  const costoCob = y(CUENTAS.COSTO_COBERTURA);
  const ingFin = y(CUENTAS.ING_FINANCIERO);
  const gastosAdmin = y(CUENTAS.GASTOS_ADMIN) - costoCob; // admin REALES
  const ingYTD = y("4"), gasYTD = y("5");
  const contribCob = ingCob - costoCob;
  return {
    activo, pasivo, patrim, efectivo, inversiones, deudores,
    activoCte: ACTIVO_CORRIENTE.reduce((s, c) => s + f(c), 0),
    pasivoCte: PASIVO_CORRIENTE_TODO ? pasivo : pasivo - garantias,
    garantias, respaldo: inversiones + efectivo, deudaReal: pasivo - garantias,
    ingYTD, gasYTD, resYTD: ingYTD - gasYTD,
    ingCob, costoCob, ingFin, gastosAdmin,
    contribCob, contribInv: ingFin, contribTotal: contribCob + ingFin,
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
  {
    id: "respaldo_liquido", nombre: "Respaldo en efectivo", categoria: "solidez", formato: "pct", bueno: "alto",
    formula: "Efectivo ÷ Obligaciones de garantías",
    fn: (c) => div(c.efectivo, c.garantias),
  },

  // --- Contribución: los dos motores ---
  {
    id: "contrib_cobertura", nombre: "Aporte de cobertura", categoria: "contribucion", formato: "pct", clave: true,
    formula: "Contribución de cobertura ÷ Contribución total",
    fn: (c) => div(c.contribCob, c.contribTotal),
  },
  {
    id: "contrib_inversiones", nombre: "Aporte de inversiones", categoria: "contribucion", formato: "pct", clave: true,
    formula: "Rendimiento de inversiones ÷ Contribución total",
    fn: (c) => div(c.contribInv, c.contribTotal),
  },
  {
    id: "margen_cobertura", nombre: "Margen de cobertura", categoria: "contribucion", formato: "pct", bueno: "alto",
    formula: "(Ingresos de cobertura − Costo de cobertura) ÷ Ingresos de cobertura",
    fn: (c) => div(c.contribCob, c.ingCob),
  },
  {
    id: "siniestralidad", nombre: "Costo de cobertura sobre ingresos", categoria: "contribucion", formato: "pct", bueno: "bajo",
    formula: "Costo de cobertura ÷ Ingresos de cobertura",
    fn: (c) => div(c.costoCob, c.ingCob),
  },
  {
    id: "rend_inversiones", nombre: "Rendimiento de las inversiones", categoria: "contribucion", formato: "pct", bueno: "alto",
    formula: "Rendimiento financiero (año) ÷ Inversiones",
    fn: (c) => div(c.ingFin, c.inversiones),
  },

  // --- Rentabilidad ---
  { id: "margen_neto", nombre: "Margen neto", categoria: "rentabilidad", formato: "pct", bueno: "alto", formula: "Utilidad antes de impuestos ÷ Ingresos totales", fn: (c) => div(c.resYTD, c.ingYTD) },
  { id: "roa", nombre: "ROA", categoria: "rentabilidad", formato: "pct", bueno: "alto", formula: "Utilidad ÷ Activos totales", fn: (c) => div(c.resYTD, c.activo) },
  {
    id: "roe", nombre: "ROE", categoria: "rentabilidad", formato: "pct", bueno: "alto",
    formula: "Utilidad ÷ Patrimonio",
    nota: "Está inflado: el patrimonio de FMC es mínimo frente al activo, porque el activo respalda la provisión de garantías, no al accionista. El ROA es el número comparable.",
    fn: (c) => div(c.resYTD, c.patrim),
  },

  // --- Liquidez ---
  {
    id: "razon_corriente", nombre: "Razón corriente", categoria: "liquidez", formato: "veces", bueno: "alto",
    formula: "Activo corriente ÷ Pasivo corriente",
    nota: "La clasificación corriente/no corriente no viene en el balance de prueba: se define en la app. Hoy inversiones y provisión de garantías cuentan como corrientes.",
    fn: (c) => div(c.activoCte, c.pasivoCte),
  },
  {
    id: "prueba_acida", nombre: "Prueba ácida", categoria: "liquidez", formato: "veces", bueno: "alto",
    formula: "(Efectivo + Inversiones) ÷ Pasivo corriente",
    fn: (c) => div(c.efectivo + c.inversiones, c.pasivoCte),
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
    formula: "Pasivo total ÷ Patrimonio",
    nota: "Mismo caso que el endeudamiento contable: mide la estructura del fondo, no su solvencia.",
    fn: (c) => div(c.pasivo, c.patrim),
  },
  { id: "autonomia", nombre: "Autonomía", categoria: "endeudamiento", formato: "pct", bueno: "alto", formula: "Patrimonio ÷ Activo", nota: "Bajo por diseño: el activo respalda la provisión de garantías, no al accionista.", fn: (c) => div(c.patrim, c.activo) },

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
