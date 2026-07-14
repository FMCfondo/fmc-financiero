"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Landmark, Table2, Target, Percent, Upload, ListTree, Wallet,
} from "lucide-react";

const NAV = [
  { href: "/estados/dashboard", match: "/estados", label: "Estados Financieros", icon: Landmark },
  { href: "/balances", match: "/balances", label: "Balances / Resumen", icon: Table2 },
  { href: "/ejecucion", match: "/ejecucion", label: "Ejecución Presupuestal", icon: Target },
  { href: "/impuesto", match: "/impuesto", label: "Provisión de Impuesto", icon: Percent },
  { href: "/portafolio", match: "/portafolio", label: "Portafolio", icon: Wallet },
  { href: "/cuentas", match: "/cuentas", label: "Plan de Cuentas", icon: ListTree },
  { href: "/ingesta", match: "/ingesta", label: "Cargar Balance", icon: Upload },
];

export default function Sidebar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.get("p") ? `?p=${sp.get("p")}` : "";

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

      {/* Nav */}
      <nav className="flex-1 py-3">
        {NAV.map(({ href, match, label, icon: Icon }) => {
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
          v1 · datos a MAY 2026
        </span>
      </div>
    </aside>
  );
}
