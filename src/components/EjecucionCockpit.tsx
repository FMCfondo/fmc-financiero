"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { FilaEj } from "@/lib/cockpit";

/* Ejecución presupuestal del Cockpit: Ejecutado · Plan anual · % ejecutado ·
   vs. ritmo. La comparación es contra el plan ANUAL con el tiempo transcurrido
   como referencia (la marca en la barra), no contra el reparto mensual. */

const mm = (v: number) => v.toLocaleString("es-CO", {
  minimumFractionDigits: Math.abs(v) >= 100 ? 0 : 1,
  maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1,
});

export default function EjecucionCockpit({ filas, tiempoPct }: { filas: FilaEj[]; tiempoPct: number }) {
  const [abierto, setAbierto] = useState<Record<string, boolean>>({});
  return (
    <div className="overflow-x-auto">
      <table className="ck-tbl" style={{ minWidth: 620 }}>
        <thead>
          <tr>
            <th>Concepto</th><th>Ejecutado</th><th>Plan anual</th><th>% ejec.</th><th>vs. ritmo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <FilaGrupo key={f.etiqueta} f={f} tiempoPct={tiempoPct}
              open={!!abierto[f.etiqueta]} onToggle={() => setAbierto((p) => ({ ...p, [f.etiqueta]: !p[f.etiqueta] }))} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaGrupo({ f, tiempoPct, open, onToggle }: { f: FilaEj; tiempoPct: number; open: boolean; onToggle: () => void }) {
  const has = !!f.hijos?.length;
  return (
    <>
      <Fila f={f} tiempoPct={tiempoPct} has={has} open={open} onToggle={onToggle} />
      {open && f.hijos?.map((h) => <Fila key={h.etiqueta} f={h} tiempoPct={tiempoPct} />)}
    </>
  );
}

function Fila({ f, tiempoPct, has, open, onToggle }: {
  f: FilaEj; tiempoPct: number; has?: boolean; open?: boolean; onToggle?: () => void;
}) {
  const col = f.vsRitmo === null ? "var(--color-faint)"
    : Math.abs(f.vsRitmo) < f.planAnual * 0.02 ? "var(--color-faint)"
      : f.favorable ? "var(--color-pos)" : "var(--color-neg)";
  const cls = f.tipo === "gran" ? "gr" : f.tipo === "total" ? "tt" : f.nivel === 1 ? "dt" : "";
  return (
    <tr className={cls}>
      <td>
        {has ? (
          <button onClick={onToggle} className={`ck-exp ${open ? "on" : ""}`} aria-expanded={open}>
            <ChevronRight className="cv" size={12} />{f.etiqueta}
          </button>
        ) : f.etiqueta}
      </td>
      <td>{f.real === null ? "—" : mm(f.real)}</td>
      <td className="text-faint">{f.planAnual ? mm(f.planAnual) : "—"}</td>
      <td>
        <span className="ck-pc">
          <b>{f.pct === null ? "—" : `${f.pct.toFixed(0)}%`}</b>
          <span className="ck-mb">
            <i style={{ width: `${Math.min(Math.max(f.pct ?? 0, 0), 100)}%`, background: col }} />
            <u style={{ left: `${tiempoPct}%` }} />
          </span>
        </span>
      </td>
      <td style={{ color: col }}>
        {f.vsRitmo === null ? "—" : `${f.vsRitmo >= 0 ? "↑" : "↓"} ${mm(Math.abs(f.vsRitmo))}`}
      </td>
    </tr>
  );
}
