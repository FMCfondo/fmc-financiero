/* Carga del presupuesto de un año desde la hoja «PPTO <año>» del libro de la Junta.
 *
 * Lógica PURA, sin acceso a datos ni a servidor: la usa el navegador (extraer) y el
 * servidor (proponer), y se prueba sola contra la hoja real. Sustituye al extractor
 * Python que emitía el JSON para scripts/migrate-ppto.mjs, con una diferencia de
 * fondo: el extractor tenía que DEDUCIR la estructura; aquí se HEREDA.
 *
 * Del Excel salen solo las cosas que cambian cada año: la etiqueta, el nivel de
 * agrupación (el outline de Excel, que SheetJS entrega en `!rows[].level`), los doce
 * meses y el total. La estructura —si es total o detalle, su clase, la fórmula del
 * estado de resultados y el mapeo a cuentas PUC— se hereda del último año cargado,
 * casando cada fila por (nivel, etiqueta). Lo que no casa entra como detalle nuevo,
 * sin cuentas, y se reporta para que el analista lo mapee.
 *
 * Las filas del informe que dependen de una fórmula concreta (ing_operacion,
 * gastos_admin, ebitda, util_neta) se verifican ANTES de escribir: si el año nuevo
 * cambió un rótulo estructural, la carga se detiene y lo dice, porque el informe de
 * Junta se rompería en silencio.
 */

export type FilaLeida = {
  /** Fila de la hoja (1-based), para señalar problemas donde el analista los ve. */
  fila: number;
  nivel: number;
  etiqueta: string;
  /** Doce valores ENE..DIC; las celdas vacías o no numéricas van en 0. */
  meses: number[];
  total: number;
};

/** Lo que el heredado necesita saber del año anterior. Es un subconjunto de
 *  `PptoLinea` (data.ts) para no arrastrar `server-only` a este módulo. */
export type LineaPrevia = {
  orden: number; nivel: number; etiqueta: string;
  tipo: "detalle" | "total"; clase: "ingreso" | "gasto" | "resultado";
  nota: string | null; cuentas: string[]; formula: string | null;
};

export type FilaPropuesta = Omit<LineaPrevia, "orden"> & {
  orden: number;
  meses: number[];
  total: number;
  /** Cómo se resolvió la estructura: exacta = misma (nivel, etiqueta) que el año
   *  anterior; aproximada = coincide al quitar años y paréntesis; nueva = no estaba. */
  origen: "exacta" | "aproximada" | "nueva";
  /** La etiqueta del año anterior de la que heredó, cuando fue aproximada. */
  heredaDe?: string;
};

const MESES_RE = /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)/i;
const ORDEN_MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const texto = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** Etiqueta normalizada para casar: sin acentos, mayúsculas, espacios colapsados. */
export const clave = (etiqueta: string) =>
  etiqueta.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
/** Segunda oportunidad: además sin años ni paréntesis («…(Foro ODEMA 2026)»). */
export const claveLaxa = (etiqueta: string) =>
  clave(etiqueta.replace(/\([^)]*\)/g, " ").replace(/\b(19|20)\d{2}\b/g, " ")).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Lee la hoja ya convertida a matriz (SheetJS `sheet_to_json` con header:1, raw:true)
 * más los niveles de outline por fila. Devuelve las filas del P&L presupuestado hasta
 * «UTILIDAD NETA» inclusive; lo que hay después (márgenes, notas) se ignora y se lista.
 */
export function extraerHojaPpto(aoa: unknown[][], niveles: number[]): {
  filas: FilaLeida[]; anioHoja: number | null; ignoradas: string[]; error?: string;
} {
  // 1. La cabecera: la fila con los doce meses.
  let hdr = -1;
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const celdas = (aoa[i] ?? []).map((v) => texto(v).toUpperCase());
    if (celdas.filter((c) => MESES_RE.test(c)).length >= 12) { hdr = i; break; }
  }
  if (hdr < 0) return { filas: [], anioHoja: null, ignoradas: [], error: "No encontré la fila de cabecera con los doce meses (ENERO … DICIEMBRE)." };

  const cab = (aoa[hdr] ?? []).map((v) => texto(v).toUpperCase());
  // Columna de cada mes, en orden calendario aunque la hoja las traiga desordenadas.
  const colMes = ORDEN_MESES.map((m) => cab.findIndex((c) => c.startsWith(m)));
  if (colMes.some((c) => c < 0)) return { filas: [], anioHoja: null, ignoradas: [], error: "La cabecera no trae los doce meses completos." };
  const colTotal = cab.findIndex((c) => /^TOTAL/.test(c));
  const anioHoja = (() => { const m = cab.join(" ").match(/\b(20\d{2})\b/); return m ? Number(m[1]) : null; })();

  // 2. La columna de etiquetas: la de texto más poblada que no sea de meses.
  const cuenta = new Map<number, number>();
  for (let i = hdr + 1; i < aoa.length; i++)
    (aoa[i] ?? []).forEach((v, j) => { if (texto(v) && !colMes.includes(j) && j !== colTotal) cuenta.set(j, (cuenta.get(j) ?? 0) + 1); });
  const colEtq = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (colEtq === undefined) return { filas: [], anioHoja, ignoradas: [], error: "No encontré la columna de conceptos." };

  // 3. Las filas, hasta UTILIDAD NETA inclusive.
  const filas: FilaLeida[] = [];
  const ignoradas: string[] = [];
  let cerrado = false;
  for (let i = hdr + 1; i < aoa.length; i++) {
    const etiqueta = texto(aoa[i]?.[colEtq]);
    if (!etiqueta) continue;
    if (cerrado) { ignoradas.push(etiqueta); continue; }
    const meses = colMes.map((c) => num(aoa[i]?.[c]));
    const totalCelda = colTotal >= 0 ? aoa[i]?.[colTotal] : undefined;
    const total = typeof totalCelda === "number" ? totalCelda : meses.reduce((s, x) => s + x, 0);
    filas.push({ fila: i + 1, nivel: niveles[i] ?? 0, etiqueta, meses, total });
    if (/^UTILIDAD NETA\b/.test(clave(etiqueta))) cerrado = true;
  }
  if (!cerrado) return { filas, anioHoja, ignoradas, error: "La hoja no tiene una fila «UTILIDAD NETA»: no puedo saber dónde termina el estado de resultados." };
  return { filas, anioHoja, ignoradas };
}

