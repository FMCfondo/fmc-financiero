"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, Landmark, Table2, Target, Percent, Upload, ListTree, Wallet,
} from "lucide-react";

const NAV = [
  { href: "/", match: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/estados/resultados", match: "/estados", label: "Estados Financieros", icon: Landmark },
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
    <aside className="w-[248px] shrink-0 bg-panel border-r border-line hidden md:flex md:flex-col">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-line">
        <div className="h-9 w-9 rounded-xl brand-grad grid place-items-center text-base font-extrabold text-white shadow-lg shadow-royal/30">F</div>
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">FMC Financiero</div>
          <div className="text-[11px] text-faint">Fondo Mutuo · S.A.S.</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, match, label, icon: Icon }) => {
          const active = match === "/" ? pathname === "/" : pathname.startsWith(match);
          return (
            <Link
              key={href}
              href={`${href}${qs}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? "bg-accentdim text-white" : "text-muted hover:text-fg hover:bg-card2"
              }`}
            >
              <Icon size={18} className={active ? "text-sky" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-line text-[11px] text-faint">v1 · datos a MAY 2026</div>
    </aside>
  );
}
