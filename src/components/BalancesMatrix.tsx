"use client";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { fmtNum } from "@/lib/format";

type Row = { codigo: string; nombre: string; longitud: number; clase: number; esHoja: boolean; vals: number[] };
type Col = { etiqueta: string; anio: number; label: string };
const CLASES: Record<number, string> = { 1: "Activo", 2: "Pasivo", 3: "Patrimonio", 4: "Ingresos", 5: "Gastos" };
const nivelIdx = (l: number) => ({ 1: 0, 2: 1, 4: 2, 6: 3, 8: 4, 10: 5 }[l] ?? 0);

export default function BalancesMatrix({ periodos, rows }: { periodos: Col[]; rows: Row[] }) {
  const anios = [...new Set(periodos.map((p) => p.anio))].sort();
  const [q, setQ] = useState("");
  const [clase, setClase] = useState(0);
  const [anio, setAnio] = useState(anios[anios.length - 1]);
  const [ocultarCero, setOcultarCero] = useState(true);

  const cols = useMemo(
    () => periodos.map((p, i) => ({ ...p, i })).filter((p) => anio === 0 || p.anio === anio),
    [periodos, anio],
  );

  const filas = useMemo(() => {
    const idxs = cols.map((c) => c.i);
    return rows.filter((r) => {
      if (clase !== 0 && r.clase !== clase) return false;
      if (q && !(r.codigo.startsWith(q.trim()) || r.nombre.toLowerCase().includes(q.toLowerCase()))) return false;
      if (ocultarCero && idxs.every((i) => (r.vals[i] ?? 0) === 0)) return false;
      return true;
    });
  }, [rows, cols, clase, q, ocultarCero]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código o nombre…"
            className="w-full bg-card2 border border-line rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-accent" />
        </div>
        <select value={anio} onChange={(e) => setAnio(parseInt(e.target.value))}
          className="bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent">
          <option value={0}>Todos los años</option>
          {anios.map((a) => <option key={a} value={a} className="bg-panel">{a}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted whitespace-nowrap cursor-pointer">
          <input type="checkbox" checked={ocultarCero} onChange={(e) => setOcultarCero(e.target.checked)} className="accent-[#45b6e8]" />
          Ocultar cuentas sin saldo
        </label>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[0, 1, 2, 3, 4, 5].map((c) => (
          <button key={c} onClick={() => setClase(c)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              clase === c ? "bg-accentdim border-accent/40 text-accent2" : "border-line text-muted hover:text-fg"
            }`}>
            {c === 0 ? "Todas" : CLASES[c]}
          </button>
        ))}
      </div>

      <div className="card overflow-auto max-h-[68vh]">
        <table className="border-collapse text-sm w-max min-w-full">
          <thead className="sticky top-0 z-20">
            <tr className="text-[11px] uppercase tracking-wide text-faint">
              <th className="sticky left-0 z-30 bg-panel text-left font-normal px-3 py-2 border-b border-line w-[92px]">Código</th>
              <th className="sticky left-[92px] z-30 bg-panel text-left font-normal px-3 py-2 border-b border-line border-r border-r-line w-[240px]">Cuenta</th>
              {cols.map((c) => (
                <th key={c.etiqueta} className="bg-panel text-right font-normal px-3 py-2 border-b border-line min-w-[96px]">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.slice(0, 700).map((r) => {
              /* Identidad visual por nivel del plan de cuentas (pedida por el analista):
                 la jerarquía se lee por color, del más fuerte al más suave.
                   Clase (1 díg.)   → banda azul rey, texto blanco, negrita
                   Grupo (2 díg.)   → banda azul suave, negrita
                   Cuenta (4 díg.)  → fondo tenue, seminegrita
                   Subcuenta y aux. → fondo blanco                                  */
              const nivel = nivelIdx(r.longitud);
              const fila =
                nivel === 0 ? "brand-grad text-white font-semibold"
                : nivel === 1 ? "bg-royal/15 font-semibold"
                : nivel === 2 ? "bg-royal/5 font-medium"
                : "";
              const sticky =
                nivel === 0 ? "bg-[#13286E] text-white group-hover:bg-[#13286E]"
                : nivel === 1 ? "bg-[#e2e8f7] group-hover:bg-[#d6ddf2]"
                : nivel === 2 ? "bg-[#f1f4fb] group-hover:bg-card2"
                : "bg-card group-hover:bg-card2";
              return (
                <tr key={r.codigo} className={`group ${fila}`}>
                  <td className={`sticky left-0 z-10 tnum text-[11px] px-3 py-1.5 border-b border-line-soft ${sticky} ${nivel === 0 ? "text-white/80" : "text-faint"}`}>{r.codigo}</td>
                  <td className={`sticky left-[92px] z-10 px-3 py-1.5 border-b border-line-soft border-r border-r-line truncate max-w-[240px] ${sticky}`}>
                    <span style={{ paddingLeft: nivelIdx(r.longitud) * 12 }} className={nivel <= 1 ? "" : nivel === 2 ? "text-fg" : "text-muted"}>{r.nombre}</span>
                  </td>
                  {cols.map((c) => {
                    const v = r.vals[c.i] ?? 0;
                    return (
                      <td key={c.etiqueta} className={`text-right tnum tabular-nums px-3 py-1.5 border-b border-line-soft ${
                        nivel === 0 ? "text-white" : v === 0 ? "text-faint/40" : v < 0 ? "text-neg" : "text-fg"
                      }`}>
                        {v === 0 ? "·" : fmtNum(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-faint">
        {filas.length} cuentas · {cols.length} meses. Las celdas en <span className="text-faint/40">·</span> son cero — útil para detectar cuentas sin movimiento en un mes.
      </p>
    </div>
  );
}
