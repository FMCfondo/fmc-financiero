"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarInversion, guardarReferencias } from "@/app/portafolio/actions";
import { Save, CheckCircle2, AlertTriangle, Plus, Pencil } from "lucide-react";

/* Mantenimiento del portafolio: edita lo MANUAL de cada posición (tasa E.A.,
   fechas, calificación, observaciones y el mapeo a auxiliares del PUC).
   El monto no se toca: sale del balance del mes seleccionado. */

export type InvEdit = {
  id: string; tipo: string; entidad: string; cuentas: string[];
  tasaEa: number; fechaApertura: string | null; fechaVencimiento: string | null;
  calificacion: string | null; renovar: string | null; observaciones: string | null;
  activa: boolean;
};

const VACIA: InvEdit = {
  id: "", tipo: "CDT", entidad: "", cuentas: [], tasaEa: 0,
  fechaApertura: null, fechaVencimiento: null, calificacion: null, renovar: null, observaciones: null, activa: true,
};

export default function InversionesMantenimiento({ inversiones, benchPct, ipcPct }: {
  inversiones: InvEdit[]; benchPct: number; ipcPct: number;
}) {
  const [sel, setSel] = useState<InvEdit | null>(null);
  return (
    <div className="space-y-4">
      <Referencias benchPct={benchPct} ipcPct={ipcPct} />

      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              {["", "ID", "Tipo", "Entidad", "Tasa E.A.", "Apertura", "Vencimiento", "Cuentas PUC", "Activa"].map((h, i) => (
                <th key={i} className={`px-3 py-2.5 border-b border-line font-normal ${i >= 4 && i <= 6 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inversiones.map((inv) => (
              <tr key={inv.id} className={`hover:bg-card2/60 ${!inv.activa ? "opacity-45" : ""}`}>
                <td className="px-3 py-2 border-b border-line-soft">
                  <button onClick={() => setSel(inv)} className="text-accent2 hover:text-fg" title="Editar"><Pencil size={14} /></button>
                </td>
                <td className="px-3 py-2 border-b border-line-soft tnum text-xs">{inv.id}</td>
                <td className="px-3 py-2 border-b border-line-soft">{inv.tipo}</td>
                <td className="px-3 py-2 border-b border-line-soft font-medium">{inv.entidad}</td>
                <td className="px-3 py-2 border-b border-line-soft text-right tnum">{(inv.tasaEa * 100).toFixed(2)}%</td>
                <td className="px-3 py-2 border-b border-line-soft text-right tnum">{inv.fechaApertura ?? "—"}</td>
                <td className="px-3 py-2 border-b border-line-soft text-right tnum">{inv.fechaVencimiento ?? "a la vista"}</td>
                <td className="px-3 py-2 border-b border-line-soft tnum text-xs text-muted">{inv.cuentas.join(", ")}</td>
                <td className="px-3 py-2 border-b border-line-soft">{inv.activa ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={() => setSel({ ...VACIA })}
        className="flex items-center gap-2 px-4 py-2 rounded-lg brand-grad text-white text-sm font-medium">
        <Plus size={15} /> Nueva inversión
      </button>

      {sel && <Editor inv={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function Editor({ inv, onClose }: { inv: InvEdit; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    id: inv.id, tipo: inv.tipo, entidad: inv.entidad,
    cuentas: inv.cuentas.join(", "),
    tasaEaPct: +(inv.tasaEa * 100).toFixed(3),
    fechaApertura: inv.fechaApertura ?? "", fechaVencimiento: inv.fechaVencimiento ?? "",
    calificacion: inv.calificacion ?? "", renovar: inv.renovar ?? "", observaciones: inv.observaciones ?? "",
    activa: inv.activa,
  });
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  const guardar = () =>
    start(async () => {
      const r = await guardarInversion(f);
      if (!r.ok) { setError(r.error ?? "Error"); return; }
      router.refresh();
      onClose();
    });

  return (
    <div className="fixed inset-0 z-[90] bg-black/30 grid place-items-center p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-2xl space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold">{inv.id ? `Editar ${inv.id}` : "Nueva inversión"}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Campo label="ID (INV-001)" v={f.id} on={(v) => set("id", v)} disabled={!!inv.id} />
          <div>
            <label className="text-xs text-muted block mb-1">Tipo</label>
            <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}
              className="w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent">
              {["CDT", "Fiducia", "Bolsillo"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <Campo label="Entidad" v={f.entidad} on={(v) => set("entidad", v)} />
          <Campo label="Tasa E.A. (%)" v={String(f.tasaEaPct)} on={(v) => set("tasaEaPct", parseFloat(v) || 0)} num />
          <Campo label="Fecha apertura" v={f.fechaApertura} on={(v) => set("fechaApertura", v)} date />
          <Campo label="Vencimiento (vacío = a la vista)" v={f.fechaVencimiento} on={(v) => set("fechaVencimiento", v)} date />
          <Campo label="Calificación (BRC/Fitch)" v={f.calificacion} on={(v) => set("calificacion", v)} />
          <Campo label="¿Renovar?" v={f.renovar} on={(v) => set("renovar", v)} />
          <label className="flex items-end gap-2 text-sm text-muted pb-2 cursor-pointer">
            <input type="checkbox" checked={f.activa} onChange={(e) => set("activa", e.target.checked)} className="accent-[#13286E]" />
            Activa
          </label>
        </div>
        <Campo label="Cuentas PUC (auxiliares, separadas por coma — capital e intereses)" v={f.cuentas} on={(v) => set("cuentas", v)} />
        <Campo label="Observaciones" v={f.observaciones} on={(v) => set("observaciones", v)} />
        {error && (
          <p className="flex items-center gap-2 text-sm text-neg"><AlertTriangle size={14} /> {error}</p>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line text-sm text-muted hover:text-fg">Cancelar</button>
          <button onClick={guardar} disabled={pending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg brand-grad text-white text-sm font-medium disabled:opacity-60">
            <Save size={15} /> {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Referencias({ benchPct, ipcPct }: { benchPct: number; ipcPct: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ok, setOk] = useState(false);
  const [bench, setBench] = useState(benchPct);
  const [ipc, setIpc] = useState(ipcPct);
  return (
    <div className="card p-4 flex items-end gap-4 flex-wrap">
      <Campo label="Referencia CDT 180 días — BanRep (%)" v={String(bench)} on={(v) => setBench(parseFloat(v) || 0)} num w="w-56" />
      <Campo label="Inflación 12 meses — IPC (%)" v={String(ipc)} on={(v) => setIpc(parseFloat(v) || 0)} num w="w-56" />
      <button
        onClick={() => start(async () => { await guardarReferencias({ benchPct: bench, ipcPct: ipc }); setOk(true); setTimeout(() => setOk(false), 2000); router.refresh(); })}
        disabled={pending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg brand-grad text-white text-sm font-medium disabled:opacity-60">
        {ok ? <CheckCircle2 size={15} /> : <Save size={15} />} {pending ? "Guardando…" : ok ? "Guardado" : "Guardar referencias"}
      </button>
      <p className="text-[11px] text-muted basis-full">
        Se actualizan a mano (serie de captación CDT 180 días del Banco de la República e IPC del DANE). Contra estas
        referencias se compara la tasa de cada posición.
      </p>
    </div>
  );
}

function Campo({ label, v, on, num, date, disabled, w }: {
  label: string; v: string; on: (v: string) => void; num?: boolean; date?: boolean; disabled?: boolean; w?: string;
}) {
  return (
    <div className={w}>
      <label className="text-xs text-muted block mb-1">{label}</label>
      <input
        type={date ? "date" : num ? "number" : "text"} value={v} disabled={disabled}
        onChange={(e) => on(e.target.value)}
        className={`w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent ${num ? "tnum text-right" : ""} ${disabled ? "opacity-50" : ""}`}
      />
    </div>
  );
}
