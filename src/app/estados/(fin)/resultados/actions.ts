"use server";
import { revalidatePath } from "next/cache";
import { guardarMapeoPptoDb, cuentaByCodigo, ensureLoaded } from "@/lib/data";

/* Editor del mapeo presupuestal: guarda a qué cuentas PUC apunta una línea del
   presupuesto para calcular su "Real". Vacío = la línea muestra solo el
   presupuesto (—) y su real vive a nivel del grupo que sí mapea. */
export async function guardarMapeoPpto(input: { anio: number; orden: number; cuentas: string }): Promise<{ ok: boolean; error?: string; nombres?: string[] }> {
  await ensureLoaded();
  const cuentas = input.cuentas.split(/[,\s]+/).map((c) => c.trim()).filter(Boolean);
  const nombres: string[] = [];
  for (const c of cuentas) {
    const cta = cuentaByCodigo.get(c);
    if (!cta) return { ok: false, error: `La cuenta ${c} no existe en el plan de cuentas.` };
    nombres.push(cta.nombre);
  }
  await guardarMapeoPptoDb(input.anio, input.orden, cuentas);
  revalidatePath("/estados/resultados");
  return { ok: true, nombres };
}
