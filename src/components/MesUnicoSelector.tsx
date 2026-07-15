"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Selector de UN mes (?mes=1..12) para la comparación interanual:
 *  se elige el mes y las columnas son ese mes en todos los años. */
export default function MesUnicoSelector({ current }: { current: number }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const href = (n: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("mes", String(n));
    return pathname + "?" + params.toString();
  };
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-medium text-fg mr-1">Mes a comparar:</span>
      {MESES.map((m, i) => (
        <Link
          key={m}
          href={href(i + 1)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
            current === i + 1 ? "bg-royal text-white border-royal" : "border-line text-muted hover:text-fg hover:bg-card2"
          }`}
        >
          {m}
        </Link>
      ))}
    </div>
  );
}
