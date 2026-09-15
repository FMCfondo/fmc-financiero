import type { NextRequest } from "next/server";
import { abrirSesion, auditar, crearUsuario, hayUsuarios, COOKIE_SESION, MIN_CLAVE, OPCIONES_COOKIE_SESION } from "@/lib/auth";
import { irA, otroOrigen, texto } from "../_comun";

export const dynamic = "force-dynamic";

/** POST /api/sesion/primer-admin — solo mientras la tabla de usuarios esté vacía.
 *  Después, los usuarios los crea el administrador desde Configuración. */
export async function POST(req: NextRequest) {
  const rechazo = otroOrigen(req);
  if (rechazo) return rechazo;
  if (await hayUsuarios()) return irA(req, "/entrar?error=ya_hay_admin");

  const fd = await req.formData();
  const nombre = texto(fd, "nombre");
  const email = texto(fd, "email");
  const clave = String(fd.get("clave") ?? "");
  const confirma = String(fd.get("confirma") ?? "");
  if (!nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return irA(req, "/entrar?error=datos");
  if (clave.length < MIN_CLAVE) return irA(req, "/entrar?error=clave_corta");
  if (clave !== confirma) return irA(req, "/entrar?error=no_coincide");

  let id: string;
  try {
    const u = await crearUsuario({ email, nombre, rol: "admin", clave, debeCambiarClave: false, creadoPor: null });
    id = u.id;
  } catch {
    return irA(req, "/entrar?error=sin_tablas");
  }
  const token = await abrirSesion(id);
  await auditar(id, "primer_admin", { entidad: "usuario", registro: id });
  const res = irA(req, "/panel");
  res.cookies.set(COOKIE_SESION, token, OPCIONES_COOKIE_SESION);
  return res;
}
