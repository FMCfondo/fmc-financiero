"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/* Segmentador de la Comparación interanual: unidad de período (mes, bimestre,
   trimestre, cuatrimestre, semestre, año) + índice dentro del año. Las columnas
   del informe son ese período en TODOS los años de funcionamiento. */

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const UNIDADES = [
  { id: "mes", label: "Mes", n: 12, pre: "" },
  { id: "bimestre", label: "Bimestre", n: 6, pre: "B" },
  { id: "trimestre", label: "Trimestre", n: 4, pre: "T" },
  { id: "cuatrimestre", label: "Cuatrimestre", n: 3, pre: "C" },
  { id: "semestre", label: "Semestre", n: 2, pre: "S" },
  { id: "anio", label: "Año completo", n: 1, pre: "" },
] as const;

export default function InteranualSelector({ unidad, idx }: { unidad: string; idx: number }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const href = (u: string, i: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("vista", "interanual");
    params.set("unidad", u);
    params.set("idx", String(i));
    return pathname + "?" + params.toString();
  };
  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
      active ? "bg-royal text-white border-royal" : "border-line text-muted hover:text-fg hover:bg-card2"
    }`;
  const u = UNIDADES.find((x) => x.id === unidad) ?? UNIDADES[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-fg mr-1">Período:</span>
        {UNIDADES.map((x) => (
          <Link key={x.id} href={href(x.id, 1)} className={chip(unidad === x.id)}>{x.label}</Link>
        ))}
      </div>
      {u.n > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-fg mr-1">{u.label}:</span>
          {Array.from({ length: u.n }, (_, i) => i + 1).map((i) => (
            <Link key={i} href={href(u.id, i)} className={chip(idx === i)}>
              {u.id === "mes" ? MESES[i - 1] : `${u.pre}${i}`}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
