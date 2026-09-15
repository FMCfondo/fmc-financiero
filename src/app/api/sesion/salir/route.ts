import type { NextRequest } from "next/server";
import { auditar, borrarSesion, obtenerSesion, COOKIE_SESION } from "@/lib/auth";
import { irA, otroOrigen } from "../_comun";

export const dynamic = "force-dynamic";

/** POST /api/sesion/salir — cierra ESTA sesión y vuelve a la pantalla de entrada. */
export async function POST(req: NextRequest) {
  const rechazo = otroOrigen(req);
  if (rechazo) return rechazo;

  const token = req.cookies.get(COOKIE_SESION)?.value;
  if (token) {
    const s = await obtenerSesion();
    await borrarSesion(token);
    if (s) await auditar(s.usuario.id, "logout");
  }
  const res = irA(req, "/entrar");
  res.cookies.delete({ name: COOKIE_SESION, path: "/" });
  return res;
}
