"use server";
import { revalidatePath } from "next/cache";
import { guardarInversionDb, guardarParametros, cuentaByCodigo, ensureLoaded, type Inversion } from "@/lib/data";

/* Mantenimiento del portafolio: guarda los datos manuales de una inversión.
   El monto NO se edita nunca — sale del balance del mes. */
export async function guardarInversion(input: {
  id: string; tipo: string; entidad: string; cuentas: string;
  tasaEaPct: number; fechaApertura: string; fechaVencimiento: string;
  calificacion: string; renovar: string; observaciones: string; activa: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  await ensureLoaded();

  const id = input.id.trim().toUpperCase();
  if (!/^INV-\d{3}$/.test(id)) return { ok: false, error: "El ID debe tener el formato INV-001." };
  if (!input.entidad.trim()) return { ok: false, error: "La entidad es obligatoria." };

  // Validar el mapeo contable: cada código debe existir y ser cuenta hoja.
  const cuentas = input.cuentas.split(",").map((c) => c.trim()).filter(Boolean);
  if (!cuentas.length) return { ok: false, error: "Debe mapear al menos un auxiliar del PUC." };
  for (const c of cuentas) {
    const cta = cuentaByCodigo.get(c);
    if (!cta) return { ok: false, error: `La cuenta ${c} no existe en el plan de cuentas.` };
    if (!cta.es_hoja) return { ok: false, error: `La cuenta ${c} no es auxiliar (tiene hijas); mapea las hojas.` };
  }

  const inv: Inversion = {
    id, tipo: input.tipo, entidad: input.entidad.trim(), cuentas,
    tasaEa: Math.min(Math.max(input.tasaEaPct, 0), 100) / 100,
    fechaApertura: input.fechaApertura || null,
    fechaVencimiento: input.fechaVencimiento || null,
    calificacion: input.calificacion.trim() || null,
    renovar: input.renovar.trim() || null,
    observaciones: input.observaciones.trim() || null,
    activa: input.activa,
  };
  await guardarInversionDb(inv);
  revalidatePath("/portafolio");
  return { ok: true };
}

/** Tasas de referencia del módulo (manuales, hasta integrar la serie del BanRep). */
export async function guardarReferencias(input: { benchPct: number; ipcPct: number }) {
  await guardarParametros({
    bench_cdt180: Math.min(Math.max(input.benchPct, 0), 100) / 100,
    ipc_12m: Math.min(Math.max(input.ipcPct, 0), 100) / 100,
  });
  revalidatePath("/portafolio");
  return { ok: true };
}
