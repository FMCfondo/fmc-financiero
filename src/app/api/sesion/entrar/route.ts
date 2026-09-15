import type { NextRequest } from "next/server";
import { abrirSesion, auditar, verificarCredenciales, COOKIE_SESION, OPCIONES_COOKIE_SESION } from "@/lib/auth";
import { esInterna, irA, otroOrigen, texto } from "../_comun";
import { inicioDe } from "@/lib/permisos";

export const dynamic = "force-dynamic";

/** POST /api/sesion/entrar — el formulario de /entrar. Los errores vuelven en la URL. */
export async function POST(req: NextRequest) {
  const rechazo = otroOrigen(req);
  if (rechazo) return rechazo;

  const fd = await req.formData();
  const email = texto(fd, "email");
  const clave = String(fd.get("clave") ?? "");
  const volver = texto(fd, "volver");
  const conError = (e: string) => irA(req, `/entrar?error=${e}${volver ? `&volver=${encodeURIComponent(volver)}` : ""}`);
  if (!email || !clave) return conError("faltan");

  const r = await verificarCredenciales(email, clave);
  if (!r.ok) {
    await auditar(null, `login_${r.motivo}`, { entidad: "usuario", registro: email.toLowerCase() });
    return conError(r.motivo);
  }
  const token = await abrirSesion(r.usuario.id);
  await auditar(r.usuario.id, "login");
  // A donde iba si era una ruta de la aplicación; si no, a su primer módulo. Si la
  // ruta pedida no es suya, la propia página lo devolverá a su sitio.
  const destino = r.usuario.debeCambiarClave ? "/cuenta?obligatorio=1" : esInterna(volver) ? volver : await inicioDe(r.usuario);
  const res = irA(req, destino);
  res.cookies.set(COOKIE_SESION, token, OPCIONES_COOKIE_SESION);
  return res;
}
