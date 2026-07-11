"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const VISTAS = [
  { id: "estado", label: "Estado" },
  { id: "vertical", label: "Análisis Vertical" },
  { id: "horizontal", label: "Análisis Horizontal" },
  { id: "ejec-acum", label: "Ejecución Acum.", soon: true },
  { id: "ejec-mes", label: "Ejecución Mes", soon: true },
];

export default function AnalisisTabs({ current }: { current: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const p = sp.get("p");
  const href = (id: string) => {
    const params = new URLSearchParams();
    if (p) params.set("p", p);
    if (id !== "estado") params.set("vista", id);
    const q = params.toString();
    return pathname + (q ? "?" + q : "");
  };
  return (
    <div className="flex gap-1.5 flex-wrap">
      {VISTAS.map((v) =>
        v.soon ? (
          <span key={v.id} className="px-3 py-1.5 rounded-lg text-xs border border-line text-faint/70 cursor-not-allowed whitespace-nowrap">
            {v.label} <span className="text-[9px] align-super">próx.</span>
          </span>
        ) : (
          <Link
            key={v.id}
            href={href(v.id)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors whitespace-nowrap ${
              current === v.id ? "bg-accentdim border-accent/40 text-accent2 font-medium" : "border-line text-muted hover:text-fg hover:bg-card2"
            }`}
          >
            {v.label}
          </Link>
        ),
      )}
    </div>
  );
}
