"use server";
import { revalidatePath } from "next/cache";
import { guardarNotaDb, ensureLoaded } from "@/lib/data";

/* Guarda (o borra, si el cuerpo queda vacío) la explicación de un movimiento
   fuera de lo habitual. Lo que se escribe aquí aparece en el Panel. */
export async function guardarNota(input: {
  anio: number; mes: number; codigo: string | null; titulo: string; cifra: string | null; cuerpo: string;
}): Promise<{ ok: boolean; error?: string }> {
  await ensureLoaded();
  if (!input.titulo.trim()) return { ok: false, error: "Falta el concepto de la nota." };
  await guardarNotaDb({ ...input, cuerpo: input.cuerpo.trim() });
  revalidatePath("/revision");
  revalidatePath("/panel");
  return { ok: true };
}
