import Link from "next/link";
import { salir } from "@/app/entrar/actions";
import { LogOut, UserRound, Settings } from "lucide-react";

/* Quién está dentro y la puerta de salida. Es un formulario clásico, no un botón con
   JavaScript: salir tiene que funcionar aunque nada se haya hidratado. */
export default function MenuUsuario({ nombre, rol }: { nombre: string; rol: "admin" | "junta" }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/cuenta" className="flex items-center gap-2 text-muted hover:text-fg" title="Mi cuenta">
        <UserRound size={15} />
        <span className="hidden md:inline">{nombre}</span>
        <span className="hidden lg:inline text-[11px] uppercase tracking-wide text-faint">{rol === "admin" ? "admin" : "junta"}</span>
      </Link>
      {rol === "admin" && (
        <Link href="/configuracion" className="flex items-center gap-1.5 text-muted hover:text-fg" title="Configuración">
          <Settings size={15} /><span className="hidden lg:inline">Configuración</span>
        </Link>
      )}
      <form action={salir}>
        <button type="submit" className="flex items-center gap-1.5 text-muted hover:text-fg" title="Salir">
          <LogOut size={15} /><span className="hidden md:inline">Salir</span>
        </button>
      </form>
    </div>
  );
}
