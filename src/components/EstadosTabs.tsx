"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/estados/resultados", label: "Estado de Resultados" },
  { href: "/estados/situacion", label: "Situación Financiera" },
  { label: "Flujo de Efectivo", soon: true },
  { label: "Cambios en el Patrimonio", soon: true },
];

export default function EstadosTabs() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.get("p") ? `?p=${sp.get("p")}` : "";

  return (
    <div className="flex gap-1 p-1.5 rounded-xl brand-grad overflow-x-auto shadow-sm">
      {TABS.map((t) =>
        t.soon ? (
          <span key={t.label} className="px-4 py-2 text-sm text-white/45 whitespace-nowrap cursor-not-allowed rounded-lg">
            {t.label} <span className="text-[10px] align-super">próx.</span>
          </span>
        ) : (
          <Link
            key={t.href}
            href={`${t.href}${qs}`}
            className={`px-4 py-2 text-sm whitespace-nowrap rounded-lg transition-colors ${
              pathname === t.href ? "bg-white text-royal font-semibold shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ),
      )}
    </div>
  );
}
