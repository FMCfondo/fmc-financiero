import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { COOKIE_SESION } from "./auth-cookie";

/* Identidad propia, sin servicios externos ni secretos nuevos.
 *
 * · La contraseña se guarda como scrypt con sal por usuario (`scrypt$N$sal$hash`).
 * · La sesión es un token opaco en una cookie httpOnly; en la base vive su SHA-256,
 *   así que una fuga de la tabla no entrega sesiones vivas. Se valida contra la base
 *   en cada petición (una consulta, deduplicada por `cache`): por eso desactivar a
 *   alguien lo saca al instante, sin esperar a que caduque nada.
 * · Cinco intentos fallidos bloquean la cuenta quince minutos. La app es pública.
 *
 * El proxy solo comprueba que la cookie EXISTA (no toca la base); la verdad la dice
 * `obtenerSesion()` aquí, en el layout y en cada acción que escribe.
 */

export type Rol = "admin" | "junta";
export type Usuario = {
  id: string; email: string; nombre: string; rol: Rol;
  activo: boolean; debeCambiarClave: boolean; ultimoAcceso: string | null;
};
export type Sesion = { usuario: Usuario; expiraEn: Date };

export { COOKIE_SESION };
const DIAS_SESION = 30;
const DIAS_RENOVAR = 15;          // si quedan menos de estos, se extiende
const MAX_INTENTOS = 5;
const MIN_BLOQUEO = 15;
export const MIN_CLAVE = 10;

async function sqlDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL.");
  const { neon } = await import("@neondatabase/serverless");
  return neon(url);
}

// ------------------------------------------------------------- contraseñas ---

const SCRYPT_N = 16384;
export function hashClave(clave: string): string {
  const sal = randomBytes(16).toString("base64url");
  const hash = scryptSync(clave.normalize("NFKC"), sal, 64, { N: SCRYPT_N }).toString("base64url");
  return `scrypt$${SCRYPT_N}$${sal}$${hash}`;
}
export function verificarClave(clave: string, guardada: string): boolean {
  const [alg, n, sal, hash] = guardada.split("$");
  if (alg !== "scrypt" || !sal || !hash) return false;
  const calc = scryptSync(clave.normalize("NFKC"), sal, 64, { N: Number(n) || SCRYPT_N });
  const ref = Buffer.from(hash, "base64url");
  return calc.length === ref.length && timingSafeEqual(calc, ref);
}

/** Contraseña inicial que una persona puede leer y teclear: tres palabras y dos
 *  cifras. La entropía sale de las palabras (lista de 64 → 18 bits) y las cifras, y
 *  el sistema obliga a cambiarla en el primer ingreso. */
const PALABRAS = [
  "roble", "marea", "cobre", "sierra", "nube", "faro", "ceniza", "trigo", "delta", "lince",
  "coral", "brisa", "pino", "cumbre", "sable", "orilla", "musgo", "ámbar", "rocío", "cedro",
  "aurora", "canela", "galeón", "jade", "laurel", "menta", "nácar", "olmo", "pluma", "quena",
  "río", "sauce", "tejo", "uva", "vela", "yunque", "zafiro", "arena", "bruma", "cauce",
  "dátil", "eco", "fresno", "grava", "hielo", "isla", "junco", "kiwi", "lima", "molino",
  "nogal", "ocaso", "piedra", "quinua", "raíz", "sombra", "tundra", "umbral", "valle", "viento",
  "yema", "zarza", "abeto", "brote",
];
export function generarClave(): string {
  const b = randomBytes(4);
  const w = (i: number) => PALABRAS[b[i] % PALABRAS.length];
  return `${w(0)}-${w(1)}-${w(2)}-${10 + (b[3] % 90)}`;
}

// ---------------------------------------------------------------- usuarios ---

const aUsuario = (r: Record<string, unknown>): Usuario => ({
  id: String(r.id), email: String(r.email), nombre: String(r.nombre), rol: r.rol as Rol,
  activo: !!r.activo, debeCambiarClave: !!r.debe_cambiar_clave,
  ultimoAcceso: r.ultimo_acceso ? new Date(r.ultimo_acceso as string).toISOString() : null,
});

/** ¿Hay alguien? Si la tabla no existe todavía, tampoco hay nadie. */
export async function hayUsuarios(): Promise<boolean> {
  try {
    const sql = await sqlDb();
    const [r] = await sql`select count(*)::int as n from usuario`;
    return Number(r.n) > 0;
  } catch {
    return false;
  }
}

export async function crearUsuario(input: {
  email: string; nombre: string; rol: Rol; clave: string; debeCambiarClave: boolean; creadoPor: string | null;
}): Promise<Usuario> {
  const sql = await sqlDb();
  const [r] = await sql`
    insert into usuario (email, nombre, rol, clave, debe_cambiar_clave, creado_por)
    values (${input.email.trim().toLowerCase()}, ${input.nombre.trim()}, ${input.rol}, ${hashClave(input.clave)},
            ${input.debeCambiarClave}, ${input.creadoPor})
    returning *`;
  return aUsuario(r);
}

/** Verifica email + contraseña con bloqueo por intentos. Devuelve el usuario o el
 *  motivo del rechazo, sin distinguir «no existe» de «clave mala» hacia afuera. */
