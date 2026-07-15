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
  const href = (a: string | null) => {
    const params = new URLSearchParams(sp.toString());
    if (a === null) params.delete("anio");
    else params.set("anio", a);
    const q = params.toString();
    return pathname + (q ? "?" + q : "");
  };
  const cls = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs border transition-colors ${
      active ? "bg-accentdim border-accent/40 text-accent2 font-medium" : "border-line text-muted hover:text-fg hover:bg-card2"
    }`;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted mr-1">Año:</span>
      <Link href={href(null)} className={cls(!current)}>Últimos</Link>
      {ANIOS.map((a) => (
        <Link key={a} href={href(a)} className={cls(current === Number(a))}>{a}</Link>
      ))}
    </div>
  );
}
