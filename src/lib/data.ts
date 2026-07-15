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

/* Parámetros de la provisión de renta (tabla `parametro`, editables desde /impuesto).
   Cambiarlos recalcula la provisión EN TODA la app: estados, dashboard e indicadores
   leen de aquí, no tienen copias. */
export let parametros: Record<string, number> = {};
export const paramNum = (clave: string, def = 0): number =>
  Number.isFinite(parametros[clave]) ? parametros[clave] : def;

/* Portafolio de inversiones (tabla `inversion`): los datos MANUALES de cada
   posición (tasa EA, fechas, observaciones) + su mapeo a auxiliares del PUC.
   El monto NUNCA se guarda: se calcula desde el balance del mes seleccionado. */
export type Inversion = {
  id: string; tipo: string; entidad: string; cuentas: string[];
  tasaEa: number; fechaApertura: string | null; fechaVencimiento: string | null;
  calificacion: string | null; renovar: string | null; observaciones: string | null;
  activa: boolean;
};
export let inversiones: Inversion[] = [];

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
    sql`select clave, valor from parametro`,
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
  parametros = {};
  for (const r of pr as any[]) {
    const v = Number(r.valor);
    if (Number.isFinite(v)) parametros[String(r.clave)] = v;
  }
  tasaImpuesto = paramNum("tasa_imporenta", 0.35);
  await cargarInversiones(sql);
}

/* La tabla `inversion` puede no existir aún (migración pendiente): en ese caso
   el portafolio queda vacío y la página lo indica, sin tumbar el resto de la app. */
async function cargarInversiones(sql: any): Promise<void> {
  try {
    const inv = await sql`select id, tipo, entidad, cuentas, tasa_ea, fecha_apertura, fecha_vencimiento,
                                 calificacion, renovar, observaciones, activa
                            from inversion order by id`;
    // Las fechas pueden llegar como Date (driver serverless) o como texto ISO
    // (driver pg local). String(Date) da "Wed Nov 21..." y recortarlo pierde el
    // año → JavaScript lo leía como 2001 y salían "vencidos hace 9.000 días".
    const fecha = (v: unknown): string | null =>
      !v ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    inversiones = (inv as any[]).map((r) => ({
      id: r.id, tipo: r.tipo, entidad: r.entidad, cuentas: r.cuentas ?? [],
      tasaEa: Number(r.tasa_ea) || 0,
      fechaApertura: fecha(r.fecha_apertura),
      fechaVencimiento: fecha(r.fecha_vencimiento),
      calificacion: r.calificacion ?? null, renovar: r.renovar ?? null,
      observaciones: r.observaciones ?? null, activa: !!r.activa,
    }));
  } catch {
    inversiones = [];
  }
}

/* Los parámetros de la provisión se refrescan en cada request (consulta mínima):
   sin esto, otra instancia del serverless seguiría sirviendo la tasa vieja después
   de guardar — el "bug del porcentaje anterior al cambiar de hoja". */
let ultimaCargaParams = 0;
async function refreshParametros(): Promise<void> {
  if (Date.now() - ultimaCargaParams < 2000) return; // colapsa ráfagas de una misma página
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  const pr = await sql`select clave, valor from parametro`;
  parametros = {};
  for (const r of pr as any[]) {
    const v = Number(r.valor);
    if (Number.isFinite(v)) parametros[String(r.clave)] = v;
  }
  tasaImpuesto = paramNum("tasa_imporenta", 0.35);
  await cargarInversiones(sql); // también editables desde la app → misma frescura
  ultimaCargaParams = Date.now();
}

export function ensureLoaded(): Promise<void> {
  if (!ready) {
    ready = loadFromNeon().then(buildIndexes).then(() => { ultimaCargaParams = Date.now(); });
    return ready;
  }
  return ready.then(refreshParametros);
}

/** Crea o actualiza una inversión en Neon (y en memoria). Valida en la acción. */
export async function guardarInversionDb(inv: Inversion): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL.");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  await sql`insert into inversion (id, tipo, entidad, cuentas, tasa_ea, fecha_apertura, fecha_vencimiento, calificacion, renovar, observaciones, activa)
            values (${inv.id}, ${inv.tipo}, ${inv.entidad}, ${inv.cuentas}, ${inv.tasaEa}, ${inv.fechaApertura}, ${inv.fechaVencimiento},
                    ${inv.calificacion}, ${inv.renovar}, ${inv.observaciones}, ${inv.activa})
            on conflict (id) do update set tipo=excluded.tipo, entidad=excluded.entidad, cuentas=excluded.cuentas,
              tasa_ea=excluded.tasa_ea, fecha_apertura=excluded.fecha_apertura, fecha_vencimiento=excluded.fecha_vencimiento,
              calificacion=excluded.calificacion, renovar=excluded.renovar, observaciones=excluded.observaciones, activa=excluded.activa`;
  const idx = inversiones.findIndex((x) => x.id === inv.id);
  if (idx >= 0) inversiones[idx] = inv;
  else inversiones = [...inversiones, inv].sort((a, b) => a.id.localeCompare(b.id));
}

/** Guarda parámetros en Neon y actualiza la copia en memoria de esta instancia. */
export async function guardarParametros(vals: Record<string, number>): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL.");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  for (const [clave, valor] of Object.entries(vals)) {
    if (!Number.isFinite(valor)) continue;
    await sql`insert into parametro (clave, valor) values (${clave}, ${JSON.stringify(valor)}::jsonb)
              on conflict (clave) do update set valor = excluded.valor`;
    parametros[clave] = valor;
  }
  tasaImpuesto = paramNum("tasa_imporenta", 0.35);
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

/** Meses a mostrar según los segmentadores: si hay año, todos los meses de ese año
 *  (con datos); si no, los últimos n meses hasta el período seleccionado. */
export function mesesVista(etq: string, anio?: number, n = 4): Periodo[] {
  if (anio) return periodos.filter((p) => p.anio === anio);
  return ultimosPeriodos(etq, n);
}

/** Comparación interanual: el MISMO mes en todos los años de funcionamiento
 *  (p. ej. Mayo 2023, 2024, 2025, 2026). */
export function mesesInteranual(mes: number): Periodo[] {
  return periodos.filter((p) => p.mes === mes);
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