export async function verificarCredenciales(email: string, clave: string):
  Promise<{ ok: true; usuario: Usuario } | { ok: false; motivo: "credenciales" | "bloqueado" | "inactivo" }> {
  const sql = await sqlDb();
  const [r] = await sql`select * from usuario where lower(email) = ${email.trim().toLowerCase()}`;
  if (!r) { verificarClave(clave, hashClave("relleno")); return { ok: false, motivo: "credenciales" }; } // mismo tiempo que un usuario real
  if (!r.activo) return { ok: false, motivo: "inactivo" };
  if (r.bloqueado_hasta && new Date(r.bloqueado_hasta as string) > new Date()) return { ok: false, motivo: "bloqueado" };

  if (!verificarClave(clave, String(r.clave))) {
    const intentos = Number(r.intentos_fallidos) + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await sql`update usuario set intentos_fallidos = ${bloquear ? 0 : intentos},
              bloqueado_hasta = ${bloquear ? new Date(Date.now() + MIN_BLOQUEO * 60_000).toISOString() : null}
              where id = ${r.id}`;
    return { ok: false, motivo: bloquear ? "bloqueado" : "credenciales" };
  }
  await sql`update usuario set intentos_fallidos = 0, bloqueado_hasta = null, ultimo_acceso = now() where id = ${r.id}`;
  return { ok: true, usuario: aUsuario(r) };
}

export async function cambiarClave(usuarioId: string, nueva: string): Promise<void> {
  const sql = await sqlDb();
  await sql`update usuario set clave = ${hashClave(nueva)}, debe_cambiar_clave = false where id = ${usuarioId}`;
}

// ---------------------------------------------------------------- sesiones ---

const hashToken = (t: string) => createHash("sha256").update(t).digest("base64url");
const enDias = (d: number) => new Date(Date.now() + d * 86_400_000);

/** Crea la sesión en la base y deja la cookie. Se llama desde una acción de servidor. */
export async function crearSesion(usuarioId: string): Promise<void> {
  const sql = await sqlDb();
  const token = randomBytes(32).toString("base64url");
  const agente = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await sql`insert into sesion (hash, usuario_id, expira_en, agente) values (${hashToken(token)}, ${usuarioId}, ${enDias(DIAS_SESION).toISOString()}, ${agente})`;
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    maxAge: DIAS_SESION * 86_400,
  });
}

/** La sesión de esta petición, o null. Una consulta por petición (cache de React).
 *  Cualquier fallo de base cuenta como «sin sesión»: nunca deja pasar por error. */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  try {
    const token = (await cookies()).get(COOKIE_SESION)?.value;
    if (!token) return null;
    const sql = await sqlDb();
    const [r] = await sql`
      select u.*, s.expira_en from sesion s join usuario u on u.id = s.usuario_id
      where s.hash = ${hashToken(token)}`;
    if (!r) return null;
    const expira = new Date(r.expira_en as string);
    if (expira <= new Date() || !r.activo) return null;
    // Renovación deslizante: la actividad reciente alarga la sesión.
    if (expira < enDias(DIAS_RENOVAR))
      await sql`update sesion set expira_en = ${enDias(DIAS_SESION).toISOString()} where hash = ${hashToken(token)}`;
    return { usuario: aUsuario(r), expiraEn: expira };
  } catch {
    return null;
  }
});

/** Cierra ESTA sesión (borra la fila y la cookie). */
export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESION)?.value;
  if (token) {
    try { const sql = await sqlDb(); await sql`delete from sesion where hash = ${hashToken(token)}`; } catch { /* la cookie se borra igual */ }
  }
  jar.delete(COOKIE_SESION);
}

/** Cierra TODAS las sesiones de un usuario: al desactivarlo o al restablecer su clave. */
export async function cerrarSesionesDe(usuarioId: string): Promise<void> {
  const sql = await sqlDb();
  await sql`delete from sesion where usuario_id = ${usuarioId}`;
}

// ---------------------------------------------------------------- guardias ---

/** Para acciones de servidor: lanza si no hay sesión. Devuelve el usuario. */
export async function exigirSesion(): Promise<Usuario> {
  const s = await obtenerSesion();
  if (!s) throw new Error("Tu sesión terminó. Vuelve a entrar.");
  return s.usuario;
}
/** Para acciones que escriben: solo el administrador. */
export async function exigirAdmin(): Promise<Usuario> {
  const u = await exigirSesion();
  if (u.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  return u;
}

// --------------------------------------------------------------- auditoría ---

/** Quién hizo qué. Mejor esfuerzo: un fallo aquí nunca tumba la acción. */
export async function auditar(usuarioId: string | null, accion: string, detalle?: {
  entidad?: string; registro?: string; antes?: unknown; despues?: unknown;
}): Promise<void> {
  try {
    const sql = await sqlDb();
    await sql`insert into auditoria (usuario, accion, entidad, registro_id, antes, despues)
              values (${usuarioId}, ${accion}, ${detalle?.entidad ?? null}, ${detalle?.registro ?? null},
                      ${detalle?.antes === undefined ? null : JSON.stringify(detalle.antes)},
                      ${detalle?.despues === undefined ? null : JSON.stringify(detalle.despues)})`;
  } catch { /* noop */ }
}
