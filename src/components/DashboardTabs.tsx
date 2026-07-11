"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "activos", label: "Activos" },
  { id: "pasivos", label: "Pasivos" },
  { id: "ingresos", label: "Ingresos" },
  { id: "gastos", label: "Gastos" },
];

export default function DashboardTabs({ current }: { current: string }) {
  const sp = useSearchParams();
  const p = sp.get("p");
  const href = (id: string) => {
    const params = new URLSearchParams();
    if (p) params.set("p", p);
    if (id !== "resumen") params.set("tab", id);
    const q = params.toString();
    return "/" + (q ? "?" + q : "");
  };
  return (
    <div className="flex gap-1 p-1.5 rounded-xl brand-grad overflow-x-auto shadow-sm">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={href(t.id)}
          className={`px-4 py-2 text-sm whitespace-nowrap rounded-lg transition-colors ${
            current === t.id ? "bg-white text-royal font-semibold shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
