"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Gauge, Landmark, Table2, Percent, Upload, Wallet, LineChart, Scale, ClipboardCheck, type LucideIcon,
} from "lucide-react";
import { NAV, MODOS, MODO_DEFAULT, CLAVE_MODO, visibleEn, type ModoApp } from "@/lib/modos";

const ICONOS: Record<string, LucideIcon> = { Gauge, Landmark, Table2, Percent, Upload, Wallet, LineChart, Scale, ClipboardCheck };

export default function Sidebar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.get("p") ? `?p=${sp.get("p")}` : "";
  // El modo es una preferencia de vista, no un permiso: se recuerda en el navegador.
  const [modo, setModo] = useState<ModoApp>(MODO_DEFAULT);
  useEffect(() => {
    try {
      const g = localStorage.getItem(CLAVE_MODO) as ModoApp | null;
      if (g === "reuniones" || g === "operacion") setModo(g);
    } catch { /* noop */ }
  }, []);
  const cambiar = (m: ModoApp) => {
    setModo(m);
    try { localStorage.setItem(CLAVE_MODO, m); } catch { /* noop */ }
  };
  const items = NAV.filter((i) => visibleEn(i, modo));

  return (
    <aside className="group fixed left-0 top-0 z-40 h-screen w-16 hover:w-[248px] overflow-hidden brand-grad text-white transition-[width] duration-200 ease-out shadow-xl shadow-[#0b1f52]/40 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center shrink-0 border-b border-white/10">
        <span className="w-16 flex justify-center shrink-0">
          <span className="h-8 w-8 rounded-lg bg-white/15 grid place-items-center text-base font-extrabold">F</span>
        </span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap leading-tight">
          <span className="block font-semibold text-sm">FMC Financiero</span>
          <span className="block text-[11px] text-white/60">Fondo Mutuo · S.A.S.</span>
        </span>
      </div>

      {/* Conmutador de modo: Reuniones (lo que ve la Junta) / Operación (tu trabajo) */}
      <div className="px-3 pt-3 pb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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

      {/* Nav */}
      <nav className="flex-1 py-2">
        {items.map(({ href, match, label, icono }) => {
          const Icon = ICONOS[icono] ?? Gauge;
          const active = pathname.startsWith(match);
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
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap text-sm">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="h-10 flex items-center shrink-0 border-t border-white/10">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap text-[11px] text-white/50 pl-4">
          FMC Financiero · v1
        </span>
      </div>
    </aside>
  );
}
