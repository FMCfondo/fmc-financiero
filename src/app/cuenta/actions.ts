"use server";
import { redirect } from "next/navigation";
import { auditar, cambiarClave, cerrarSesionesDe, crearSesion, exigirSesion, verificarClave, MIN_CLAVE } from "@/lib/auth";

/* Cambiar MI contraseña. Cierra las demás sesiones del usuario y abre una nueva para
   esta: si alguien tenía la clave vieja abierta en otro sitio, se queda fuera. */
export async function cambiarMiClave(fd: FormData): Promise<void> {
  const u = await exigirSesion();
  const actual = String(fd.get("actual") ?? "");
  const nueva = String(fd.get("nueva") ?? "");
  const confirma = String(fd.get("confirma") ?? "");
  const obligatorio = fd.get("obligatorio") === "1";
  const volver = (e: string) => redirect(`/cuenta?error=${e}${obligatorio ? "&obligatorio=1" : ""}`);

  if (nueva.length < MIN_CLAVE) volver("clave_corta");
  if (nueva !== confirma) volver("no_coincide");
  if (nueva === actual) volver("misma");

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const [r] = await sql`select clave from usuario where id = ${u.id}`;
  if (!r || !verificarClave(actual, String(r.clave))) volver("actual");

  await cambiarClave(u.id, nueva);
  await cerrarSesionesDe(u.id);
  await crearSesion(u.id);
  await auditar(u.id, "clave_cambiada", { entidad: "usuario", registro: u.id });
  redirect(obligatorio ? "/panel" : "/cuenta?ok=1");
}
