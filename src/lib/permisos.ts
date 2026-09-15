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
export const CLAVE_VISTAS_JUNTA = "junta_vistas";

/** Los módulos que el administrador puede habilitar o no para la Junta. */
export const MODULOS_JUNTA = NAV.filter((i) => visibleEn(i, "reuniones")).map((i) => ({ href: i.href, label: i.label }));
const POR_DEFECTO = MODULOS_JUNTA.map((m) => m.href);

/** Dentro de un módulo, las VISTAS que el administrador puede habilitar o no para la
 *  Junta (parámetro `junta_vistas`). Hoy solo Estados Financieros tiene pestañas que
 *  valga la pena dosificar: se puede mostrar el Estado de Resultados y la Situación
 *  Financiera y dejar fuera el Flujo o el Patrimonio mientras se terminan de trabajar.
 *  `modulo` es el href de la entrada del menú (así se identifica un módulo en toda la
 *  app); `href` es la ruta de la pestaña. */
export const VISTAS_JUNTA: { modulo: string; href: string; label: string }[] = [
  { modulo: "/estados/resultados", href: "/estados/resultados", label: "Estado de Resultados" },
  { modulo: "/estados/resultados", href: "/estados/situacion", label: "Situación Financiera" },
  { modulo: "/estados/resultados", href: "/estados/flujo", label: "Flujo de Efectivo" },
  { modulo: "/estados/resultados", href: "/estados/patrimonio", label: "Cambios en el Patrimonio" },
  { modulo: "/estados/resultados", href: "/estados/dashboard", label: "Análisis" },
];
const VISTAS_POR_DEFECTO = VISTAS_JUNTA.map((v) => v.href);

/** Vistas habilitadas hoy para la Junta (solo las del catálogo). */
export function vistasJunta(): string[] {
  const v = paramJson(CLAVE_VISTAS_JUNTA);
  const lista = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : VISTAS_POR_DEFECTO;
  return VISTAS_POR_DEFECTO.filter((h) => lista.includes(h));
}

/** Rutas habilitadas hoy para la Junta. Lo que no sea de Reuniones se descarta, y un
 *  módulo con pestañas al que no le quede ninguna habilitada tampoco se ofrece: sin
 *  eso, su entrada del menú llevaría a una página que rebota a esa misma entrada. */
export function modulosJunta(): string[] {
  const v = paramJson(CLAVE_MODULOS_JUNTA);
  const lista = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : POR_DEFECTO;
  const vistas = vistasJunta();
  return POR_DEFECTO.filter((h) => lista.includes(h))
    .filter((h) => !VISTAS_JUNTA.some((vv) => vv.modulo === h) || VISTAS_JUNTA.some((vv) => vv.modulo === h && vistas.includes(vv.href)));
}

/** Las rutas del menú que este usuario puede ver. */
export function modulosDe(u: Usuario): string[] {
  return u.rol === "admin" ? NAV.map((i) => i.href) : modulosJunta();
}

/** Las vistas (pestañas) que este usuario puede ver, de las que están en el catálogo. */
export function vistasDe(u: Usuario): string[] {
  return u.rol === "admin" ? VISTAS_POR_DEFECTO : vistasJunta();
}

/** A dónde lleva la entrada de un módulo para este usuario: su primera pestaña
 *  habilitada (para la Junta, si Resultados está apagado, Estados entra por la
 *  siguiente que esté encendida). */
export function entradaDe(u: Usuario, modulo: string): string {
  const vistas = VISTAS_JUNTA.filter((v) => v.modulo === modulo);
  if (u.rol === "admin" || vistas.length === 0) return modulo;
  const habilitadas = vistasJunta();
  return vistas.find((v) => habilitadas.includes(v.href))?.href ?? modulo;
}

/** ¿Puede este usuario estar en esta ruta? Se casa contra el `match` de cada módulo,
 *  igual que el resaltado del menú, para que "poder ver" y "estar resaltado" digan lo
 *  mismo. /cuenta es de todos; lo que no es de ningún módulo (raíz, redirecciones
 *  viejas) se deja pasar, porque termina en una ruta que sí se evalúa. */
export function rutaPermitida(u: Usuario, ruta: string): boolean {
  if (u.rol === "admin") return true;
  if (ruta === "/cuenta" || ruta.startsWith("/cuenta/")) return true;
  const es = (m: string) => ruta === m || ruta.startsWith(m + "/") || ruta.startsWith(m + "?");
  const modulo = NAV.find((i) => (Array.isArray(i.match) ? i.match : [i.match]).some(es));
  if (!modulo) return ruta === "/" || ruta === "/er" || ruta === "/esf";
  if (!modulosJunta().includes(modulo.href)) return false;
  // Dentro del módulo, la pestaña concreta también tiene que estar habilitada.
  const vista = VISTAS_JUNTA.find((v) => es(v.href));
  return !vista || vistasJunta().includes(vista.href);
}

/** A dónde mandar a alguien que no puede estar donde está: la entrada de su primer
 *  módulo, o su cuenta. */
export function destinoInicial(u: Usuario): string {
  const m = modulosDe(u)[0];
  return m ? entradaDe(u, m) : "/cuenta";
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

/** Para el layout de un módulo con pestañas (Estados Financieros): exige sesión y que
 *  el MÓDULO esté habilitado, sin mirar la pestaña, que la comprueba cada página. Si
 *  el layout mirara una pestaña concreta, apagarla echaría al usuario de todo el
 *  módulo aunque tuviera otras encendidas. */
export async function accesoAlModulo(modulo: string): Promise<Usuario> {
  const s = await obtenerSesion();
  if (!s) redirect(`/entrar?volver=${encodeURIComponent(modulo)}`);
  if (s.usuario.debeCambiarClave) redirect("/cuenta?obligatorio=1");
  await ensureLoaded();
  if (!modulosDe(s.usuario).includes(modulo)) redirect(destinoInicial(s.usuario));
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
