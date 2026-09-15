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
  const u = UNIDADES.find((x) => x.id === unidad) ?? UNIDADES[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center flex-wrap gap-y-2">
        <span className="seg-label">Período</span>
        <div className="seg flex-wrap">
          {UNIDADES.map((x) => (
            <Link key={x.id} href={href(x.id, 1)} className={unidad === x.id ? "on" : ""}>{x.label}</Link>
          ))}
        </div>
      </div>
      {u.n > 1 && (
        <div className="flex items-center flex-wrap gap-y-2">
          <span className="seg-label">{u.label}</span>
          <div className="seg flex-wrap">
            {Array.from({ length: u.n }, (_, i) => i + 1).map((i) => (
              <Link key={i} href={href(u.id, i)} className={idx === i ? "on" : ""}>
                {u.id === "mes" ? MESES[i - 1] : `${u.pre}${i}`}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
