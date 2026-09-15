"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PERIODOS } from "@/lib/periodos";

const ANIOS = [...new Set(PERIODOS.map((p) => p.slice(3)))];

/** Segmentador de año (?anio=). Con año elegido se muestran todos sus meses;
 *  "Últimos" vuelve al modo de N meses recientes (segmentador de meses). */
export default function AnioSelector({ current }: { current?: number }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  // El defecto (sin ?anio) es el AÑO ACTUAL del corte; "Últimos" se pide explícito.
  const href = (a: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("anio", a);
    const q = params.toString();
    return pathname + (q ? "?" + q : "");
  };
  return (
    <div className="flex items-center">
      <span className="seg-label">Año</span>
      <div className="seg">
        <Link href={href("ultimos")} className={!current ? "on" : ""}>Últimos</Link>
        {ANIOS.map((a) => (
          <Link key={a} href={href(a)} className={current === Number(a) ? "on" : ""}>{a}</Link>
        ))}
      </div>
    </div>
  );
}
