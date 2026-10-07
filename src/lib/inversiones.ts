import "server-only";
import * as D from "./data";
import { CTA_BOLD, boldEsInversion, inversionesLiquidas } from "./informe-cuentas";
import { fmtCont } from "./format";

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
/* HOY en Colombia (UTC−5, sin horario de verano). Con la fecha UTC, de las siete de la
   noche en adelante «hoy» ya era mañana y los días al vencimiento salían con uno menos. */
const hoyISO = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
const dias = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / DIA);
/** Días de hoy al vencimiento; negativo si ya venció, null si es a la vista. */
export const diasAlVencimiento = (inv: { fechaVencimiento: string | null }) =>
  inv.fechaVencimiento ? dias(hoyISO(), inv.fechaVencimiento) : null;

function estadoDe(diasRestantes: number | null): EstadoVenc {
  if (diasRestantes === null) return "vista";
  if (diasRestantes < 0) return "vencido";
  if (diasRestantes <= 10) return "decision";
  if (diasRestantes <= 30) return "por_vencer";
  return "vigente";
}

/* EL PORTAFOLIO CONTRA EL BALANCE, CON LA CAUSA. El informe solo sabía decir «no
   cuadra»; el usuario subió septiembre y no tenía cómo saber en qué (2026-10-07). Aquí
   se busca cuenta por cuenta lo que separa las dos cifras:
     1. saldo en el balance que ninguna inversión activa toma (cuenta sin asignar, o
        asignada a una inversión marcada como inactiva);
     2. saldo que el portafolio suma y el balance no cuenta como inversión líquida;
     3. una misma cuenta en dos inversiones, que se suma dos veces.
   Lo que esas tres no expliquen se dice como resto. Es un recado para el
   administrador: no va a la hoja impresa. */
export type Descuadre = { balance: number; portafolio: number; diferencia: number; causas: string[] };

function descuadreDe(etq: string, activas: D.Inversion[], total: number): Descuadre | null {
  const esLiquida = (c: string) => c.startsWith("12") || (c === CTA_BOLD && boldEsInversion(etq));
  const balance = inversionesLiquidas(etq);
  const diferencia = balance - total;
  if (Math.abs(diferencia) <= 1) return null;
  const $ = (v: number) => fmtCont(v, true);
  const nombre = (c: string) => D.cuentaByCodigo.get(c)?.nombre ?? "sin nombre";
  const causas: string[] = [];
  let explicado = 0;

  const tomadas = new Map<string, string[]>(); // cuenta → inversiones activas que la toman
  for (const i of activas) for (const c of i.cuentas) tomadas.set(c, [...(tomadas.get(c) ?? []), i.id]);

  for (const cta of D.cuentas) {
    if (!cta.es_hoja || !esLiquida(cta.codigo) || tomadas.has(cta.codigo)) continue;
    const v = D.fact(etq, cta.codigo);
    if (Math.round(v) === 0) continue;
    explicado += v;
    const inactiva = D.inversiones.find((i) => !i.activa && i.cuentas.includes(cta.codigo));
    causas.push(inactiva
      ? `la cuenta ${cta.codigo} (${cta.nombre}) tiene ${$(v)} en el balance, pero su inversión ${inactiva.id} · ${inactiva.entidad} está marcada como inactiva. Actívala en Mantenimiento; si ya se cerró, la cuenta no debería conservar saldo`
      : `la cuenta ${cta.codigo} (${cta.nombre}) tiene ${$(v)} en el balance y no está asignada a ninguna inversión. Agrégala en Mantenimiento a la que corresponda, o crea una nueva`);
  }
  for (const [c, ids] of tomadas) {
    const v = D.fact(etq, c);
    if (Math.round(v) === 0) continue;
    if (!esLiquida(c)) {
      explicado -= v * ids.length;
      causas.push(`${ids.join(" y ")} toma la cuenta ${c} (${nombre(c)}) con ${$(v)}, que en el balance no es una inversión líquida. Revisa sus cuentas en Mantenimiento`);
    } else if (ids.length > 1) {
      explicado -= v * (ids.length - 1);
      causas.push(`la cuenta ${c} (${nombre(c)}) está en ${ids.join(" y ")}, así que su saldo de ${$(v)} se suma ${ids.length} veces. Déjala en una sola`);
    }
  }
  const resto = diferencia - explicado;
  if (Math.abs(resto) > 1) {
    causas.push(causas.length
      ? `quedan ${$(resto)} sin una causa identificada`
      : `no apareció ninguna cuenta sin inversión ni de más en ellas; la diferencia de ${$(resto)} viene de otro lado`);
  }
  return { balance, portafolio: total, diferencia, causas };
}

export function portafolio(etq: string) {
  const per = D.periodo(etq);
  /* Bold no sigue la marca de activa sino la fecha: es inversión hasta agosto de 2026
     y efectivo desde septiembre (ver `boldEsInversion`). */
  const activas = D.inversiones.filter((i) =>
    i.cuentas.includes(CTA_BOLD) ? boldEsInversion(etq) : i.activa);

  /* En el orden que fijó el administrador en Mantenimiento (`enOrden`). Antes se
     ordenaba por monto; los gráficos que necesitan otro orden lo hacen ellos. */
  const posiciones: Posicion[] = D.enOrden(activas).map((inv) => {
    const monto = inv.cuentas.reduce((s, c) => s + D.fact(etq, c), 0);
    const tasa = D.tasaDe(inv, per.anio, per.mes);
    const mensual = tasa === null ? null : (1 + tasa) ** (1 / 12) - 1;
    const diasRestantes = diasAlVencimiento(inv);
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
  });

  const suma = posiciones.reduce((s, p) => s + p.monto, 0);
  const total = suma || 1;
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
    descuadre: descuadreDe(etq, activas, suma),
    benchmark: D.paramNum("bench_cdt180", 0),
    ipc: D.paramNum("ipc_12m", 0),
    hayDatos: activas.length > 0,
  };
}
