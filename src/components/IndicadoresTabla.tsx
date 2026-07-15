"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { fmtCont, fmtPctCont } from "@/lib/format";

/* Tabla de indicadores: indicador en fila, períodos en columnas, semáforo por
   celda (solo donde el umbral es defendible) y tarjeta emergente al pasar el
   mouse — FLOTANTE (position: fixed): el contenedor con scroll ya no la corta,
   y va en beige pastel para diferenciarla del resto de la interfaz. */

export type Nivel = "bien" | "regular" | "mal";
export type FilaInd = {
  id: string; nombre: string; formato: string; formula: string; explica: string; rango: string;
  nota?: string; vals: number[]; acum: number; niveles: Nivel[] | null; nivelAcum: Nivel | null;
};
export type CatInd = { id: string; nombre: string; desc: string; filas: FilaInd[] };

const NIVEL_BG: Record<Nivel, string> = {
  bien: "bg-pos/10 text-pos",
  regular: "bg-gold/15 text-[#8A6A1D]",
  mal: "bg-neg/10 text-neg",
};

function fmtVal(v: number, formato: string) {
  return formato === "pct" ? fmtPctCont(v) : formato === "veces" ? (v ? v.toFixed(2) + "x" : "—") : fmtCont(v);
}

type Pop = { fila: FilaInd; x: number; y: number } | null;

export default function IndicadoresTabla({
  labels, cats, conAcum = true, tituloAcum = "Acumulado",
}: { labels: string[]; cats: CatInd[]; conAcum?: boolean; tituloAcum?: string }) {
  const [pop, setPop] = useState<Pop>(null);

  const abrir = (fila: FilaInd) => (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPop({ fila, x: Math.min(r.left + 12, window.innerWidth - 420), y: Math.min(r.bottom + 6, window.innerHeight - 260) });
  };

  return (
    <div className="relative">
      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              <th className="sticky left-0 z-20 bg-card text-left font-normal px-5 py-2.5 border-b border-line min-w-[300px]">Indicador</th>
              {labels.map((l) => (
                <th key={l} className="text-right font-normal px-3 py-2.5 border-b border-line min-w-[104px]">{l}</th>
              ))}
              {conAcum && <th className="text-right font-semibold px-4 py-2.5 border-b border-line min-w-[128px] bg-card2 border-l-2 border-l-line">{tituloAcum}</th>}
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => (
              <Cat key={cat.id} cat={cat} nCols={labels.length} conAcum={conAcum} abrir={abrir} cerrar={() => setPop(null)} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjeta emergente flotante: se dibuja fuera del contenedor con scroll,
          en beige pastel, siempre por encima de todo. */}
      {pop && (
        <div
          className="fixed z-[100] w-[400px] rounded-xl shadow-2xl p-4 pointer-events-none"
          style={{ left: pop.x, top: pop.y, background: "#FBF6EA", border: "1.5px solid #E3D5AF" }}
        >
          <div className="text-sm font-semibold text-[#3B3325] mb-1.5">{pop.fila.nombre}</div>
          <p className="text-xs leading-relaxed text-[#5C523D] mb-2">{pop.fila.explica}</p>
          <p className="text-[11px] text-[#7A6E52] mb-2"><b>Fórmula:</b> {pop.fila.formula}</p>
          <p className="text-[11px] leading-relaxed rounded-lg p-2" style={{ background: "#F3EAD3", color: "#4A4030" }}>
            <b>Cómo leerlo:</b> {pop.fila.rango}
          </p>
          {pop.fila.nota && (
            <p className="mt-2 text-[11px] leading-relaxed text-[#8A6A1D] border-l-2 pl-2" style={{ borderColor: "#C99A2E" }}>
              {pop.fila.nota}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Cat({ cat, nCols, conAcum, abrir, cerrar }: {
  cat: CatInd; nCols: number; conAcum: boolean;
  abrir: (f: FilaInd) => (e: React.MouseEvent<HTMLElement>) => void;
  cerrar: () => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={nCols + (conAcum ? 2 : 1)} className="px-5 py-2.5 bg-card2 border-y border-line">
          <span className="font-semibold">{cat.nombre}</span>
          <span className="text-xs text-muted ml-3">{cat.desc}</span>
        </td>
      </tr>
      {cat.filas.map((f) => (
        <tr key={f.id} className="hover:bg-card2/60">
          <td
            className="sticky left-0 z-10 bg-card px-5 py-2 border-b border-line-soft cursor-help"
            onMouseEnter={abrir(f)}
            onMouseLeave={cerrar}
          >
            <span className="flex items-center gap-1.5 pl-3">
              <span className="text-fg font-medium text-[13px]">{f.nombre}</span>
              {f.nota && <AlertTriangle size={12} className="text-gold shrink-0" />}
            </span>
          </td>
          {f.vals.map((v, i) => (
            <td key={i} className="text-right px-1.5 py-1 border-b border-line-soft whitespace-nowrap">
              <span className={`inline-block w-full rounded-md px-1.5 py-1 tnum tabular-nums ${f.niveles ? NIVEL_BG[f.niveles[i]] : "text-fg"}`}>
                {fmtVal(v, f.formato)}
              </span>
            </td>
          ))}
          {conAcum && (
            <td className="text-right px-2.5 py-1 border-b border-line-soft whitespace-nowrap bg-card2 border-l-2 border-l-line">
              <span className={`inline-block w-full rounded-md px-1.5 py-1 tnum tabular-nums font-semibold ${f.nivelAcum ? NIVEL_BG[f.nivelAcum] : "text-fg"}`}>
                {fmtVal(f.acum, f.formato)}
              </span>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}
