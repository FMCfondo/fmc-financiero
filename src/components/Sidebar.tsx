"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Gauge, Landmark, Table2, Percent, Upload, Wallet, LineChart, FileText, ClipboardCheck, Target, Settings, type LucideIcon,
} from "lucide-react";
import { NAV, MODOS, MODO_DEFAULT, escribirModo, leerModo, visibleEn, type ModoApp } from "@/lib/modos";

const ICONOS: Record<string, LucideIcon> = { Gauge, Landmark, Table2, Percent, Upload, Wallet, LineChart, FileText, ClipboardCheck, Target, Settings };

/* La barra recibe del servidor QUÉ puede ver este usuario (`modulos`, ya filtrado por
   rol y por lo que el administrador habilitó). Aquí solo se pinta:
   · admin: el conmutador Reuniones/Operación y el menú según el modo, como siempre;
   · junta: sin conmutador —no tiene Operación—, y el modo se fija en Reuniones para
     que ningún componente que lo lea del navegador ofrezca botones de edición.
   Esconder no es proteger: las rutas y las acciones se defienden en el servidor. */
export default function Sidebar({ rol, modulos }: { rol: "admin" | "junta"; modulos: string[] }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.get("p") ? `?p=${sp.get("p")}` : "";
  const esAdmin = rol === "admin";
  // El modo es una preferencia de vista, no un permiso: se recuerda en el navegador.
  const [modo, setModo] = useState<ModoApp>(MODO_DEFAULT);
  useEffect(() => {
    if (esAdmin) setModo(leerModo());
    else escribirModo("reuniones");   // la Junta no tiene Operación, ni en un navegador compartido
  }, [esAdmin]);
  const cambiar = (m: ModoApp) => {
    setModo(m);
    escribirModo(m);   // avisa a quien dependa del modo en esta misma pestaña
  };
  const items = NAV.filter((i) => modulos.includes(i.href) && (!esAdmin || visibleEn(i, modo)));

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[248px] overflow-hidden brand-grad text-white shadow-xl shadow-[#0b1f52]/40 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center shrink-0 border-b border-white/10">
        <span className="w-16 flex justify-center shrink-0">
          <span className="h-8 w-8 rounded-lg bg-white/15 grid place-items-center text-base font-extrabold">F</span>
        </span>
        <span className="whitespace-nowrap leading-tight">
          <span className="block font-semibold text-sm">FMC Financiero</span>
          <span className="block text-[11px] text-white/60">Fondo Mutuo · S.A.S.</span>
        </span>
      </div>

      {/* Conmutador de modo: Reuniones (lo que ve la Junta) / Operación (tu trabajo). Solo admin. */}
      {esAdmin ? (
        <div className="px-3 pt-3 pb-1">
          <div className="flex gap-1 p-1 rounded-lg bg-black/20">
            {MODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => cambiar(m.id)}
                title={m.desc}
                className={`flex-1 text-[11.5px] font-semibold py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  modo === m.id ? "bg-white text-royal2" : "text-white/60 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-white/50">Junta Directiva</div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-2">
        {items.map(({ href, match, label, icono }) => {
          const Icon = ICONOS[icono] ?? Gauge;
          const active = (Array.isArray(match) ? match : [match]).some((m) => pathname.startsWith(m));
          return (
            <Link
              key={href}
              href={`${href}${qs}`}
              title={label}
              className={`flex items-center h-11 transition-colors ${
                active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="w-16 flex justify-center shrink-0 relative">
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-sky" />}
                <Icon size={20} />
              </span>
              <span className="whitespace-nowrap text-sm">{label}</span>
            </Link>
          );
        })}
        {items.length === 0 && (
          <p className="px-4 py-3 text-xs text-white/60">No tienes módulos habilitados. Habla con el administrador.</p>
        )}
      </nav>

      <div className="h-10 flex items-center shrink-0 border-t border-white/10">
        <span className="whitespace-nowrap text-[11px] text-white/50 pl-4">
          FMC Financiero · v1
        </span>
      </div>
    </aside>
  );
}
