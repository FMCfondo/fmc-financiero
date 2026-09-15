"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function AnalisisTabs({ current, ejec = true }: { current: string; ejec?: boolean }) {
  const VISTAS = [
    { id: "estado", label: "Estado", soon: false },
    { id: "vertical", label: "Análisis Vertical", soon: false },
    { id: "horizontal", label: "Análisis Horizontal", soon: false },
    { id: "interanual", label: "Comparación interanual", soon: false },
    // El presupuesto y su ejecución solo aplican al Estado de Resultados.
    ...(ejec ? [
      { id: "presupuesto", label: "Presupuesto", soon: false },
      { id: "ejec-acum", label: "Ejecución Acum.", soon: false },
      { id: "ejec-mes", label: "Ejecución Mes", soon: false },
    ] : []),
  ];
  const pathname = usePathname();
  const sp = useSearchParams();
  const href = (id: string) => {
    // Conserva los demás segmentadores (p, anio, meses) al cambiar de vista.
    const params = new URLSearchParams(sp.toString());
    if (id === "estado") params.delete("vista");
    else params.set("vista", id);
    const q = params.toString();
    return pathname + (q ? "?" + q : "");
  };
  return (
    <div className="seg flex-wrap">
      {VISTAS.map((v) =>
        v.soon ? (
          <span key={v.id} className="off">{v.label}</span>
        ) : (
          <Link key={v.id} href={href(v.id)} className={current === v.id ? "on" : ""}>{v.label}</Link>
        ),
      )}
    </div>
  );
}
