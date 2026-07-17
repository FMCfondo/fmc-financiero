"use client";
import { ChevronRight } from "lucide-react";
import type { NodoPpto } from "@/lib/presupuesto";
import { fmtCont } from "@/lib/format";
import { useExpand, useExpandCtx, ExpandProvider, ExpandToggle, MAX_SANGRIA } from "@/components/statementShared";

/* Presupuesto anual COMPLETO, expandible — mismo lenguaje visual que los estados
   (`.stmt`: cabecera fija, columna de concepto congelada, jerarquía sobria).
   La espina del P&L y los rubros se ven por defecto; las cuentas de detalle
   (nivel 2) se ocultan y se despliegan con el chevron. */

export default function PresupuestoMatrix({
  labels, roots, persistKey,
}: {
  labels: string[]; roots: NodoPpto[]; persistKey?: string;
}) {
  const ctx = useExpand([roots], persistKey);
  return (
    <ExpandProvider ctx={ctx}>
      <div className="space-y-2">
        <ExpandToggle ctx={ctx} />
        <div className="stmt card" style={{ ["--stmt-col1" as string]: "320px" }}>
          <table>
            <thead>
              <tr>
                <th className="col1">Concepto</th>
                {labels.map((l) => <th key={l} className="num">{l}</th>)}
                <th className="num num-acc">Total año</th>
              </tr>
            </thead>
            <tbody>
              {roots.map((n) => <Fila key={n.orden} n={n} />)}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-faint">
          Presupuesto tal cual la hoja de la Junta. Los rubros con <ChevronRight size={11} className="inline -mt-0.5" /> agrupan
          cuentas de detalle: usa <b>Expandir/Contraer todo</b> o el chevron de cada rubro. Las cifras vacías van con raya (—).
        </p>
      </div>
    </ExpandProvider>
  );
}

function Fila({ n }: { n: NodoPpto }) {
  const ctx = useExpandCtx();
  const has = n.hijos.length > 0;
  const open = has && ctx.isOpen(n.codigo);
  const total = n.tipo === "total";
  // La utilidad neta (última línea de resultado) cierra con doble regla.
  const grand = total && n.formula === "util_neta";
  const depth = Math.min(n.nivel, MAX_SANGRIA);
  const rule = grand ? "border-t border-fg/45 border-b-[3px] border-double border-fg/45 py-0.5"
    : total ? "border-t border-fg/25" : "";
  const cell = (v: number, con$ = false) => (
    <span className={`inline-block ${rule}`}>{fmtCont(v, con$ && total)}</span>
  );
  const trCls = total ? (grand ? "total" : "subtotal") : `row ${n.nivel === 0 ? "group" : ""}`;
  return (
    <>
      <tr className={trCls}>
        <td className="col1">
          <button
            onClick={() => has && ctx.toggle(n.codigo)}
            className={`indent text-left w-full min-w-0 ${has ? "cursor-pointer" : "cursor-default"}`}
            aria-expanded={has ? open : undefined}
            title={n.nota ?? undefined}
          >
            {Array.from({ length: depth }).map((_, i) => <span key={i} className={`guide ${i === depth - 1 ? "line" : ""}`} />)}
            {has ? <ChevronRight size={13} className={`chev ${open ? "open" : ""}`} /> : <span className="w-[13px] shrink-0" />}
            <span className={`truncate ${total ? "font-semibold" : n.nivel === 0 ? "text-fg font-medium" : "text-muted"}`}>{n.etiqueta}</span>
            {n.nota && <span className="ml-1.5 text-[10px] text-accent2 align-super">nota</span>}
          </button>
        </td>
        {n.meses.map((v, i) => <td key={i} className="num">{cell(v)}</td>)}
        <td className="num num-acc font-medium">{cell(n.total, true)}</td>
      </tr>
      {open && n.hijos.map((h) => <Fila key={h.orden} n={h} />)}
    </>
  );
}
