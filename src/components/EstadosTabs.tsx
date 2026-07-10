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
    <div className="flex gap-1 border-b border-line overflow-x-auto">
      {TABS.map((t) =>
        t.soon ? (
          <span key={t.label} className="px-4 py-2.5 text-sm text-faint/60 whitespace-nowrap cursor-not-allowed">
            {t.label} <span className="text-[10px] align-super">próx.</span>
          </span>
        ) : (
          <Link
            key={t.href}
            href={`${t.href}${qs}`}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              pathname === t.href ? "border-sky text-fg font-medium" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </Link>
        ),
      )}
    </div>
  );
}
