"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { fmtNum } from "@/lib/format";

export type Nodo = {
  codigo: string; nombre: string; nivel: number; depth: number;
  valor: number; valorYtd?: number; hijos: Nodo[];
};

export default function StatementTree({
  lineas, showYtd = false, expandDepth = 1,
}: { lineas: Nodo[]; showYtd?: boolean; expandDepth?: number }) {
  return (
    <div className="text-sm">
      <div className="flex items-center px-4 py-2 text-[11px] uppercase tracking-wider text-faint border-b border-line">
        <div className="flex-1">Cuenta</div>
        {showYtd && <div className="w-40 text-right">Acumulado</div>}
        <div className="w-40 text-right">{showYtd ? "Mes" : "Saldo"}</div>
      </div>
      {lineas.map((l) => (
        <Row key={l.codigo} n={l} showYtd={showYtd} expandDepth={expandDepth} />
      ))}
    </div>
  );
}

function Row({ n, showYtd, expandDepth }: { n: Nodo; showYtd: boolean; expandDepth: number }) {
  const [open, setOpen] = useState(n.depth < expandDepth);
  const has = n.hijos.length > 0;
  const strong = n.depth === 0;

  return (
    <>
      <div
        className={`flex items-center px-4 border-b border-line-soft transition-colors ${
          strong ? "py-2 fila-total" : "py-1.5 hover:bg-card2"
        }`}
      >
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
        {showYtd && (
          <div className={`w-40 text-right tnum ${strong ? "font-semibold text-fg" : "text-fg/90"}`}>
            {fmtNum(n.valorYtd ?? 0)}
          </div>
        )}
        <div className={`w-40 text-right tnum ${n.valor < 0 ? "text-neg" : strong ? "font-semibold text-fg" : "text-fg"}`}>
          {fmtNum(n.valor)}
        </div>
      </div>
      {open && has && n.hijos.map((h) => <Row key={h.codigo} n={h} showYtd={showYtd} expandDepth={expandDepth} />)}
    </>
  );
}
