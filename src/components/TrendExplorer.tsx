"use client";
import { useMemo, useState } from "react";
import { TrendChart, Leyenda, C } from "@/components/Charts";

/* Explorador de Ingresos vs Gastos — el único gráfico con su propia
   segmentación (pedido del analista): multi-selección de AÑOS y de MESES.
   Recibe la serie completa desde el servidor y filtra en el cliente. */

export type PuntoTrend = { anio: number; mesNum: number; mes: string; ingresos: number; gastos: number };
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function TrendExplorer({ data }: { data: PuntoTrend[] }) {
  const anios = useMemo(() => [...new Set(data.map((d) => d.anio))].sort(), [data]);
  // Por defecto: el año en curso y el anterior, todos los meses.
  const [selAnios, setSelAnios] = useState<number[]>(anios.slice(-2));
  const [selMeses, setSelMeses] = useState<number[]>(MESES.map((_, i) => i + 1));

  const toggle = (arr: number[], v: number, set: (x: number[]) => void, min = 1) => {
    const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v].sort((a, b) => a - b);
    if (next.length >= min) set(next);
  };

  const filtrado = useMemo(
    () => data.filter((d) => selAnios.includes(d.anio) && selMeses.includes(d.mesNum)),
    [data, selAnios, selMeses],
  );

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer select-none ${
      active ? "bg-royal text-white border-royal" : "border-line text-muted hover:text-fg hover:bg-card2"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-fg mr-1">Años:</span>
        {anios.map((a) => (
          <button key={a} onClick={() => toggle(selAnios, a, setSelAnios)} className={chip(selAnios.includes(a))}>{a}</button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-fg mr-1">Meses:</span>
        <button
          onClick={() => setSelMeses(selMeses.length === 12 ? [1] : MESES.map((_, i) => i + 1))}
          className={chip(selMeses.length === 12)}
        >
          Todos
        </button>
        {MESES.map((m, i) => (
          <button key={m} onClick={() => toggle(selMeses, i + 1, setSelMeses)} className={chip(selMeses.includes(i + 1))}>{m}</button>
        ))}
      </div>
      {filtrado.length ? (
        <TrendChart data={filtrado} />
      ) : (
        <div className="py-10 text-center text-sm text-muted">Sin meses para esa combinación.</div>
      )}
      {filtrado.length > 0 && (
        <p className="text-xs text-muted">
          {filtrado.length} meses · <Resumen data={filtrado} />
        </p>
      )}
    </div>
  );
}

function Resumen({ data }: { data: PuntoTrend[] }) {
  const ing = data.reduce((s, d) => s + d.ingresos, 0);
  const gas = data.reduce((s, d) => s + d.gastos, 0);
  const f = (n: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n));
  return (
    <span>
      ingresos <b className="text-fg tnum">{f(ing)}</b> · gastos <b className="text-fg tnum">{f(gas)}</b> · resultado{" "}
      <b className={`tnum ${ing - gas >= 0 ? "text-pos" : "text-neg"}`}>{f(ing - gas)}</b>
    </span>
  );
}

export { Leyenda, C };