/** Fórmulas que el informe asume ÚNICAS (ver informe-ppto.ts). */
const UNICAS = ["ing_operacion", "gastos_admin", "util_neta"];

/**
 * Cruza las filas leídas con el año anterior y arma las filas a guardar. Cada fila
 * previa se usa UNA sola vez y en orden, para que las etiquetas repetidas dentro del
 * mismo año («Provisiones» en nivel 0 y 1, «Ajuste al peso» dos veces) caigan en la
 * pareja correcta.
 */
export function proponerCarga(filas: FilaLeida[], previo: LineaPrevia[]): {
  propuestas: FilaPropuesta[];
  /** Filas del año anterior que no encontraron pareja: desaparecieron del plan. */
  huerfanas: LineaPrevia[];
  /** Lo que impide cargar (estructura rota). */
  problemas: string[];
  /** Lo que conviene mirar pero no impide cargar. */
  avisos: string[];
} {
  const libres = [...previo].sort((a, b) => a.orden - b.orden);
  const tomar = (pred: (p: LineaPrevia) => boolean) => {
    const i = libres.findIndex(pred);
    return i < 0 ? null : libres.splice(i, 1)[0];
  };

  const propuestas: FilaPropuesta[] = filas.map((f, idx) => {
    const base = { orden: idx + 1, nivel: f.nivel, etiqueta: f.etiqueta, meses: f.meses, total: f.total };
    const exacta = tomar((p) => p.nivel === f.nivel && clave(p.etiqueta) === clave(f.etiqueta));
    if (exacta) return { ...base, tipo: exacta.tipo, clase: exacta.clase, nota: exacta.nota, cuentas: exacta.cuentas, formula: exacta.formula, origen: "exacta" };
    const laxa = tomar((p) => p.nivel === f.nivel && claveLaxa(p.etiqueta) === claveLaxa(f.etiqueta));
    if (laxa) return { ...base, tipo: laxa.tipo, clase: laxa.clase, nota: laxa.nota, cuentas: laxa.cuentas, formula: laxa.formula, origen: "aproximada", heredaDe: laxa.etiqueta };
    return { ...base, tipo: "detalle", clase: "gasto", nota: null, cuentas: [], formula: null, origen: "nueva" };
  });

  const problemas: string[] = [];
  const avisos: string[] = [];
  if (!filas.length) problemas.push("La hoja no trae filas.");

  // Estructura que el informe necesita, verificada sobre la PROPUESTA (antes de escribir).
  for (const f of UNICAS) {
    const n = propuestas.filter((p) => p.formula === f).length;
    if (n === 0) problemas.push(`Ningún renglón heredó la fórmula «${f}»: cambió el rótulo de un total estructural. Ajusta la etiqueta en la hoja para que coincida con el año anterior.`);
    if (n > 1) problemas.push(`La fórmula «${f}» quedó en ${n} renglones; el informe asume uno solo.`);
  }
  if (!propuestas.some((p) => p.formula === "ebitda" && clave(p.etiqueta) === "EBITDA"))
    problemas.push("Falta el renglón rotulado exactamente «EBITDA» con su fórmula: el informe lo busca por ese nombre.");

  const nuevas = propuestas.filter((p) => p.origen === "nueva");
  if (nuevas.length) avisos.push(`${nuevas.length} renglón(es) nuevo(s) sin cuentas PUC: ${nuevas.map((p) => `«${p.etiqueta}»`).join(", ")}. Entran como detalle; mapéalos en Estados Financieros › Resultados › mapeo.`);
  const aprox = propuestas.filter((p) => p.origen === "aproximada");
  if (aprox.length) avisos.push(`${aprox.length} renglón(es) heredaron por parecido: ${aprox.map((p) => `«${p.etiqueta}» ← «${p.heredaDe}»`).join("; ")}.`);
  const sinMeses = propuestas.filter((p) => p.tipo === "detalle" && !p.formula && p.meses.every((v) => v === 0) && p.total === 0);
  if (sinMeses.length) avisos.push(`${sinMeses.length} renglón(es) vienen en cero todo el año (normal si el rubro no se presupuestó).`);
  if (libres.length) avisos.push(`${libres.length} renglón(es) del año anterior no aparecen en la hoja: ${libres.map((p) => `«${p.etiqueta}»`).join(", ")}. Se pierden con su mapeo.`);

  return { propuestas, huerfanas: libres, problemas, avisos };
}
