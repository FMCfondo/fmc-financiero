"use server";
import { redirect } from "next/navigation";
import {
  auditar, cerrarSesion, crearSesion, crearUsuario, hayUsuarios, obtenerSesion, verificarCredenciales, MIN_CLAVE,
} from "@/lib/auth";

/* Entrar, salir y crear el primer administrador. Son formularios HTML clásicos con
   `action`: funcionan sin JavaScript en el navegador (y por eso se pueden probar en
   el panel, que no hidrata React). Los errores viajan en la URL, no en el estado. */

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Solo rutas internas: nada de mandar a alguien a otro dominio tras entrar. */
const destinoSeguro = (v: string) => (v.startsWith("/") && !v.startsWith("//") ? v : "/panel");

export async function entrar(fd: FormData): Promise<void> {
  const email = texto(fd, "email");
  const clave = String(fd.get("clave") ?? "");
  const volver = destinoSeguro(texto(fd, "volver"));
  if (!email || !clave) redirect(`/entrar?error=faltan&volver=${encodeURIComponent(volver)}`);

  const r = await verificarCredenciales(email, clave);
  if (!r.ok) {
    await auditar(null, `login_${r.motivo}`, { entidad: "usuario", registro: email.toLowerCase() });
    redirect(`/entrar?error=${r.motivo}&volver=${encodeURIComponent(volver)}`);
  }
  await crearSesion(r.usuario.id);
  await auditar(r.usuario.id, "login");
  redirect(r.usuario.debeCambiarClave ? "/cuenta?obligatorio=1" : volver);
}

export async function salir(): Promise<void> {
  const s = await obtenerSesion();
  await cerrarSesion();
  if (s) await auditar(s.usuario.id, "logout");
  redirect("/entrar");
}

/** Solo mientras la tabla esté vacía. Después, los usuarios los crea el administrador. */
export async function crearPrimerAdmin(fd: FormData): Promise<void> {
  if (await hayUsuarios()) redirect("/entrar?error=ya_hay_admin");
  const nombre = texto(fd, "nombre");
  const email = texto(fd, "email");
  const clave = String(fd.get("clave") ?? "");
  const confirma = String(fd.get("confirma") ?? "");
  if (!nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/entrar?error=datos");
  if (clave.length < MIN_CLAVE) redirect("/entrar?error=clave_corta");
  if (clave !== confirma) redirect("/entrar?error=no_coincide");

  let id: string;
  try {
    const u = await crearUsuario({ email, nombre, rol: "admin", clave, debeCambiarClave: false, creadoPor: null });
    id = u.id;
  } catch {
    redirect("/entrar?error=sin_tablas");
  }
  await crearSesion(id);
  await auditar(id, "primer_admin", { entidad: "usuario", registro: id });
  redirect("/panel");
}
