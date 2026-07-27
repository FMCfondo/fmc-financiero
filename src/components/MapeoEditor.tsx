"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarMapeoPpto } from "@/app/estados/(fin)/resultados/actions";
import type { LineaMapeo } from "@/lib/presupuesto";
import { fmtCont } from "@/lib/format";
import { Save, CheckCircle2, AlertTriangle } from "lucide-react";

/* Editor del mapeo presupuestal: por cada línea de detalle, a qué cuentas PUC
   apunta para calcular su "Real". Vacío = muestra solo el presupuesto (—). */
export default function MapeoEditor({ anio, lineas }: { anio: number; lineas: LineaMapeo[] }) {
  return (
    <div className="space-y-3">
      <div className="card p-4 flex items-start gap-3 border-accent/20">
        <div className="text-xs text-muted">
          Aquí defines a qué cuenta(s) del PUC corresponde cada rubro del presupuesto — es lo que llena la columna <b>Real</b> de la
          ejecución. Escribe uno o varios códigos separados por coma (p. ej. <code className="text-accent2">511010</code>). Déjalo
          vacío para que la línea muestre solo el presupuesto y su real quede a nivel del grupo. Los subtotales de la estructura
          (EBITDA, utilidad…) no se editan: su real es una fórmula del Estado de Resultados.
        </div>
      </div>
      <div className="stmt card" style={{ ["--stmt-col1" as string]: "300px" }}>
        <table>
          <thead>
            <tr>
              <th className="col1">Rubro del presupuesto</th>
              <th className="num" style={{ minWidth: 220, textAlign: "left" }}>Cuentas PUC</th>
              <th className="num" style={{ minWidth: 240, textAlign: "left" }}>Cuentas mapeadas</th>
              <th className="num">Real actual</th>
              <th className="num" style={{ minWidth: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => <FilaMapeo key={l.orden} anio={anio} l={l} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaMapeo({ anio, l }: { anio: number; l: LineaMapeo }) {
  const [val, setVal] = useState(l.cuentas.join(", "));
  const [estado, setEstado] = useState<{ tipo: "ok" | "err"; msg?: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const sucio = val.trim() !== l.cuentas.join(", ").trim();
  const guardar = () =>
    start(async () => {
      const r = await guardarMapeoPpto({ anio, orden: l.orden, cuentas: val });
      if (r.ok) { setEstado({ tipo: "ok" }); router.refresh(); }
      else setEstado({ tipo: "err", msg: r.error });
    });
  const sangria = Math.min(l.nivel, 4) * 16;
  return (
    <tr className="row">
      <td className="col1">
        <span className="block truncate" style={{ paddingLeft: sangria }} title={l.etiqueta}>
          <span className={l.nivel === 0 ? "text-fg font-medium" : l.nivel === 1 ? "text-fg" : "text-muted"}>{l.etiqueta}</span>
        </span>
      </td>
      <td className="px-3 py-1.5 border-b border-line-soft">
        <input
          value={val} onChange={(e) => { setVal(e.target.value); setEstado(null); }}
          placeholder="—"
          className="w-full bg-card2 border border-line rounded-md px-2 py-1 text-[13px] tnum outline-none focus:border-accent"
        />
      </td>
      <td className="px-3 py-1.5 border-b border-line-soft text-[12px] text-muted">
        {l.nombres.length ? l.nombres.join(" · ") : <span className="text-faint">sin mapear (real a nivel de grupo)</span>}
      </td>
      <td className="num text-fg/90">{l.real === null ? <span className="text-faint">—</span> : fmtCont(l.real)}</td>
      <td className="num">
        <span className="inline-flex items-center gap-2 justify-end">
          {estado?.tipo === "ok" && !sucio && <CheckCircle2 size={15} className="text-pos" />}
          {estado?.tipo === "err" && <span title={estado.msg}><AlertTriangle size={15} className="text-neg" /></span>}
          <button
            onClick={guardar} disabled={!sucio || pending}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              sucio && !pending ? "border-royal/40 text-royal hover:bg-royal/5" : "border-line text-faint cursor-default"
            }`}
          >
            <Save size={13} /> {pending ? "…" : "Guardar"}
          </button>
        </span>
      </td>
    </tr>
  );
}
