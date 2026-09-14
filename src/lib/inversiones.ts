import "server-only";
import * as D from "./data";

/*
  Motor del Portafolio de Inversiones.

  Modelo (validado con el analista y con la investigación de tesorería):
  - El MONTO de cada posición se calcula del balance del mes seleccionado:
    suma de sus auxiliares (capital + intereses causados). Nunca se digita.
  - Lo manual vive en la tabla `inversion`: tasa E.A., fechas, observaciones.
  - Fiducias y bolsillos son "a la vista" (sin vencimiento, WAM = 1 día).
  - Los CDT tienen ciclo de renovación: la app semaforiza el vencimiento
    contra la fecha de HOY (operativo), aunque los montos sean del corte.
*/

export type EstadoVenc = "vista" | "vigente" | "por_vencer" | "decision" | "vencido";

export type Posicion = Omit<D.Inversion, "tasaEa"> & {
  monto: number;
  pct: number;
  /** La tasa que RIGE en el mes del corte: la pactada si es CDT, la capturada para
   *  ese mes si es a la vista. null = falta capturarla; se imprime raya, nunca cero. */
  tasaEa: number | null;
  /** Interés estimado del mes: monto × ((1+EA)^(1/12) − 1). null si falta la tasa. */
  interesMes: number | null;
  /** Interés estimado hasta el vencimiento (solo CDT). */
  interesAlVenc: number | null;
  diasPlazo: number | null;
  diasRestantes: number | null;
  estadoVenc: EstadoVenc;
};

const DIA = 86_400_000;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const dias = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / DIA);

function estadoDe(diasRestantes: number | null): EstadoVenc {
  if (diasRestantes === null) return "vista";
  if (diasRestantes < 0) return "vencido";
  if (diasRestantes <= 10) return "decision";
  if (diasRestantes <= 30) return "por_vencer";
  return "vigente";
}

export function portafolio(etq: string) {
  const hoy = hoyISO();
  const per = D.periodo(etq);
  const activas = D.inversiones.filter((i) => i.activa);

  const posiciones: Posicion[] = activas.map((inv) => {
    const monto = inv.cuentas.reduce((s, c) => s + D.fact(etq, c), 0);
    const tasa = D.tasaDe(inv, per.anio, per.mes);
    const mensual = tasa === null ? null : (1 + tasa) ** (1 / 12) - 1;
    const diasRestantes = inv.fechaVencimiento ? dias(hoy, inv.fechaVencimiento) : null;
    const diasPlazo = inv.fechaApertura && inv.fechaVencimiento ? dias(inv.fechaApertura, inv.fechaVencimiento) : null;
    return {
      ...inv,
      tasaEa: tasa,
      monto,
      pct: 0,
      interesMes: mensual === null ? null : monto * mensual,
      interesAlVenc:
        diasRestantes !== null && diasRestantes > 0
          ? monto * ((1 + (tasa ?? 0)) ** (diasRestantes / 365) - 1)
          : null,
      diasPlazo,
      diasRestantes,
      estadoVenc: estadoDe(diasRestantes),
    };
  }).sort((a, b) => b.monto - a.monto);

  const total = posiciones.reduce((s, p) => s + p.monto, 0) || 1;
  posiciones.forEach((p) => (p.pct = p.monto / total));

  // --- KPIs ---
  /* Sin la tasa de UNA posición con saldo, la ponderada no se puede afirmar: se
     devuelve null y se dice cuáles faltan. Promediar solo las que hay daría una
     cifra que parece completa y no lo es. */
  const tasasFaltantes = posiciones.filter((p) => p.monto !== 0 && p.tasaEa === null).map((p) => p.entidad);
  const tasaPonderada = tasasFaltantes.length
    ? null
    : posiciones.reduce((s, p) => s + p.monto * (p.tasaEa ?? 0), 0) / total;
  const liquidas = posiciones.filter((p) => p.diasRestantes === null);
  const pctLiquido = liquidas.reduce((s, p) => s + p.monto, 0) / total;
  // WAM: a la vista cuenta 1 día (convención de money market funds).
  const wamDias = posiciones.reduce((s, p) => s + p.monto * Math.max(p.diasRestantes ?? 1, 1), 0) / total;
  const conVenc = posiciones.filter((p) => p.diasRestantes !== null && p.diasRestantes >= 0)
    .sort((a, b) => (a.diasRestantes as number) - (b.diasRestantes as number));
  const proxVenc = conVenc[0] ?? null;
  const interesMesTotal = posiciones.reduce((s, p) => s + (p.interesMes ?? 0), 0);

  // --- Concentración por entidad ---
  const porEntidadMap = new Map<string, number>();
  for (const p of posiciones) porEntidadMap.set(p.entidad, (porEntidadMap.get(p.entidad) ?? 0) + p.monto);
  const porEntidad = [...porEntidadMap.entries()]
    .map(([name, value]) => ({ name, value, pct: value / total }))
    .sort((a, b) => b.value - a.value);
  const top1 = porEntidad[0]?.pct ?? 0;
  const top3 = porEntidad.slice(0, 3).reduce((s, e) => s + e.pct, 0);

  // --- Resumen por tipo ---
  const porTipoMap = new Map<string, { monto: number; n: number; tasaPeso: number; sinTasa: boolean }>();
  for (const p of posiciones) {
    const t = porTipoMap.get(p.tipo) ?? { monto: 0, n: 0, tasaPeso: 0, sinTasa: false };
    t.monto += p.monto; t.n += 1; t.tasaPeso += p.monto * (p.tasaEa ?? 0);
    if (p.monto !== 0 && p.tasaEa === null) t.sinTasa = true;
    porTipoMap.set(p.tipo, t);
  }
  const porTipo = [...porTipoMap.entries()]
    .map(([tipo, t]) => ({ tipo, n: t.n, monto: t.monto, pct: t.monto / total,
                           tasa: t.sinTasa || !t.monto ? null : t.tasaPeso / t.monto as number | null }))
    .sort((a, b) => b.monto - a.monto);

  const alertas = posiciones.filter((p) => p.estadoVenc === "por_vencer" || p.estadoVenc === "decision" || p.estadoVenc === "vencido");

  return {
    posiciones, total, tasaPonderada, tasasFaltantes, pctLiquido, wamDias, proxVenc, interesMesTotal,
    porEntidad, top1, top3, porTipo, alertas,
    benchmark: D.paramNum("bench_cdt180", 0),
    ipc: D.paramNum("ipc_12m", 0),
    hayDatos: activas.length > 0,
  };
}
