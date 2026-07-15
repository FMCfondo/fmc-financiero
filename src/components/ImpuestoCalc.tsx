"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtCOP } from "@/lib/format";
import { guardarProvision } from "@/app/impuesto/actions";
import { Info, Save, CheckCircle2 } from "lucide-react";

/* Estructura del cálculo (la del analista):
   Utilidad del ejercicio
     (+) Gravamen al movimiento financiero 50%   [editable]
     (+) Otros gastos no deducibles              [editable]
     (=) Renta líquida gravable
     (=) Impuesto (tasa %)                       [tasa editable]
     (=) Impuesto por pagar (provisión)          ← va al pasivo y resta al patrimonio
     (−) Anticipos (retención en la fuente)      [editable]
     (+) Anticipo para el siguiente año          [editable]
     (=) Impuesto de renta por pagar
   Guardar persiste en Neon y recalcula TODA la app.                          */

type Props = {
  utilidad: number;
  defaults: { tasaPct: number; gmf: number; otrosND: number; anticipoRet: number; anticipoSig: number };
};

export default function ImpuestoCalc({ utilidad, defaults }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);
  const [tasaPct, setTasaPct] = useState(defaults.tasaPct);
  const [gmf, setGmf] = useState(defaults.gmf);
  const [otrosND, setOtrosND] = useState(defaults.otrosND);
  const [anticipoRet, setAnticipoRet] = useState(defaults.anticipoRet);
  const [anticipoSig, setAnticipoSig] = useState(defaults.anticipoSig);

  const rentaLiquida = utilidad + gmf + otrosND;
  const provision = Math.max(rentaLiquida, 0) * (tasaPct / 100);
  const porPagar = provision - anticipoRet + anticipoSig;
  const neto = utilidad - provision;

  const guardar = () =>
    startTransition(async () => {
      await guardarProvision({ tasaPct, gmf, otrosND, anticipoRet, anticipoSig });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
      router.refresh();
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Parámetros */}
      <div className="card p-5 space-y-4">
        <h2 className="font-medium">Parámetros</h2>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-muted">Tasa de impuesto de renta</label>
            <span className="tnum font-semibold text-accent2">{tasaPct.toFixed(1)}%</span>
          </div>
          <input type="range" min={0} max={40} step={0.5} value={tasaPct}
            onChange={(e) => setTasaPct(parseFloat(e.target.value))} className="w-full accent-[#13286E]" />
          <div className="flex gap-2 mt-2">
            {[0, 30, 35].map((t) => (
              <button key={t} onClick={() => setTasaPct(t)}
                className="px-3 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg hover:bg-card2">{t}%</button>
            ))}
          </div>
        </div>
        <Campo label="(+) Gravamen al movimiento financiero 50%" value={gmf} onChange={setGmf} />
        <Campo label="(+) Otros gastos no deducibles" value={otrosND} onChange={setOtrosND} />
        <Campo label="(−) Anticipos (retención en la fuente)" value={anticipoRet} onChange={setAnticipoRet} />
        <Campo label="(+) Anticipo para el siguiente año" value={anticipoSig} onChange={setAnticipoSig} />

        <button onClick={guardar} disabled={pending}
          className="w-full flex items-center justify-center gap-2 rounded-lg brand-grad text-white py-2.5 text-sm font-medium disabled:opacity-60">
          {guardado ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {pending ? "Guardando…" : guardado ? "Guardado — toda la app recalculada" : "Guardar y aplicar en toda la app"}
        </button>
        <div className="flex items-start gap-2 text-xs text-faint border-t border-line pt-3">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>Se guarda en la base de datos. La provisión resultante alimenta el Balance (pasivo), el Estado de Resultados, el Dashboard y los indicadores — no hay copias del porcentaje.</p>
        </div>
      </div>

      {/* Cálculo */}
      <div className="card p-5 space-y-2.5">
        <h2 className="font-medium mb-2">Para el cálculo de la provisión</h2>
        <Row label="Utilidad del ejercicio" value={utilidad} strong />
        <Sep />
        <Row label="(+) Gravamen al movimiento financiero 50%" value={gmf} />
        <Row label="(+) Otros gastos no deducibles" value={otrosND} />
        <Sep />
        <Row label="(=) Renta líquida gravable" value={rentaLiquida} strong />
        <Sep />
        <Row label={`(=) Impuesto ${tasaPct.toFixed(1)}%`} value={provision} />
        <div className="flex items-center justify-between fila-total rounded-lg px-3 py-2.5 -mx-1">
          <span className="font-semibold text-sm">(=) Impuesto por pagar (provisión)</span>
          <span className="tnum font-semibold">{fmtCOP(provision)}</span>
        </div>
        <Sep />
        <Row label="(−) Anticipos (retención en la fuente)" value={-anticipoRet} />
        <Row label="(+) Anticipo para el siguiente año" value={anticipoSig} />
        <div className="flex items-center justify-between fila-total rounded-lg px-3 py-2.5 -mx-1">
          <span className="font-semibold text-sm">(=) Impuesto de renta por pagar</span>
          <span className="tnum font-semibold">{fmtCOP(porPagar)}</span>
        </div>
        <Sep />
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-pos/5 -mx-1">
          <span className="font-semibold text-sm">Utilidad neta (después de provisión)</span>
          <span className={`tnum text-lg font-semibold ${neto >= 0 ? "text-pos" : "text-neg"}`}>{fmtCOP(neto)}</span>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-sm text-muted block mb-1">{label}</label>
      <input
        type="number" value={value || ""} placeholder="0"
        onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
        className="w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm tnum text-right outline-none focus:border-accent"
      />
    </div>
  );
}
function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm px-1">
      <span className={strong ? "font-medium" : "text-muted"}>{label}</span>
      <span className={`tnum ${value < 0 ? "text-neg" : ""} ${strong ? "font-semibold" : ""}`}>{fmtCOP(value)}</span>
    </div>
  );
}
function Sep() {
  return <div className="border-t border-line my-1" />;
}
