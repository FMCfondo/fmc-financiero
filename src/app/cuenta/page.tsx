import { obtenerSesion, MIN_CLAVE } from "@/lib/auth";
import { cambiarMiClave } from "./actions";
import { KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const ERRORES: Record<string, string> = {
  actual: "La contraseña actual no es correcta.",
  clave_corta: `La nueva debe tener al menos ${MIN_CLAVE} caracteres.`,
  no_coincide: "Las dos contraseñas nuevas no coinciden.",
  misma: "La nueva no puede ser igual a la actual.",
};

/* Mi cuenta: quién soy y cambiar mi contraseña. Cuando el administrador crea una
   cuenta, el primer ingreso llega aquí con ?obligatorio=1 y el layout no deja ir a
   ningún otro sitio hasta cambiarla. */
export default async function CuentaPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; obligatorio?: string }> }) {
  const { error, ok, obligatorio } = await searchParams;
  const s = await obtenerSesion();
  if (!s) return null; // el proxy ya habría redirigido
  const u = s.usuario;
  const forzado = obligatorio === "1" || u.debeCambiarClave;

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted mt-0.5">{u.nombre} · {u.email} · {u.rol === "admin" ? "administrador" : "miembro de Junta"}</p>
      </div>

      {forzado && (
        <div className="card p-4 flex items-start gap-3 border-gold/50 text-sm">
          <AlertTriangle size={16} className="text-[#8A6A1D] mt-0.5 shrink-0" />
          <span>Esta contraseña te la asignó el administrador. <b>Cámbiala ahora</b> para continuar: nadie más debería conocerla.</span>
        </div>
      )}

      <form action={cambiarMiClave} className="card p-5 space-y-3">
        <div className="flex items-center gap-2"><KeyRound size={16} className="text-accent2" /><h2 className="font-medium">Cambiar contraseña</h2></div>
        <input type="hidden" name="obligatorio" value={forzado ? "1" : "0"} />
        <Campo label="Contraseña actual" name="actual" autoComplete="current-password" />
        <Campo label={`Nueva contraseña (mínimo ${MIN_CLAVE} caracteres)`} name="nueva" autoComplete="new-password" />
        <Campo label="Repite la nueva" name="confirma" autoComplete="new-password" />
        {error && <p className="flex items-center gap-2 text-sm text-neg"><AlertTriangle size={14} /> {ERRORES[error] ?? "No se pudo cambiar."}</p>}
        {ok && <p className="flex items-center gap-2 text-sm text-pos"><CheckCircle2 size={14} /> Contraseña cambiada. Las demás sesiones que tuvieras abiertas se cerraron.</p>}
        <button type="submit" className="px-4 py-2 rounded-lg brand-grad text-white text-sm font-medium">Guardar la nueva contraseña</button>
      </form>
    </div>
  );
}

function Campo({ label, name, autoComplete }: { label: string; name: string; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={name} className="text-xs text-muted block mb-1">{label}</label>
      <input id={name} name={name} type="password" required autoComplete={autoComplete}
        className="w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent" />
    </div>
  );
}
