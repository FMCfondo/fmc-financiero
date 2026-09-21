import Link from "next/link";
import type { portafolio, Posicion, EstadoVenc } from "@/lib/inversiones";
import { fmtCompact, fmtPct, fmtCont } from "@/lib/format";
import { PctBars } from "@/components/Charts";
import { Wallet, Percent, Droplets, Timer, AlertTriangle } from "lucide-react";

/** Raya cuando falta la tasa del mes. Una cifra que no se capturó no se inventa. */
const pctO = (v: number | null) => (v === null ? "—" : fmtPct(v));

/* Resumen del Portafolio de Inversiones — compartido entre /portafolio y la
   pestaña Inversiones del módulo financiero (misma fuente, cero duplicación).
   Orden (revisión del analista): KPIs → Concentración + Tasa vs. referencia →
   resumen por tipo → tabla de posiciones. */

/* `esAdmin`: el aviso de tasas faltantes y su enlace a Mantenimiento son del analista.
   La Junta no ve aquí instrucciones de dónde se edita nada: lee cifras. */
export default function PortafolioResumen({ d, esAdmin = false }: { d: ReturnType<typeof portafolio>; esAdmin?: boolean }) {
  return (
    <div className="space-y-5">
      {esAdmin && d.tasasFaltantes.length > 0 && (
        <div className="card p-4 flex items-start gap-3 border-neg/30">
          <AlertTriangle size={16} className="text-neg mt-0.5 shrink-0" />
          <p className="text-sm">
            <b className="font-semibold">Falta la tasa de este mes</b> en {d.tasasFaltantes.join(", ")}. Las fiducias y los
            bolsillos rinden distinto cada mes, así que su tasa se captura en cada cierre:{" "}
            <Link href="/portafolio?v=mantenimiento" className="text-accent2 hover:underline">Mantenimiento › Tasas del mes</Link>.
            Mientras tanto la ponderada no se calcula y el informe imprime raya.
          </p>
        </div>
      )}

      {/* 1. KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<Wallet size={16} />} label="Total invertido" value={fmtCompact(d.total)} sub={`${d.posiciones.length} posiciones`} />
        <Kpi icon={<Percent size={16} />} label="Tasa ponderada E.A." value={pctO(d.tasaPonderada)}
          sub={d.tasaPonderada === null ? "falta la tasa del mes en alguna posición"
            : d.benchmark > 0 ? `referencia ${fmtPct(d.benchmark)}` : "referencia sin definir"} />
        <Kpi icon={<Droplets size={16} />} label="Disponible hoy (a la vista)" value={fmtPct(d.pctLiquido)}
          sub={fmtCompact(d.posiciones.filter((x) => x.diasRestantes === null).reduce((s, x) => s + x.monto, 0))} />
        {/* Cuántos días faltan, en promedio y pesando cada posición por su monto, para poder
            disponer del dinero: las fiducias y bolsillos (a la vista) cuentan como 1 día y los
            CDT lo que les falte para vencer. Se llamaba «Plazo promedio (WAM)» y el usuario
            no lo entendía (2026-09-21); la tarjeta de «Próximo vencimiento» se quitó a su
            pedido: los vencimientos ya se ven en la tabla de posiciones. */}
        <Kpi icon={<Timer size={16} />} label="Días para disponer del dinero" value={`${Math.round(d.wamDias)} días`}
          sub="promedio según el monto · a la vista cuenta como 1 día" />
      </div>

      {/* 2. Los dos gráficos protagonistas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="card p-5">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="font-medium">Concentración por entidad</h2>
            <span className="text-xs text-muted">mayor: {fmtPct(d.top1)} · top 3: {fmtPct(d.top3)}</span>
          </div>
          <PctBars grueso data={d.porEntidad.map((e) => ({ name: e.name, pct: +(e.pct * 100).toFixed(1), valor: e.value }))} />
        </div>
        <div className="card p-5">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="font-medium">Tasa por posición vs. referencia</h2>
            <span className="text-xs text-muted">referencias: CDT 180 días (BanRep) e IPC 12 meses</span>
          </div>
          <DotPlot posiciones={d.posiciones} benchmark={d.benchmark} ipc={d.ipc} />
        </div>
      </div>

      {/* 3. Resumen por tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {d.porTipo.map((t) => (
          <div key={t.tipo} className="card p-4">
            <div className="text-[13px] text-muted">{t.tipo} <span className="text-faint">× {t.n}</span></div>
            <div className="text-lg font-semibold tnum mt-1">{fmtCompact(t.monto)}</div>
            <div className="text-xs text-muted mt-1">{fmtPct(t.pct)} del portafolio · tasa pond. <b className="text-fg tnum">{pctO(t.tasa)}</b></div>
          </div>
        ))}
      </div>

      {/* 4. Tabla de posiciones */}
      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              {["Estado", "Entidad", "Tipo", "Monto", "% Port.", "Tasa E.A.", "Interés est./mes", "Apertura", "Vencimiento", "Días rest.", "Observaciones"].map((h, i) => (
                <th key={h} className={`px-3 py-2.5 border-b border-line font-normal whitespace-nowrap ${i >= 3 && i <= 9 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.posiciones.map((x) => (
              <tr key={x.id} className="hover:bg-card2/60">
                <td className="px-3 py-2.5 border-b border-line-soft"><Badge estado={x.estadoVenc} /></td>
                <td className="px-3 py-2.5 border-b border-line-soft font-medium whitespace-nowrap">{x.entidad}
                  {x.calificacion && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted border border-line rounded px-1 py-0.5">{x.calificacion}</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line-soft">{x.tipo}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum tabular-nums">{fmtCont(x.monto)}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum">{fmtPct(x.pct)}</td>
                <td className={`px-3 py-2.5 border-b border-line-soft text-right tnum font-medium ${x.tasaEa === null ? "text-neg" : ""}`}>{pctO(x.tasaEa)}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum">{x.interesMes === null ? "—" : fmtCont(x.interesMes)}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum">{x.fechaApertura ?? "—"}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum">{x.fechaVencimiento ?? "a la vista"}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum">{x.diasRestantes === null ? "—" : x.diasRestantes}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-xs text-muted max-w-[220px] truncate">{x.observaciones ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted max-w-4xl">
        Las tasas de las fiducias y los bolsillos son la E.A. de los últimos 30 días del extracto y se capturan cada mes; la de los CDT es la pactada.
        Interés estimado del mes = monto × ((1+E.A.)^(1/12) − 1). Los rendimientos de CDT tienen retención en la fuente del 4%
        (7% en cuentas y fiducias) — es anticipo de renta, no costo final. La cifra de cada posición sale del balance del mes
        seleccionado.
      </p>
    </div>
  );
}

/* ---------- Dot plot: tasa por posición vs. referencias ---------- */
function DotPlot({ posiciones, benchmark, ipc }: { posiciones: Posicion[]; benchmark: number; ipc: number }) {
  // Solo se dibujan las que tienen tasa este mes; las demás se nombran debajo.
  const conTasa = posiciones.filter((x): x is Posicion & { tasaEa: number } => x.tasaEa !== null);
  const sinTasa = posiciones.filter((x) => x.tasaEa === null);
  const max = Math.max(...conTasa.map((x) => x.tasaEa), benchmark, ipc) * 1.15 || 0.15;
  const pos = (v: number) => `${(v / max) * 100}%`;
  const orden = [...conTasa].sort((a, b) => b.tasaEa - a.tasaEa);
  return (
    <div className="space-y-1">
      {orden.map((x) => (
        <div key={x.id} className="flex items-center gap-2">
          <div className="w-[190px] shrink-0 text-[13px] text-right pr-2 truncate">{x.entidad} <span className="text-muted text-[11px]">({x.tipo})</span></div>
          <div className="flex-1 relative h-7">
            <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-line" />
            {benchmark > 0 && <div className="absolute inset-y-0 w-px bg-neg/60" style={{ left: pos(benchmark) }} />}
            {ipc > 0 && <div className="absolute inset-y-0 w-px bg-gold" style={{ left: pos(ipc) }} />}
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-royal border-2 border-white shadow" style={{ left: pos(x.tasaEa) }} />
            <span className="absolute top-1/2 -translate-y-1/2 text-[11px] font-semibold tnum" style={{ left: `calc(${pos(x.tasaEa)} + 12px)` }}>
              {fmtPct(x.tasaEa)}
            </span>
          </div>
        </div>
      ))}
      {sinTasa.length > 0 && (
        <p className="text-[11px] text-muted pt-1">Sin tasa este mes: {sinTasa.map((x) => x.entidad).join(", ")}.</p>
      )}
      <div className="flex items-center gap-4 pt-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-royal" /> tasa E.A. de la posición</span>
        {benchmark > 0 && <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-neg/60" /> referencia CDT 180d ({fmtPct(benchmark)})</span>}
        {ipc > 0 && <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-gold" /> IPC 12m ({fmtPct(ipc)})</span>}
        {benchmark === 0 && ipc === 0 && <span>sin referencias de comparación para este mes</span>}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[13px] text-muted">{icon}{label}</div>
      <div className="text-xl font-semibold tnum mt-1.5">{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
const BADGE: Record<EstadoVenc, [string, string]> = {
  vista: ["A la vista", "bg-pos/10 text-pos"],
  vigente: ["Vigente", "bg-royal/10 text-royal"],
  por_vencer: ["Por vencer", "bg-gold/20 text-[#8A6A1D]"],
  decision: ["Decisión", "bg-neg/10 text-neg"],
  vencido: ["Vencido", "bg-neg/10 text-neg"],
};
function Badge({ estado }: { estado: EstadoVenc }) {
  const [label, cls] = BADGE[estado];
  return <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-md px-2 py-1 ${cls}`}>{label}</span>;
}
