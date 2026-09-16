"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/* Las vistas de un estado, en el orden que pidió el usuario (2026-09-16): primero el
   estado, después cómo va contra el presupuesto, después las comparaciones. La
   ejecución solo aplica al Estado de Resultados (`ejec`). El presupuesto en sí ya no
   está aquí: vive en su módulo (/presupuesto). */
export default function AnalisisTabs({ current, ejec = true }: { current: string; ejec?: boolean }) {
  const VISTAS = [
    { id: "estado", label: "Estado" },
    ...(ejec ? [{ id: "ejecucion", label: "Ejecución Presupuestal" }] : []),
    { id: "interanual", label: "Comparación interanual" },
    { id: "vertical", label: "Análisis Vertical" },
    { id: "horizontal", label: "Análisis Horizontal" },
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
      {VISTAS.map((v) => (
        <Link key={v.id} href={href(v.id)} className={current === v.id ? "on" : ""}>{v.label}</Link>
      ))}
    </div>
  );
}
