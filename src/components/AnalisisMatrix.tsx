"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

/* Análisis vertical / horizontal con la misma vista del Estado:
   árbol de cuentas en filas, meses en columnas, valores en %.
   Vertical  → participación sobre la base de ese mes.
   Horizontal→ variación contra el mismo mes del año anterior (— si no existe). */

export type NodoPct = {
  codigo: string; nombre: string; depth: number;
  vals: (number | null)[]; hijos: NodoPct[];
};

const MAX_SANGRIA = 4;
const CELL = "px-3 py-[7px] text-right tnum tabular-nums whitespace-nowrap";

const fmt = (v: number | null) => {
  if (v === null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = a.toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: a < 10 ? 1 : 0 });
  return v < 0 ? `(${s})%` : `${s}%`;
};

export default function AnalisisMatrix({
  labels, secciones, colorear,
}: {
  labels: string[];
  secciones: { titulo: string; arbol: NodoPct[]; totalVals: (number | null)[] }[];
  /** true en horizontal: verde crece / rojo cae. En vertical no se colorea. */
  colorear?: boolean;
}) {
  return (
    <div className="card overflow-auto">
      <table className="text-sm border-collapse w-max min-w-full">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted">
            <th className="sticky left-0 z-10 bg-card text-left font-normal px-5 py-2.5 border-b border-line min-w-[280px]">Cuenta</th>
            {labels.map((l) => (
              <th key={l} className="text-right font-normal px-3 py-2.5 border-b border-line min-w-[104px]">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {secciones.map((s) => (
            <Seccion key={s.titulo} s={s} nCols={labels.length} colorear={colorear} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Seccion({ s, nCols, colorear }: {
  s: { titulo: string; arbol: NodoPct[]; totalVals: (number | null)[] };
  nCols: number; colorear?: boolean;
}) {
  return (
    <>
      <tr>
        <td colSpan={nCols + 1} className="px-5 py-2.5 bg-card2 border-y border-line font-semibold">{s.titulo}</td>
      </tr>
      {s.arbol.map((n) => <Fila key={n.codigo} n={n} colorear={colorear} />)}
      <tr className="bg-card2 font-semibold">
        <td className="sticky left-0 z-10 bg-card2 px-5 py-2.5 border-b border-line uppercase text-[13px] tracking-wide">Total {s.titulo.toLowerCase()}</td>
        {s.totalVals.map((v, i) => (
          <td key={i} className={`${CELL} border-b border-line`}>
            <span className="border-t border-fg/40 inline-block">{fmt(v)}</span>
          </td>
        ))}
      </tr>
    </>
  );
}

function Fila({ n, colorear }: { n: NodoPct; colorear?: boolean }) {
  const [open, setOpen] = useState(n.depth < 1);
  const has = n.hijos.length > 0;
  const esGrupo = n.depth === 0;
  const sangria = Math.min(n.depth, MAX_SANGRIA) * 14;
  const tono = (v: number | null) =>
    !colorear || v === null ? "" : v > 0 ? "text-pos" : v < 0 ? "text-neg" : "";
  return (
    <>
      <tr className={esGrupo ? "bg-card2/50 font-medium" : "hover:bg-card2/60"}>
        <td className={`sticky left-0 z-10 px-5 py-[7px] border-b border-line-soft ${esGrupo ? "bg-card2" : "bg-card"}`}>
          <button
            onClick={() => has && setOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-left w-full min-w-0 ${has ? "cursor-pointer" : "cursor-default"}`}
            style={{ paddingLeft: `${sangria}px` }}
            aria-expanded={has ? open : undefined}
          >
            {has ? (
              <ChevronRight size={13} className={`text-faint shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
            ) : (
              <span className="w-[13px] shrink-0" />
            )}
            <span className="text-faint/70 tnum text-[10px] w-[72px] shrink-0 tracking-tight">{n.codigo}</span>
            <span className={`truncate ${esGrupo ? "text-fg" : "text-muted"}`}>{n.nombre}</span>
          </button>
        </td>
        {n.vals.map((v, i) => (
          <td key={i} className={`${CELL} border-b border-line-soft ${esGrupo ? "font-medium" : ""} ${tono(v)}`}>{fmt(v)}</td>
        ))}
      </tr>
      {open && has && n.hijos.map((h) => <Fila key={h.codigo} n={h} colorear={colorear} />)}
    </>
  );
}
