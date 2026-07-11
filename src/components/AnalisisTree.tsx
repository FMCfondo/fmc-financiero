"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { fmtNum } from "@/lib/format";

export type NodoA = {
  codigo: string; nombre: string; nivel: number; depth: number; valor: number;
  pct: number; valorPrev: number | null; varAbs: number | null; varPct: number | null;
  hijos: NodoA[];
};

export default function AnalisisTree({
  lineas, modo, expandDepth = 1,
}: { lineas: NodoA[]; modo: "vertical" | "horizontal"; expandDepth?: number }) {
  return (
    <div className="text-sm">
      <div className="flex items-center px-4 py-2 text-[11px] uppercase tracking-wider text-faint border-b border-line">
        <div className="flex-1">Cuenta</div>
        {modo === "vertical" ? (
          <>
            <div className="w-40 text-right">Valor</div>
            <div className="w-24 text-right">% base</div>
          </>
        ) : (
          <>
            <div className="w-36 text-right">Actual</div>
            <div className="w-36 text-right">Año anterior</div>
            <div className="w-28 text-right">Var.</div>
          </>
        )}
      </div>
      {lineas.map((l) => <Row key={l.codigo} n={l} modo={modo} expandDepth={expandDepth} />)}
    </div>
  );
}

function Row({ n, modo, expandDepth }: { n: NodoA; modo: "vertical" | "horizontal"; expandDepth: number }) {
  const [open, setOpen] = useState(n.depth < expandDepth);
  const has = n.hijos.length > 0;
  const strong = n.depth === 0;

  return (
    <>
      <div className={`flex items-center px-4 border-b border-line-soft ${strong ? "py-2 fila-total" : "py-1.5 hover:bg-card2"}`}>
        <button
          onClick={() => has && setOpen((v) => !v)}
          className={`flex-1 flex items-center gap-2 text-left min-w-0 ${has ? "cursor-pointer" : "cursor-default"}`}
          style={{ paddingLeft: `${n.depth * 18}px` }}
        >
          {has ? (
            <ChevronRight size={14} className={`text-faint transition-transform ${open ? "rotate-90" : ""}`} />
          ) : (
            <span className="w-[14px] shrink-0" />
          )}
          <span className="text-faint tnum text-[11px] w-[84px] shrink-0">{n.codigo}</span>
          <span className={`truncate ${strong ? "font-semibold text-fg" : "text-muted"}`}>{n.nombre}</span>
        </button>
        {modo === "vertical" ? (
          <>
            <div className={`w-40 text-right tnum ${n.valor < 0 ? "text-neg" : strong ? "font-semibold text-fg" : "text-fg"}`}>{fmtNum(n.valor)}</div>
            <div className="w-24 text-right tnum text-muted">{(n.pct * 100).toFixed(1)}%</div>
          </>
        ) : (
          <>
            <div className={`w-36 text-right tnum ${strong ? "font-semibold text-fg" : "text-fg"}`}>{fmtNum(n.valor)}</div>
            <div className="w-36 text-right tnum text-muted">{n.valorPrev === null ? "—" : fmtNum(n.valorPrev)}</div>
            <div className="w-28 text-right"><VarBadge pct={n.varPct} /></div>
          </>
        )}
      </div>
      {open && has && n.hijos.map((h) => <Row key={h.codigo} n={h} modo={modo} expandDepth={expandDepth} />)}
    </>
  );
}

function VarBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-faint">—</span>;
  if (Math.abs(pct) < 0.1) return <span className="text-xs text-faint">= 0%</span>;
  const up = pct >= 0;
  return <span className={`text-xs tnum font-medium ${up ? "text-pos" : "text-neg"}`}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>;
}
