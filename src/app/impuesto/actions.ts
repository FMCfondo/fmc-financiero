"use server";
import { revalidatePath } from "next/cache";
import { guardarParametros } from "@/lib/data";

/* Guarda los parámetros de la provisión de renta en la tabla `parametro` (Neon).
   Al guardarse, TODA la app recalcula: estados, dashboard e indicadores leen la
   provisión de un único sitio (provisionRenta), no tienen copias. */
export async function guardarProvision(input: {
  tasaPct: number; gmf: number; otrosND: number; anticipoRet: number; anticipoSig: number;
}) {
  const num = (v: number) => (Number.isFinite(v) ? v : 0);
  await guardarParametros({
    tasa_imporenta: Math.min(Math.max(num(input.tasaPct), 0), 100) / 100,
    prov_gmf: num(input.gmf),
    prov_otros_nd: num(input.otrosND),
    prov_anticipo_ret: num(input.anticipoRet),
    prov_anticipo_sig: num(input.anticipoSig),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
