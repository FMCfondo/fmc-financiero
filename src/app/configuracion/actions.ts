"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  activarUsuario, auditar, buscarUsuario, cambiarRol, crearUsuario, generarClave, obtenerSesion,
  restablecerClave, type Rol,
} from "@/lib/auth";
import { guardarParametroJson } from "@/lib/data";
import { CLAVE_MODULOS_JUNTA, MODULOS_JUNTA, inicioDe } from "@/lib/permisos";
import { COOKIE_CLAVE } from "@/lib/auth-cookie";

/* Configuración: usuarios, módulos de la Junta. Todo son formularios clásicos con
   `action`, así que funcionan sin JavaScript y se pueden probar sin hidratar.

   LA CONTRASEÑA GENERADA SE MUESTRA UNA SOLA VEZ y nunca viaja en la URL: la acción la
   deja cinco minutos en una cookie httpOnly que solo lee /configuracion, y el
   administrador la oculta cuando ya la copió. En la base solo vive el hash. */

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function admin() {
  const s = await obtenerSesion();
  if (!s) redirect("/entrar");
  if (s.usuario.rol !== "admin") redirect(await inicioDe(s.usuario));
  return s.usuario;
}

async function mostrarClaveUnaVez(email: string, nombre: string, clave: string) {
  (await cookies()).set(COOKIE_CLAVE, JSON.stringify({ email, nombre, clave }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/configuracion", maxAge: 300,
  });
}

export async function crearUsuarioAdmin(fd: FormData): Promise<void> {
  const yo = await admin();
  const nombre = texto(fd, "nombre");
  const email = texto(fd, "email").toLowerCase();
  const rol: Rol = texto(fd, "rol") === "admin" ? "admin" : "junta";
  if (!nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/configuracion?v=usuarios&error=datos");

  const clave = generarClave();
  try {
    const u = await crearUsuario({ email, nombre, rol, clave, debeCambiarClave: true, creadoPor: yo.id });
    await auditar(yo.id, "usuario_creado", { entidad: "usuario", registro: u.id, despues: { email, nombre, rol } });
    await mostrarClaveUnaVez(email, nombre, clave);
  } catch (e) {
    const dup = e instanceof Error && /usuario_email_unico|duplicate/i.test(e.message);
    redirect(`/configuracion?v=usuarios&error=${dup ? "repetido" : "crear"}`);
  }
  revalidatePath("/configuracion");
  redirect("/configuracion?v=usuarios");
}

export async function ocultarClave(): Promise<void> {
  (await cookies()).delete({ name: COOKIE_CLAVE, path: "/configuracion" });
  redirect("/configuracion?v=usuarios");
}

export async function restablecerClaveUsuario(fd: FormData): Promise<void> {
  const yo = await admin();
  const id = texto(fd, "id");
  const u = await buscarUsuario(id);
  if (!u) redirect("/configuracion?v=usuarios&error=noexiste");
  const clave = await restablecerClave(id);
  await auditar(yo.id, "clave_restablecida", { entidad: "usuario", registro: id });
  await mostrarClaveUnaVez(u.email, u.nombre, clave);
  revalidatePath("/configuracion");
  redirect("/configuracion?v=usuarios");
}

export async function activarUsuarioAdmin(fd: FormData): Promise<void> {
  const yo = await admin();
  const id = texto(fd, "id");
  const activo = texto(fd, "activo") === "1";
  // Uno no se desactiva a sí mismo: quedaría la app sin nadie que pueda entrar a arreglarlo.
  if (id === yo.id && !activo) redirect("/configuracion?v=usuarios&error=timismo");
  await activarUsuario(id, activo);
  await auditar(yo.id, activo ? "usuario_activado" : "usuario_desactivado", { entidad: "usuario", registro: id });
  revalidatePath("/configuracion");
  redirect("/configuracion?v=usuarios");
}

export async function cambiarRolUsuario(fd: FormData): Promise<void> {
  const yo = await admin();
  const id = texto(fd, "id");
  const rol: Rol = texto(fd, "rol") === "admin" ? "admin" : "junta";
  if (id === yo.id && rol !== "admin") redirect("/configuracion?v=usuarios&error=timismo");
  const antes = await buscarUsuario(id);
  await cambiarRol(id, rol);
  await auditar(yo.id, "rol_cambiado", { entidad: "usuario", registro: id, antes: antes?.rol, despues: rol });
  revalidatePath("/configuracion");
  redirect("/configuracion?v=usuarios");
}

/** Los módulos que la Junta puede ver. Solo se aceptan los del catálogo. */
export async function guardarModulosJunta(fd: FormData): Promise<void> {
  const yo = await admin();
  const permitidos = new Set(MODULOS_JUNTA.map((m) => m.href));
  const elegidos = fd.getAll("modulo").map(String).filter((h) => permitidos.has(h));
  await guardarParametroJson(CLAVE_MODULOS_JUNTA, elegidos);
  await auditar(yo.id, "junta_modulos", { entidad: "parametro", registro: CLAVE_MODULOS_JUNTA, despues: elegidos });
  revalidatePath("/", "layout");
  redirect("/configuracion?v=junta&ok=1");
}
