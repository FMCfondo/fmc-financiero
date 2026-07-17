"use client";
import { ChevronRight } from "lucide-react";
import type { NodoEjec } from "@/lib/presupuesto";
import { fmtCont, fmtCOP } from "@/lib/format";
import { useExpand, useExpandCtx, ExpandProvider, ExpandToggle, MAX_SANGRIA } from "@/components/statementShared";

/* Ejecución presupuestal JERÁRQUICA: el árbol del presupuesto con las columnas de
   comparación (Presupuesto · Real · Variación $ · Variación % · Cumplimiento).
   Mismo sistema visual `.stmt`; color solo cuando hay desviación que mirar
   (verde dentro/mejor, gris desvío leve, rojo desvío material). Las subcuentas
   sin homólogo contable propio muestran solo el presupuesto (—). */

const COLOR: Record<string, string> = {
  bueno: "var(--color-pos)", malo: "var(--color-neg)", neutro: "var(--color-faint)",
};

export default function EjecucionMatrix({ roots, persistKey }: { roots: NodoEjec[]; persistKey?: string }) {
  const ctx = useExpand([roots], persistKey);
  return (
    <ExpandProvider ctx={ctx}>
      <div className="space-y-2">
        <div className="flex items-center gap-4 flex-wrap">
          <ExpandToggle ctx={ctx} />
          <span className="flex items-center gap-x-4 gap-y-1 text-[11px] text-muted flex-wrap">
            <span className="flex items-center gap-1.5"><Dot c="bueno" /> dentro o mejor que el plan</span>
            <span className="flex items-center gap-1.5"><Dot c="neutro" /> desvío leve (≤5%)</span>
            <span className="flex items-center gap-1.5"><Dot c="malo" /> desvío material</span>
          </span>
        </div>
        <div className="stmt card" style={{ ["--stmt-col1" as string]: "300px" }}>
          <table>
            <thead>
              <tr>
                <th className="col1">Concepto</th>
                <th className="num">Presupuesto</th>
                <th className="num">Real</th>
                <th className="num">Variación $</th>
                <th className="num">Var. %</th>
                <th className="num" style={{ minWidth: 168 }}>Cumplimiento</th>
              </tr>
            </thead>
            <tbody>{roots.map((n) => <Fila key={n.orden} n={n} />)}</tbody>
          </table>
        </div>
      </div>
    </ExpandProvider>
  );
}

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: COLOR[c] }} />;
}

function Fila({ n }: { n: NodoEjec }) {
  const ctx = useExpandCtx();
  const has = n.hijos.length > 0;
  const open = has && ctx.isOpen(n.codigo);
  const total = n.tipo === "total";
  const grand = total && n.formula === "util_neta";
  const trCls = total ? (grand ? "total" : "subtotal") : `row ${n.nivel === 0 ? "group" : ""}`;
  const depth = Math.min(n.nivel, MAX_SANGRIA);
  const rule = grand ? "border-t border-fg/45 border-b-[3px] border-double border-fg/45 py-0.5" : total ? "border-t border-fg/25" : "";
  const col = n.semaforo ? COLOR[n.semaforo] : undefined;
  const na = n.real === null;
  const varPct = n.pctEjec === null ? null : n.pctEjec - 100;
  const money = (v: number) => <span className={`inline-block ${rule}`}>{fmtCont(v, total)}</span>;
  return (
    <>
      <tr className={trCls}>
        <td className="col1">
          <button
            onClick={() => has && ctx.toggle(n.codigo)}
            className={`indent text-left w-full min-w-0 ${has ? "cursor-pointer" : "cursor-default"}`}
            aria-expanded={has ? open : undefined} title={n.nota ?? undefined}
          >
            {Array.from({ length: depth }).map((_, i) => <span key={i} className={`guide ${i === depth - 1 ? "line" : ""}`} />)}
            {has ? <ChevronRight size={13} className={`chev ${open ? "open" : ""}`} /> : <span className="w-[13px] shrink-0" />}
            <span className={`truncate ${total ? "font-semibold" : n.nivel === 0 ? "text-fg font-medium" : "text-muted"}`}>{n.etiqueta}</span>
            {n.nota && <span className="ml-1.5 text-[9px] uppercase tracking-wide text-accent2 border border-line rounded px-1 align-middle" title={n.nota}>nota</span>}
          </button>
        </td>
        <td className="num">{money(n.ppto)}</td>
        <td className="num font-medium">{na ? <span className="text-faint">—</span> : money(n.real as number)}</td>
        <td className="num" style={{ color: col }}>{n.variacion === null ? <span className="text-faint">—</span> : <span className={`inline-block ${rule}`}>{n.variacion >= 0 ? "+" : "−"}{fmtCont(Math.abs(n.variacion))}</span>}</td>
        <td className="num" style={{ color: col }}>{varPct === null ? <span className="text-faint">—</span> : `${varPct >= 0 ? "+" : "−"}${Math.abs(varPct).toFixed(0)}%`}</td>
        <td className="num">
          {n.pctEjec === null ? <span className="text-faint">—</span> : (
            <span className="inline-flex items-center gap-2 justify-end w-full">
              <span className="tnum font-semibold w-11 text-right" style={{ color: col }}>{n.pctEjec.toFixed(0)}%</span>
              <span className="ejec-bar w-20"><span style={{ width: `${Math.min(n.pctEjec, 140) / 1.4}%`, background: col }} /><i className="not-italic absolute top-[-2px] bottom-[-2px] w-px bg-fg/40" style={{ left: `${100 / 1.4}%` }} /></span>
            </span>
          )}
        </td>
      </tr>
      {open && n.hijos.map((h) => <Fila key={h.orden} n={h} />)}
    </>
  );
}
