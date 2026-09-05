"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarNota } from "@/app/revision/actions";
import { fmtCont, fmtCOP } from "@/lib/format";
import { Check, Loader2, AlertTriangle } from "lucide-react";

/* Revisión del cierre: por cada movimiento fuera de lo habitual, el analista
   escribe la explicación. Esa nota es la que verá la Junta en el Cockpit. */

export type ItemRevision = {
  codigo: string; nombre: string; valor: number; media: number;
  min: number; max: number; desvio: number; esNueva: boolean;
  notaPrevia: string;
};

export default function RevisionNotas({ anio, mes, items }: { anio: number; mes: number; items: ItemRevision[] }) {
  if (!items.length) {
    return (
      <div className="card p-6 flex items-start gap-3">
        <Check size={18} className="text-pos mt-0.5 shrink-0" />
        <p className="text-sm text-muted">
          Ninguna cuenta se salió de su comportamiento habitual este mes. No hay nada que explicar.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((it) => <Fila key={it.codigo} anio={anio} mes={mes} it={it} />)}
    </div>
  );
}

function Fila({ anio, mes, it }: { anio: number; mes: number; it: ItemRevision }) {
  const [txt, setTxt] = useState(it.notaPrevia);
  const [guardado, setGuardado] = useState<null | "ok" | "err">(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const sucio = txt.trim() !== it.notaPrevia.trim();
  const cifra = it.esNueva
    ? `${fmtCont(it.valor)} · la cuenta no se había movido antes`
    : `${fmtCont(it.valor)} · su rango habitual es ${fmtCont(it.min)} – ${fmtCont(it.max)}`;

  const enviar = () =>
    start(async () => {
      const r = await guardarNota({ anio, mes, codigo: it.codigo, titulo: it.nombre, cifra, cuerpo: txt });
      setGuardado(r.ok ? "ok" : "err");
      if (r.ok) { it.notaPrevia = txt.trim(); router.refresh(); }
    });

  // Barra del rango habitual con el punto de este mes.
  const lo = Math.min(it.min, it.valor), hi = Math.max(it.max, it.valor);
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-medium text-[15px]">{it.nombre}</h3>
          <p className="text-xs text-faint mt-0.5 tnum">{it.codigo}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tnum" title={fmtCOP(it.valor)}>{fmtCont(it.valor)}</div>
          <div className={`text-[11.5px] font-medium ${it.desvio >= 0 ? "text-neg" : "text-pos"}`}>
            {it.desvio >= 0 ? "▲" : "▼"} {fmtCont(Math.abs(it.desvio))} frente a su promedio
          </div>
        </div>
      </div>

      {!it.esNueva && (
        <div className="mt-3">
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
            <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-royal/25"
              style={{ left: `${pos(it.min)}%`, width: `${pos(it.max) - pos(it.min)}%` }} />
            <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-neg border-2 border-card"
              style={{ left: `${pos(it.valor)}%` }} />
          </div>
          <p className="text-[11px] text-faint">
            La banda es el rango de los últimos meses; el punto, este mes.
          </p>
        </div>
      )}
      {it.esNueva && <p className="text-[11.5px] text-muted mt-2">Es la primera vez que esta cuenta registra movimiento.</p>}

      <div className="mt-4">
        <label className="text-xs font-medium text-fg">¿Qué explica este movimiento?</label>
        <textarea
          value={txt}
          onChange={(e) => { setTxt(e.target.value); setGuardado(null); }}
          rows={3}
          placeholder="Ej.: se causó la liquidación del año anterior, que el presupuesto no contemplaba…"
          className="w-full mt-1.5 bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-y"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={enviar} disabled={!sucio || pending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              sucio && !pending ? "border-royal/40 text-royal hover:bg-royal/5" : "border-line text-faint cursor-default"}`}
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {pending ? "Guardando…" : "Guardar nota"}
          </button>
          {guardado === "ok" && !sucio && <span className="text-xs text-pos inline-flex items-center gap-1"><Check size={13} /> Aparecerá en el Cockpit</span>}
          {guardado === "err" && <span className="text-xs text-neg inline-flex items-center gap-1"><AlertTriangle size={13} /> No se pudo guardar</span>}
          {!txt.trim() && it.notaPrevia && <span className="text-xs text-faint">Guardar con el campo vacío elimina la nota.</span>}
        </div>
      </div>
    </div>
  );
}
