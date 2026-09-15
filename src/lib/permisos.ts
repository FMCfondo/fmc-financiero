import "server-only";
import { redirect } from "next/navigation";
import { NAV, visibleEn } from "./modos";
import { ensureLoaded, paramJson } from "./data";
import { obtenerSesion, type Usuario } from "./auth";

/* Qué puede ver cada rol, decidido en el SERVIDOR.
 *
 * · admin: todo, en los dos modos.
 * · junta: solo módulos del modo Reuniones, y de esos solo los que el administrador
 *   haya dejado habilitados (parámetro `junta_modulos`, una lista de rutas). Por
 *   defecto los cuatro: Panel, Estados Financieros, Portafolio e Informe. Nunca
 *   Operación, aunque el parámetro lo dijera: el filtro de modo va primero.
 *
 * La barra lateral recibe la lista ya filtrada; el layout raíz rechaza las rutas que
 * no estén en ella; y las acciones que escriben exigen administrador por su cuenta.
 * Tres capas: esconder no es proteger. */

export const CLAVE_MODULOS_JUNTA = "junta_modulos";

/** Los módulos que el administrador puede habilitar o no para la Junta. */
export const MODULOS_JUNTA = NAV.filter((i) => visibleEn(i, "reuniones")).map((i) => ({ href: i.href, label: i.label }));
const POR_DEFECTO = MODULOS_JUNTA.map((m) => m.href);

/** Rutas habilitadas hoy para la Junta. Lo que no sea de Reuniones se descarta. */
export function modulosJunta(): string[] {
  const v = paramJson(CLAVE_MODULOS_JUNTA);
  const lista = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : POR_DEFECTO;
  return POR_DEFECTO.filter((h) => lista.includes(h));
}

/** Las rutas del menú que este usuario puede ver. */
export function modulosDe(u: Usuario): string[] {
  return u.rol === "admin" ? NAV.map((i) => i.href) : modulosJunta();
}

/** ¿Puede este usuario estar en esta ruta? Se casa contra el `match` de cada módulo,
 *  igual que el resaltado del menú, para que "poder ver" y "estar resaltado" digan lo
 *  mismo. /cuenta es de todos; lo que no es de ningún módulo (raíz, redirecciones
 *  viejas) se deja pasar, porque termina en una ruta que sí se evalúa. */
export function rutaPermitida(u: Usuario, ruta: string): boolean {
  if (u.rol === "admin") return true;
  if (ruta === "/cuenta" || ruta.startsWith("/cuenta/")) return true;
  const modulo = NAV.find((i) => (Array.isArray(i.match) ? i.match : [i.match]).some((m) => ruta === m || ruta.startsWith(m + "/") || ruta.startsWith(m + "?")));
  if (!modulo) return ruta === "/" || ruta === "/er" || ruta === "/esf";
  return modulosJunta().includes(modulo.href);
}

/** A dónde mandar a alguien que no puede estar donde está: su primer módulo, o su cuenta. */
export function destinoInicial(u: Usuario): string {
  return modulosDe(u)[0] ?? "/cuenta";
}

/** Lo mismo, cargando antes los parámetros (para acciones y rutas que corren solas,
 *  sin una página que ya haya cargado el dataset). Nunca es /panel «porque sí»: el
 *  Panel puede estar deshabilitado para la Junta. */
export async function inicioDe(u: Usuario): Promise<string> {
  await ensureLoaded();
  return destinoInicial(u);
}

/** AL PRINCIPIO DE CADA PÁGINA: exige sesión, obliga el cambio de contraseña pendiente
 *  y comprueba que este usuario pueda estar en este módulo. Lo hace la página, y no
 *  solo el layout, porque un layout compartido NO se vuelve a ejecutar cuando el
 *  navegador cambia de ruta sin recargar: lo que el layout decidió al entrar se queda.
 *  El layout hace la misma comprobación en las cargas completas; esta vale en todas. */
export async function accesoA(ruta: string): Promise<Usuario> {
  const s = await obtenerSesion();
  if (!s) redirect(ruta === "/" ? "/entrar" : `/entrar?volver=${encodeURIComponent(ruta)}`);
  if (s.usuario.debeCambiarClave && !ruta.startsWith("/cuenta")) redirect("/cuenta?obligatorio=1");
  await ensureLoaded(); // los módulos de la Junta salen de los parámetros
  if (!rutaPermitida(s.usuario, ruta)) redirect(destinoInicial(s.usuario));
  return s.usuario;
}

/** Para páginas de administrador (o partes de una página, como Mantenimiento o el
 *  editor de mapeo): si no es admin, se le devuelve a un sitio suyo. */
export async function soloAdmin(destino?: string): Promise<Usuario> {
  const s = await obtenerSesion();
  if (!s) redirect("/entrar");
  if (s.usuario.debeCambiarClave) redirect("/cuenta?obligatorio=1");
  if (s.usuario.rol !== "admin") redirect(destino ?? destinoInicial(s.usuario));
  return s.usuario;
}

/** Para acciones que escriben: devuelve el error listo para el cliente en vez de
 *  lanzar, porque un throw en una acción de servidor llega al navegador sin mensaje. */
export async function exigirAdminAccion(): Promise<{ ok: false; error: string } | null> {
  const s = await obtenerSesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar." };
  if (s.usuario.rol !== "admin") return { ok: false, error: "Solo el administrador puede hacer esto." };
  return null;
}
