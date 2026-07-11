// Capa de acceso a datos — lee de Neon (Postgres). Server-only.
// Carga todo el dataset una vez por instancia (cacheado) y sirve en memoria,
// para que el motor de estados siga siendo síncrono.
import "server-only";

export type Cuenta = {
  codigo: string; nombre: string; clase: number; longitud: number;
  naturaleza: "debito" | "credito"; padre: string | null; es_hoja: boolean;
};
export type Periodo = { etiqueta: string; anio: number; mes: number };

export const entidad = "FMC S.A.S.";
export const moneda = "COP";

// Estado del módulo (poblado por ensureLoaded)
export let cuentas: Cuenta[] = [];
export let periodos: Periodo[] = [];
export let tasaImpuesto = 0.35;
export let cuentaByCodigo = new Map<string, Cuenta>();

let childrenMap = new Map<string, Cuenta[]>();
let facts: Record<string, Record<string, number>> = {};
let ready: Promise<void> | null = null;

function buildIndexes() {
  cuentaByCodigo = new Map(cuentas.map((c) => [c.codigo, c]));
  childrenMap = new Map();
  for (const c of cuentas) {
    if (c.padre) {
      const arr = childrenMap.get(c.padre) ?? [];
      arr.push(c);
      childrenMap.set(c.padre, arr);
    }
  }
  for (const arr of childrenMap.values()) arr.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

async function loadFromNeon() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL. Configura .env.local (local) o la variable en Vercel (producción).");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);

  const [cu, pe, fa, pr] = await Promise.all([
    sql`select codigo_puc, nombre, clase, longitud, naturaleza, codigo_padre, es_hoja from dim_cuenta order by codigo_puc`,
    sql`select etiqueta, anio, mes from dim_periodo order by anio, mes`,
    sql`select dp.etiqueta, dc.codigo_puc, fs.movimiento_mes
        from fact_saldo fs
        join dim_cuenta dc on dc.cuenta_id = fs.cuenta_id
        join dim_periodo dp on dp.periodo_id = fs.periodo_id`,
    sql`select valor from parametro where clave = 'tasa_imporenta'`,
  ]);

  cuentas = (cu as any[]).map((r) => ({
    codigo: String(r.codigo_puc), nombre: r.nombre, clase: Number(r.clase), longitud: Number(r.longitud),
    naturaleza: r.naturaleza, padre: r.codigo_padre ?? null, es_hoja: !!r.es_hoja,
  }));
  periodos = (pe as any[]).map((r) => ({ etiqueta: r.etiqueta, anio: Number(r.anio), mes: Number(r.mes) }));
  facts = {};
  for (const r of fa as any[]) {
    (facts[r.etiqueta] ??= {})[String(r.codigo_puc)] = Number(r.movimiento_mes);
  }
  if ((pr as any[])[0]) tasaImpuesto = Number((pr as any[])[0].valor);
}

export function ensureLoaded(): Promise<void> {
  if (!ready) ready = loadFromNeon().then(buildIndexes);
  return ready;
}

export const children = (codigo: string): Cuenta[] => childrenMap.get(codigo) ?? [];
export const latest = (): Periodo => periodos[periodos.length - 1];
export const periodo = (etq?: string): Periodo => periodos.find((p) => p.etiqueta === etq) ?? latest();
export const fact = (etq: string, codigo: string): number => facts[etq]?.[codigo] ?? 0;

export function ytd(etq: string, codigo: string): number {
  const p = periodo(etq);
  let s = 0;
  for (const q of periodos) if (q.anio === p.anio && q.mes <= p.mes) s += fact(q.etiqueta, codigo);
  return s;
}

export function ultimosPeriodos(etq: string, n: number): Periodo[] {
  const idx = periodos.findIndex((p) => p.etiqueta === etq);
  const end = idx < 0 ? periodos.length : idx + 1;
  return periodos.slice(Math.max(0, end - n), end);
}

// Comparativos: mes anterior y mismo mes del año anterior (variaciones y flujo de efectivo).
export function prevPeriodo(etq: string): Periodo | null {
  const idx = periodos.findIndex((p) => p.etiqueta === etq);
  return idx > 0 ? periodos[idx - 1] : null;
}
export function sameMonthPrevYear(etq: string): Periodo | null {
  const p = periodo(etq);
  return periodos.find((q) => q.anio === p.anio - 1 && q.mes === p.mes) ?? null;
}
