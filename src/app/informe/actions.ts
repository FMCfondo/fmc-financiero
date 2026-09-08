"use server";
import { revalidatePath } from "next/cache";
import { ensureLoaded, guardarNotaDb } from "@/lib/data";
import { CLAVE_TEXTO } from "@/lib/informe";
import type { BloqueNota } from "@/lib/informe-tipos";

/* El texto de las notas de una página, escrito a mano desde la propia hoja. Vive en
   `nota_periodo` con clave propia («informe:activos»), que no puede chocar con una
   cuenta PUC, y REEMPLAZA al texto redactado desde las cifras. Cuerpo vacío = se
   borra la fila y vuelve a mandar el automático; guardarNotaDb ya lo resuelve así. */

const TITULO: Record<BloqueNota, string> = {
  situacion: "Informe · Situación del período",
  activos: "Informe · Activos",
  pasivos: "Informe · Pasivos y patrimonio",
  resultados: "Informe · Estado de resultados",
  gastos: "Informe · Detalle de gastos",
  interanual: "Informe · Comparativo interanual",
  portafolio: "Informe · Portafolio",
};

export async function guardarTextoNota(input: {
  anio: number; mes: number; bloque: BloqueNota; cuerpo: string;
}): Promise<{ ok: boolean; error?: string }> {
  const titulo = TITULO[input.bloque];
  if (!titulo) return { ok: false, error: "Ese bloque del informe no existe." };
  try {
    await ensureLoaded();
    await guardarNotaDb({
      anio: input.anio, mes: input.mes,
      codigo: `${CLAVE_TEXTO}${input.bloque}`,
      titulo, cifra: null, cuerpo: input.cuerpo.trim(),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
  revalidatePath("/informe");
  return { ok: true };
}
