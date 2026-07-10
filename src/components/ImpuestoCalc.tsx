"use client";
import { useState } from "react";
import { fmtCOP, fmtNum } from "@/lib/format";
import { Info } from "lucide-react";

export default function ImpuestoCalc({
  ingYTD, gasYTD, defaultTasa,
}: { ingYTD: number; gasYTD: number; defaultTasa: number }) {
  const preTax = ingYTD - gasYTD;
  const [tasaPct, setTasaPct] = useState(Math.round(defaultTasa * 1000) / 10);
  const prov = Math.max(preTax, 0) * (tasaPct / 100);
  const neto = preTax - prov;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card p-5 space-y-5">
        <h2 className="font-medium">Parámetros</h2>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-muted">Tasa de impuesto de renta</label>
            <span className="tnum font-semibold text-accent2">{tasaPct.toFixed(1)}%</span>
          </div>
          <input
            type="range" min={0} max={40} step={0.5} value={tasaPct}
            onChange={(e) => setTasaPct(parseFloat(e.target.value))}
            className="w-full accent-[#5b8cff]"
          />
          <div className="flex justify-between text-[11px] text-faint mt-1"><span>0%</span><span>40%</span></div>
        </div>
        <div className="flex gap-2">
          {[0, 30, 35].map((t) => (
            <button key={t} onClick={() => setTasaPct(t)}
              className="px-3 py-1.5 rounded-lg border border-line text-xs text-muted hover:text-fg hover:bg-card2">
              {t}%
            </button>
          ))}
        </div>
        <div className="flex items-start gap-2 text-xs text-faint border-t border-line pt-4">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>Método del Excel: se estima el impuesto sobre el resultado antes de impuestos y se lleva a provisión (pasivo) y resultado neto (patrimonio). En la versión conectada a Neon, este ajuste se guardará por período con trazabilidad.</p>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-medium mb-2">Cálculo (acumulado del año)</h2>
        <Row label="Ingresos acumulados" value={fmtCOP(ingYTD)} />
        <Row label="Gastos acumulados" value={fmtCOP(gasYTD)} />
        <div className="border-t border-line my-1" />
        <Row label="Resultado antes de impuestos" value={fmtCOP(preTax)} strong />
        <Row label={`(-) Provisión de impuesto (${tasaPct.toFixed(1)}%)`} value={fmtCOP(prov)} tone="neg" />
        <div className="border-t border-line my-1" />
        <div className="flex items-center justify-between fila-total rounded-lg px-3 py-3 -mx-1">
          <span className="font-semibold">Resultado neto</span>
          <span className={`tnum text-xl font-semibold ${neto >= 0 ? "text-pos" : "text-neg"}`}>{fmtCOP(neto)}</span>
        </div>
        <div className="text-[11px] text-faint pt-1">
          Tasa efectiva sobre resultado: {preTax > 0 ? fmtNum((prov / preTax) * 100) : "0"}%
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "neg" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-medium" : "text-muted"}>{label}</span>
      <span className={`tnum ${tone === "neg" ? "text-neg" : ""} ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
