import Link from "next/link";
import { cookies } from "next/headers";
import { ensureLoaded, parametros, parametrosJson } from "@/lib/data";
import { listarUsuarios, ultimosEventos, type EventoAuditoria } from "@/lib/auth";
import { soloAdmin, modulosJunta, MODULOS_JUNTA } from "@/lib/permisos";
import { COOKIE_CLAVE } from "@/lib/auth-cookie";
import { fmtCont } from "@/lib/format";
import {
  crearUsuarioAdmin, ocultarClave, restablecerClaveUsuario, activarUsuarioAdmin, cambiarRolUsuario, guardarModulosJunta,
} from "./actions";
import { Users, Eye, SlidersHorizontal, ScrollText, KeyRound, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

/* CONFIGURACIÓN — solo administrador. Cuatro pestañas:
   · Usuarios: crear (con contraseña generada, visible una sola vez), rol, activar o
     desactivar, restablecer contraseña, último acceso.
   · Junta: qué módulos ve un miembro de la Junta (interruptores).
   · Parámetros: qué hay y DÓNDE se edita cada cosa. No duplica editores.
   · Auditoría: quién hizo qué.
   Todo son formularios clásicos: funcionan sin JavaScript. */

type Vista = "usuarios" | "junta" | "parametros" | "auditoria";
const VISTAS: { id: Vista; label: string; Icon: typeof Users }[] = [
  { id: "usuarios", label: "Usuarios", Icon: Users },
  { id: "junta", label: "Lo que ve la Junta", Icon: Eye },
  { id: "parametros", label: "Parámetros", Icon: SlidersHorizontal },
  { id: "auditoria", label: "Auditoría", Icon: ScrollText },
];

const ERRORES: Record<string, string> = {
  datos: "Revisa el nombre y el correo.",
  repetido: "Ya hay un usuario con ese correo.",
  crear: "No se pudo crear el usuario.",
  noexiste: "Ese usuario no existe.",
  timismo: "No puedes desactivarte ni quitarte el rol de administrador a ti mismo.",
};

const ACCIONES: Record<string, string> = {
  login: "Entró", login_credenciales: "Intento fallido", login_bloqueado: "Intento con cuenta bloqueada",
  login_inactivo: "Intento con cuenta desactivada", logout: "Salió", clave_cambiada: "Cambió su contraseña",
  primer_admin: "Creó el primer administrador", usuario_creado: "Creó un usuario", clave_restablecida: "Restableció una contraseña",
  usuario_activado: "Activó un usuario", usuario_desactivado: "Desactivó un usuario", rol_cambiado: "Cambió un rol",
  junta_modulos: "Cambió lo que ve la Junta",
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }) : "—";
const pct = (v: number) => `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;

export default async function ConfiguracionPage({ searchParams }: {
  searchParams: Promise<{ v?: string; error?: string; ok?: string }>;
}) {
  const yo = await soloAdmin();
  const { v, error, ok } = await searchParams;
  const vista: Vista = (VISTAS.some((x) => x.id === v) ? v : "usuarios") as Vista;
  await ensureLoaded();

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted mt-0.5">Usuarios, lo que ve la Junta, parámetros y auditoría · solo administrador</p>
      </div>

      <div className="flex gap-1 p-1.5 rounded-xl brand-grad overflow-x-auto shadow-sm w-fit">
        {VISTAS.map(({ id, label, Icon }) => (
          <Link key={id} href={`/configuracion?v=${id}`}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap rounded-lg transition-colors ${
              vista === id ? "bg-white text-royal font-semibold shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
            <Icon size={14} />{label}
          </Link>
        ))}
      </div>

      {error && <p className="flex items-center gap-2 text-sm text-neg"><AlertTriangle size={14} /> {ERRORES[error] ?? "No se pudo completar."}</p>}

      {vista === "usuarios" && <Usuarios yoId={yo.id} />}
      {vista === "junta" && <Junta ok={ok === "1"} />}
      {vista === "parametros" && <Parametros />}
      {vista === "auditoria" && <Auditoria />}
    </div>
  );
}

/* ------------------------------------------------------------- usuarios --- */
async function Usuarios({ yoId }: { yoId: string }) {
  const lista = await listarUsuarios();
  const nueva = await claveNueva();

  return (
    <div className="space-y-5">
      {nueva && (
        <div className="card p-5 border-pos/40 space-y-2">
          <div className="flex items-center gap-2 font-medium"><KeyRound size={16} className="text-pos" /> Contraseña inicial de {nueva.nombre}</div>
          <p className="text-sm text-muted">Compártela con <b className="text-fg">{nueva.email}</b> por el canal que prefieras. Al entrar, el sistema le pedirá cambiarla. <b>No volverá a mostrarse.</b></p>
          <code className="block w-fit rounded-lg bg-card2 border border-line px-4 py-2 text-lg tnum tracking-wide select-all">{nueva.clave}</code>
          <form action={ocultarClave}><button type="submit" className="text-xs text-accent2 hover:underline">Ya la copié, ocultar</button></form>
        </div>
      )}

      <form action={crearUsuarioAdmin} className="card p-5 space-y-3">
        <h2 className="font-medium">Nuevo usuario</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Campo label="Nombre" name="nombre" />
          <Campo label="Correo" name="email" type="email" />
          <div>
            <label htmlFor="rol" className="text-xs text-muted block mb-1">Rol</label>
            <select id="rol" name="rol" defaultValue="junta" className="w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent">
              <option value="junta">Miembro de Junta (solo lectura)</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full px-4 py-2 rounded-lg brand-grad text-white text-sm font-medium">Crear y generar contraseña</button>
          </div>
        </div>
        <p className="text-xs text-muted">La contraseña se genera sola (tres palabras y dos cifras) y se muestra una sola vez. El usuario la cambia al primer ingreso.</p>
      </form>

      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              {["Nombre", "Correo", "Rol", "Estado", "Último acceso", ""].map((h, i) => (
                <th key={i} className="px-3 py-2.5 border-b border-line font-normal text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className={`hover:bg-card2/60 ${!u.activo ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 border-b border-line-soft font-medium whitespace-nowrap">{u.nombre}{u.id === yoId && <span className="ml-2 text-[10px] uppercase tracking-wide text-faint">tú</span>}</td>
                <td className="px-3 py-2 border-b border-line-soft text-muted">{u.email}</td>
                <td className="px-3 py-2 border-b border-line-soft">
                  <form action={cambiarRolUsuario} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="rol" defaultValue={u.rol} className="bg-card2 border border-line rounded-md px-2 py-1 text-xs">
                      <option value="junta">junta</option>
                      <option value="admin">admin</option>
                    </select>
                    <button type="submit" className="text-xs text-accent2 hover:underline">cambiar</button>
                  </form>
                </td>
                <td className="px-3 py-2 border-b border-line-soft whitespace-nowrap text-xs">
                  {u.activo ? <span className="text-pos">Activo</span> : <span className="text-neg">Desactivado</span>}
                  {u.bloqueado && <span className="ml-2 text-[#8A6A1D]">· bloqueado 15 min</span>}
                  {u.debeCambiarClave && <span className="ml-2 text-muted">· debe cambiar clave</span>}
                </td>
                <td className="px-3 py-2 border-b border-line-soft text-xs text-muted whitespace-nowrap">{fecha(u.ultimoAcceso)}</td>
                <td className="px-3 py-2 border-b border-line-soft whitespace-nowrap">
                  <div className="flex items-center gap-3 text-xs">
                    <form action={restablecerClaveUsuario}>
                      <input type="hidden" name="id" value={u.id} />
                      <button type="submit" className="text-accent2 hover:underline">restablecer clave</button>
                    </form>
                    {u.id !== yoId && (
                      <form action={activarUsuarioAdmin}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="activo" value={u.activo ? "0" : "1"} />
                        <button type="submit" className={u.activo ? "text-neg hover:underline" : "text-pos hover:underline"}>
                          {u.activo ? "desactivar" : "activar"}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Desactivar cierra las sesiones de esa persona en el acto; no se borran usuarios para conservar la auditoría.</p>
    </div>
  );
}

async function claveNueva(): Promise<{ email: string; nombre: string; clave: string } | null> {
  try {
    const raw = (await cookies()).get(COOKIE_CLAVE)?.value;
    return raw ? (JSON.parse(raw) as { email: string; nombre: string; clave: string }) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- lo que ve la Junta --- */
function Junta({ ok }: { ok: boolean }) {
  const activos = new Set(modulosJunta());
  return (
    <form action={guardarModulosJunta} className="card p-5 space-y-4 max-w-xl">
      <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-accent2" /><h2 className="font-medium">Módulos visibles para la Junta</h2></div>
      <p className="text-sm text-muted">Un miembro de la Junta solo lee, y solo estos módulos. Lo que desmarques desaparece de su menú y le rebota si escribe la dirección a mano. Nada de Operación se le puede habilitar.</p>
      <div className="space-y-2">
        {MODULOS_JUNTA.map((m) => (
          <label key={m.href} className="flex items-center gap-3 text-sm cursor-pointer">
            <input type="checkbox" name="modulo" value={m.href} defaultChecked={activos.has(m.href)} className="accent-[#13286E] h-4 w-4" />
            {m.label} <span className="text-xs text-faint">{m.href}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="px-4 py-2 rounded-lg brand-grad text-white text-sm font-medium">Guardar</button>
        {ok && <span className="flex items-center gap-1.5 text-sm text-pos"><CheckCircle2 size={14} /> Guardado. Se aplica en la siguiente petición de cada miembro.</span>}
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- parámetros --- */
function Parametros() {
  const filas: { clave: string; label: string; valor: string; donde: { href: string; label: string } | null }[] = [
    { clave: "tasa_imporenta", label: "Tasa de impuesto de renta", valor: pct(parametros.tasa_imporenta ?? 0), donde: { href: "/impuesto", label: "Provisión de Impuesto" } },
    { clave: "prov_otros_nd", label: "Otros gastos no deducibles", valor: fmtCont(parametros.prov_otros_nd ?? 0, true), donde: { href: "/impuesto", label: "Provisión de Impuesto" } },
    { clave: "prov_anticipo_ret", label: "Anticipos (retención en la fuente)", valor: fmtCont(parametros.prov_anticipo_ret ?? 0, true), donde: { href: "/impuesto", label: "Provisión de Impuesto" } },
    { clave: "prov_anticipo_sig", label: "Anticipo para el siguiente año", valor: fmtCont(parametros.prov_anticipo_sig ?? 0, true), donde: { href: "/impuesto", label: "Provisión de Impuesto" } },
    { clave: "bench_cdt180", label: "Referencia CDT 180 días (BanRep)", valor: pct(parametros.bench_cdt180 ?? 0), donde: { href: "/portafolio?v=mantenimiento", label: "Portafolio › Mantenimiento" } },
    { clave: "ipc_12m", label: "Inflación 12 meses (IPC)", valor: pct(parametros.ipc_12m ?? 0), donde: { href: "/portafolio?v=mantenimiento", label: "Portafolio › Mantenimiento" } },
    { clave: "junta_modulos", label: "Módulos visibles para la Junta", valor: modulosJunta().join(", "), donde: { href: "/configuracion?v=junta", label: "Lo que ve la Junta" } },
  ];
  const conocidas = new Set(filas.map((f) => f.clave));
  const heredadas = Object.keys(parametrosJson).filter((k) => !conocidas.has(k)).sort();
  return (
    <div className="space-y-4">
      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              {["Parámetro", "Valor", "Se edita en"].map((h) => <th key={h} className="px-3 py-2.5 border-b border-line font-normal text-left">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="hover:bg-card2/60">
                <td className="px-3 py-2 border-b border-line-soft">{f.label} <span className="text-[11px] text-faint">{f.clave}</span></td>
                <td className="px-3 py-2 border-b border-line-soft tnum">{f.valor}</td>
                <td className="px-3 py-2 border-b border-line-soft">{f.donde ? <Link href={f.donde.href} className="text-accent2 hover:underline text-xs">{f.donde.label}</Link> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {heredadas.length > 0 && (
        <p className="text-xs text-muted">Sin uso hoy (heredados de versiones anteriores): {heredadas.join(", ")}.</p>
      )}
      <p className="text-xs text-muted max-w-3xl">Cada parámetro se edita donde se entiende —la provisión junto a su cálculo, las referencias junto al portafolio— y aquí solo se ve el conjunto. Un mismo dato no debe tener dos editores.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- auditoría --- */
async function Auditoria() {
  const [eventos, usuarios] = await Promise.all([ultimosEventos(200), listarUsuarios()]);
  // En «Sobre» se muestra el nombre de la persona, no su identificador interno.
  const nombreDe = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const sobre = (e: EventoAuditoria) => {
    if (e.entidad === "usuario" && e.registro) return nombreDe.get(e.registro) ?? e.registro;
    if (e.entidad === "parametro" && e.registro === "junta_modulos") return "Módulos visibles para la Junta";
    return [e.entidad, e.registro].filter(Boolean).join(" · ");
  };
  return (
    <div className="space-y-3">
      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              {["Cuándo", "Quién", "Qué", "Sobre"].map((h) => <th key={h} className="px-3 py-2.5 border-b border-line font-normal text-left">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id} className="hover:bg-card2/60">
                <td className="px-3 py-1.5 border-b border-line-soft text-xs text-muted whitespace-nowrap tnum">{fecha(e.ts)}</td>
                <td className="px-3 py-1.5 border-b border-line-soft whitespace-nowrap">{e.usuario ? e.usuario.nombre : <span className="text-faint">—</span>}</td>
                <td className="px-3 py-1.5 border-b border-line-soft">{ACCIONES[e.accion] ?? e.accion}</td>
                <td className="px-3 py-1.5 border-b border-line-soft text-xs text-muted">{sobre(e)}</td>
              </tr>
            ))}
            {eventos.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-sm text-muted">Sin eventos todavía.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Los últimos 200 eventos. En los intentos fallidos de entrada, «Sobre» muestra el correo que se intentó.</p>
    </div>
  );
}

function Campo({ label, name, type = "text" }: { label: string; name: string; type?: string }) {
  return (
    <div>
      <label htmlFor={`c-${name}`} className="text-xs text-muted block mb-1">{label}</label>
      <input id={`c-${name}`} name={name} type={type} required
        className="w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent" />
    </div>
  );
}
