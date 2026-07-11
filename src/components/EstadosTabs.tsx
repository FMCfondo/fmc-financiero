"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/estados/resultados", label: "Estado de Resultados" },
  { href: "/estados/situacion", label: "Situación Financiera" },
  { href: "/estados/flujo", label: "Flujo de Efectivo" },
  { href: "/estados/patrimonio", label: "Cambios en el Patrimonio" },
];

export default function EstadosTabs() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.get("p") ? `?p=${sp.get("p")}` : "";

  return (
    <div className="flex gap-1 p-1.5 rounded-xl brand-grad overflow-x-auto shadow-sm">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={`${t.href}${qs}`}
          className={`px-4 py-2 text-sm whitespace-nowrap rounded-lg transition-colors ${
            pathname === t.href ? "bg-white text-royal font-semibold shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
