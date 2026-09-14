"use server";
import { revalidatePath } from "next/cache";
import { ensureLoaded, guardarPresupuestoAnioDb, invalidateDatos, presupuesto } from "@/lib/data";
import { proponerCarga, type FilaLeida, type FilaPropuesta } from "@/lib/presupuesto-carga";

/* Carga del presupuesto de un año, en DOS PASOS como la ingesta: primero se revisa
   (no escribe nada, devuelve qué heredó, qué es nuevo y qué impide cargar); el
   usuario confirma y ahí sí se reemplaza el año entero.

   La estructura se hereda del año BASE: el mismo año si ya está cargado (recargar
   2026 conserva su mapeo), y si no, el último año anterior que exista. El servidor
   recalcula la propuesta al confirmar: nunca se fía de la estructura que mande el
   navegador, solo de las cifras leídas de la hoja. */

export type ResumenRevision = {
  anioBase: number | null;
  reemplaza: boolean;
  filas: number;
  porOrigen: { exacta: number; aproximada: number; nueva: number };
  conCuentas: number;
  huerfanas: string[];
  problemas: string[];
  avisos: string[];
  /** Muestra para la tabla de revisión: orden, nivel, etiqueta, origen, cuentas, total. */
  detalle: (Pick<FilaPropuesta, "orden" | "nivel" | "etiqueta" | "tipo" | "origen" | "heredaDe" | "total"> & { cuentas: number })[];
};

function anioBaseDe(anio: number): number | null {
  const anios = [...new Set(presupuesto.map((l) => l.anio))].sort((a, b) => a - b);
  if (anios.includes(anio)) return anio;
  const anteriores = anios.filter((a) => a < anio);
  if (anteriores.length) return anteriores[anteriores.length - 1];
  return anios.length ? anios[anios.length - 1] : null;
}

function armar(anio: number, filas: FilaLeida[]) {
  const anioBase = anioBaseDe(anio);
  const previo = anioBase === null ? [] : presupuesto.filter((l) => l.anio === anioBase);
  const prop = proponerCarga(filas, previo);
  if (anioBase === null)
    prop.problemas.unshift("No hay ningún presupuesto cargado del que heredar la estructura (totales, fórmulas, mapeo). El primer año se carga con scripts/migrate-ppto.mjs.");
  return { anioBase, ...prop };
}

const saneadas = (filas: FilaLeida[]): FilaLeida[] =>
  filas
    .filter((f) => typeof f.etiqueta === "string" && f.etiqueta.trim())
    .map((f) => ({
      fila: Number(f.fila) || 0,
      nivel: Math.max(0, Math.min(9, Number(f.nivel) || 0)),
      etiqueta: f.etiqueta.replace(/\s+/g, " ").trim().slice(0, 200),
      meses: Array.from({ length: 12 }, (_, i) => Number(f.meses?.[i]) || 0),
      total: Number(f.total) || 0,
    }));

export async function revisarPresupuesto(input: { anio: number; filas: FilaLeida[] }): Promise<{ ok: boolean; error?: string; resumen?: ResumenRevision }> {
  await ensureLoaded();
  const anio = Number(input.anio);
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) return { ok: false, error: "Año inválido." };
  const filas = saneadas(input.filas);
  if (!filas.length) return { ok: false, error: "La hoja no trae renglones con concepto." };

  const r = armar(anio, filas);
  const porOrigen = { exacta: 0, aproximada: 0, nueva: 0 };
  for (const p of r.propuestas) porOrigen[p.origen]++;
  return {
    ok: r.problemas.length === 0,
    error: r.problemas.length ? "La estructura no cuadra con el año anterior: revisa los problemas antes de cargar." : undefined,
    resumen: {
      anioBase: r.anioBase,
      reemplaza: presupuesto.some((l) => l.anio === anio),
      filas: r.propuestas.length,
      porOrigen,
      conCuentas: r.propuestas.filter((p) => p.cuentas.length > 0).length,
      huerfanas: r.huerfanas.map((h) => h.etiqueta),
      problemas: r.problemas,
      avisos: r.avisos,
      detalle: r.propuestas.map((p) => ({
        orden: p.orden, nivel: p.nivel, etiqueta: p.etiqueta, tipo: p.tipo, origen: p.origen,
        heredaDe: p.heredaDe, total: p.total, cuentas: p.cuentas.length,
      })),
    },
  };
}

export async function confirmarPresupuesto(input: { anio: number; filas: FilaLeida[] }): Promise<{ ok: boolean; error?: string; filas?: number }> {
  await ensureLoaded();
  const anio = Number(input.anio);
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) return { ok: false, error: "Año inválido." };
  const filas = saneadas(input.filas);
  const r = armar(anio, filas);
  if (r.problemas.length) return { ok: false, error: r.problemas.join(" ") };

  await guardarPresupuestoAnioDb(anio, r.propuestas.map(({ origen: _o, heredaDe: _h, ...f }) => f));
  invalidateDatos();
  revalidatePath("/", "layout");
  return { ok: true, filas: r.propuestas.length };
}
