"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Gauge, Landmark, TrendingUp, Droplets, Calculator, LineChart } from "lucide-react";

export const SECCIONES = [
  { id: "resumen", label: "Resumen", icon: Gauge },
  { id: "situacion", label: "Situación Financiera", icon: Landmark },
  { id: "resultados", label: "Resultados", icon: TrendingUp },
  { id: "flujo", label: "Flujo de Efectivo", icon: Droplets },
  { id: "indicadores", label: "Indicadores", icon: Calculator },
  { id: "tendencias", label: "Tendencias", icon: LineChart },
] as const;

export default function SeccionesTabs({ current }: { current: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const p = sp.get("p");

  const href = (id: string) => {
    const params = new URLSearchParams();
    if (p) params.set("p", p);
    if (id !== "resumen") params.set("sec", id);
    const q = params.toString();
    return pathname + (q ? "?" + q : "");
  };

  return (
    <div className="flex gap-1 p-1.5 rounded-xl brand-grad overflow-x-auto shadow-sm">
      {SECCIONES.map(({ id, label, icon: Icon }) => (
        <Link
          key={id}
          href={href(id)}
          className={`flex items-center gap-2 px-3.5 py-2 text-sm whitespace-nowrap rounded-lg transition-colors ${
            current === id ? "bg-white text-royal font-semibold shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon size={15} />
          {label}
        </Link>
      ))}
    </div>
  );
}
