import { redirect } from "next/navigation";
import { hayUsuarios, obtenerSesion, MIN_CLAVE } from "@/lib/auth";
import { inicioDe } from "@/lib/permisos";
import { LogIn, ShieldCheck, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

/* /entrar — la única página sin sesión. Dos caras:
   · si todavía no hay ningún usuario, crea el PRIMER administrador (una sola vez);
   · si ya hay, pide correo y contraseña.
   El layout raíz la pinta sin barra lateral porque no hay sesión. Los formularios
   son HTML clásico contra /api/sesion (redirección 303 real): al entrar cambia el
   layout entero y eso solo es fiable con una carga completa de la página. */

const ERRORES: Record<string, string> = {
  faltan: "Escribe el correo y la contraseña.",
  credenciales: "Correo o contraseña incorrectos.",
  bloqueado: "Demasiados intentos. Espera quince minutos y vuelve a intentarlo.",
  inactivo: "Esta cuenta está desactivada. Habla con el administrador.",
  datos: "Revisa el nombre y el correo.",
  clave_corta: `La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`,
  no_coincide: "Las dos contraseñas no coinciden.",
  ya_hay_admin: "Ya existe un administrador: entra con tu cuenta.",
  sin_tablas: "Faltan las tablas de usuarios en la base. Ejecuta scripts/migrate-usuarios.mjs.",
};

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ error?: string; volver?: string }> }) {
  const { error, volver } = await searchParams;
  const s = await obtenerSesion();
  if (s) redirect(await inicioDe(s.usuario));
  const primeraVez = !(await hayUsuarios());

  return (
    <div className="min-h-screen grid place-items-center p-6 brand-grad">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 text-white mb-6">
          <span className="h-11 w-11 rounded-xl bg-white/15 grid place-items-center text-lg font-extrabold">F</span>
          <div>
            <div className="font-semibold">FMC Financiero</div>
            <div className="text-xs text-white/70">Fondo Mutuo de Cobertura · S.A.S.</div>
          </div>
        </div>

        <div className="card p-6 space-y-4 shadow-2xl">
          {primeraVez ? (
            <>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-accent2" />
                <h1 className="font-semibold">Crear el primer administrador</h1>
              </div>
              <p className="text-sm text-muted">
                Todavía no hay usuarios. Esta cuenta será la que cree las demás; este paso solo aparece una vez.
              </p>
              <form method="post" action="/api/sesion/primer-admin" className="space-y-3">
                <Campo label="Nombre" name="nombre" autoComplete="name" />
                <Campo label="Correo" name="email" type="email" autoComplete="username" />
                <Campo label={`Contraseña (mínimo ${MIN_CLAVE} caracteres)`} name="clave" type="password" autoComplete="new-password" />
                <Campo label="Repite la contraseña" name="confirma" type="password" autoComplete="new-password" />
                {error && <Aviso msg={ERRORES[error] ?? "No se pudo crear la cuenta."} />}
                <Boton>Crear y entrar</Boton>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <LogIn size={18} className="text-accent2" />
                <h1 className="font-semibold">Entrar</h1>
              </div>
              <form method="post" action="/api/sesion/entrar" className="space-y-3">
                <input type="hidden" name="volver" value={volver ?? ""} />
                <Campo label="Correo" name="email" type="email" autoComplete="username" />
                <Campo label="Contraseña" name="clave" type="password" autoComplete="current-password" />
                {error && <Aviso msg={ERRORES[error] ?? "No se pudo entrar."} />}
                <Boton>Entrar</Boton>
              </form>
              <p className="text-xs text-muted">¿Olvidaste la contraseña? El administrador puede restablecerla.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Campo({ label, name, type = "text", autoComplete }: { label: string; name: string; type?: string; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={name} className="text-xs text-muted block mb-1">{label}</label>
      <input id={name} name={name} type={type} required autoComplete={autoComplete}
        className="w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent" />
    </div>
  );
}
function Aviso({ msg }: { msg: string }) {
  return <p className="flex items-center gap-2 text-sm text-neg"><AlertTriangle size={14} /> {msg}</p>;
}
function Boton({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" className="w-full px-4 py-2.5 rounded-lg brand-grad text-white text-sm font-medium">
      {children}
    </button>
  );
}
