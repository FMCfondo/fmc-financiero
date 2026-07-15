import Link from "next/link";
import { portafolio, type Posicion, type EstadoVenc } from "@/lib/inversiones";
import { ensureLoaded, inversiones, paramNum } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCompact, fmtPct, fmtCont } from "@/lib/format";
import { PctBars } from "@/components/Charts";
import InversionesMantenimiento from "@/components/InversionesMantenimiento";
import { Wallet, Percent, Droplets, CalendarClock, Timer, AlertTriangle, CheckCircle2, Settings2, LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

/* Portafolio de Inversiones — diseño según la investigación de tesorería:
   KPIs → cola de acciones → escalera de vencimientos → concentración y tasas
   vs. referencia → tabla de posiciones. El monto de cada posición sale del
   balance del mes; lo manual (tasas, fechas) se edita en Mantenimiento. */

export default async function PortafolioPage({ searchParams }: { searchParams: Promise<{ p?: string; v?: string }> }) {
  const { p, v } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const d = portafolio(etq);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Portafolio de Inversiones</h1>
          <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · montos desde el balance · vencimientos contra hoy</p>
        </div>
        <div className="flex gap-1.5">
          <Tab href={`/portafolio${p ? `?p=${p}` : ""}`} active={v !== "mantenimiento"} icon={<LayoutDashboard size={14} />}>Portafolio</Tab>
          <Tab href={`/portafolio?${p ? `p=${p}&` : ""}v=mantenimiento`} active={v === "mantenimiento"} icon={<Settings2 size={14} />}>Mantenimiento</Tab>
        </div>
      </div>

      {!d.hayDatos ? (
        <div className="card p-6 text-sm text-muted">No hay inversiones registradas. Ejecuta <code>node scripts/migrate-inversiones.mjs</code> o créalas en Mantenimiento.</div>
      ) : v === "mantenimiento" ? (
        <InversionesMantenimiento
          inversiones={inversiones}
          benchPct={+(paramNum("bench_cdt180", 0) * 100).toFixed(2)}
          ipcPct={+(paramNum("ipc_12m", 0) * 100).toFixed(2)}
        />
      ) : (
        <Resumen d={d} />
      )}
    </div>
  );
}

function Resumen({ d }: { d: ReturnType<typeof portafolio> }) {
  return (
    <div className="space-y-5">
      {/* 1. KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={<Wallet size={16} />} label="Total invertido" value={fmtCompact(d.total)} sub={`${d.posiciones.length} posiciones`} />
        <Kpi icon={<Percent size={16} />} label="Tasa ponderada E.A." value={fmtPct(d.tasaPonderada)}
          sub={d.benchmark > 0 ? `referencia ${fmtPct(d.benchmark)}` : "referencia sin definir"} />
        <Kpi icon={<Droplets size={16} />} label="Disponible hoy (a la vista)" value={fmtPct(d.pctLiquido)}
          sub={fmtCompact(d.posiciones.filter((x) => x.diasRestantes === null).reduce((s, x) => s + x.monto, 0))} />
        <Kpi icon={<Timer size={16} />} label="Plazo promedio (WAM)" value={`${Math.round(d.wamDias)} días`} sub="a la vista = 1 día" />
        <Kpi icon={<CalendarClock size={16} />} label="Próximo vencimiento" value={d.proxVenc ? `${d.proxVenc.diasRestantes} días` : "—"}
          sub={d.proxVenc ? `${d.proxVenc.entidad} · ${d.proxVenc.fechaVencimiento}` : "sin CDTs vigentes"} />
      </div>

      {/* 2. Cola de acciones */}
      {d.alertas.length > 0 ? (
        <div className="card p-5 border-gold/40 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><AlertTriangle size={16} className="text-gold" /> Requieren decisión</h2>
          {d.alertas.map((a) => (
            <div key={a.id} className={`flex items-center gap-3 flex-wrap rounded-xl px-4 py-3 ${a.estadoVenc === "vencido" ? "bg-neg/10" : a.estadoVenc === "decision" ? "bg-neg/5" : "bg-gold/10"}`}>
              <Badge estado={a.estadoVenc} />
              <span className="font-medium">{a.entidad}</span>
              <span className="text-sm text-muted">{a.tipo} · {fmtCOP(a.monto)} al {fmtPct(a.tasaEa)} E.A.</span>
              <span className="text-sm tnum">
                {a.estadoVenc === "vencido"
                  ? `venció el ${a.fechaVencimiento} (hace ${Math.abs(a.diasRestantes ?? 0)} días)`
                  : `vence el ${a.fechaVencimiento} (en ${a.diasRestantes} días)`}
              </span>
              {d.benchmark > 0 && (
                <span className={`text-sm ${a.tasaEa >= d.benchmark ? "text-pos" : "text-neg"}`}>
                  {a.tasaEa >= d.benchmark ? "por encima" : "POR DEBAJO"} de la referencia ({fmtPct(d.benchmark)})
                </span>
              )}
              <span className="text-xs text-muted ml-auto">Renovar · Trasladar (ojo GMF) · Liquidar a fiducia</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card px-5 py-3 flex items-center gap-2 text-sm text-pos"><CheckCircle2 size={15} /> Sin acciones pendientes: ningún CDT vence en los próximos 30 días.</div>
      )}

      {/* 3. Escalera de vencimientos */}
      <div className="card p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-medium">Escalera de vencimientos</h2>
          <span className="text-xs text-muted">próximos 12 meses, desde hoy</span>
        </div>
        <Escalera posiciones={d.posiciones} />
      </div>

      {/* 4. Concentración + tasas vs referencia */}
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
            <span className="text-xs text-muted">CDT 180d BanRep e IPC (editable en Mantenimiento)</span>
          </div>
          <DotPlot posiciones={d.posiciones} benchmark={d.benchmark} ipc={d.ipc} />
        </div>
      </div>

      {/* 5. Resumen por tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {d.porTipo.map((t) => (
          <div key={t.tipo} className="card p-4">
            <div className="text-[13px] text-muted">{t.tipo} <span className="text-faint">× {t.n}</span></div>
            <div className="text-lg font-semibold tnum mt-1">{fmtCompact(t.monto)}</div>
            <div className="text-xs text-muted mt-1">{fmtPct(t.pct)} del portafolio · tasa pond. <b className="text-fg tnum">{fmtPct(t.tasa)}</b></div>
          </div>
        ))}
      </div>

      {/* 6. Tabla de posiciones */}
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
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum font-medium">{fmtPct(x.tasaEa)}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum">{fmtCont(x.interesMes)}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum">{x.fechaApertura ?? "—"}</td>
                <td className="px-3 py-2.5 border-b border-line-soft text-right tnum">{x.fechaVencimiento ?? "a la vista"}</td>
                <td className={`px-3 py-2.5 border-b border-line-soft text-right tnum ${x.diasRestantes !== null && x.diasRestantes <= 30 ? "text-neg font-semibold" : ""}`}>
                  {x.diasRestantes === null ? "—" : x.diasRestantes}
                </td>
                <td className="px-3 py-2.5 border-b border-line-soft text-xs text-muted max-w-[220px] truncate">{x.observaciones ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted max-w-4xl">
        Las tasas de las fiducias son la E.A. de los últimos 30 días del extracto (variable diaria); la de los CDT es la pactada.
        Interés estimado del mes = monto × ((1+E.A.)^(1/12) − 1). Los rendimientos de CDT tienen retención en la fuente del 4%
        (7% en cuentas y fiducias) — es anticipo de renta, no costo final. La cifra de cada posición sale del balance del mes
        seleccionado (capital + intereses causados); las fechas y tasas se editan en <Link href="/portafolio?v=mantenimiento" className="text-accent2 hover:underline">Mantenimiento</Link>.
      </p>
    </div>
  );
}

/* ---------- Escalera de vencimientos (patrón CD-ladder) ---------- */
function Escalera({ posiciones }: { posiciones: Posicion[] }) {
  const HORIZONTE = 365;
  const hoy = new Date();
  const meses: string[] = [];
  for (let i = 0; i < 12; i++) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    meses.push(["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][f.getMonth()]);
  }
  const conVenc = posiciones.filter((x) => x.diasRestantes !== null).sort((a, b) => (a.diasRestantes as number) - (b.diasRestantes as number));
  const liquidas = posiciones.filter((x) => x.diasRestantes === null);
  const totalLiquido = liquidas.reduce((s, x) => s + x.monto, 0);
  const color = (e: EstadoVenc) => (e === "vencido" || e === "decision" ? "bg-neg" : e === "por_vencer" ? "bg-gold" : "bg-royal");

  return (
    <div className="space-y-1.5">
      {/* eje de meses */}
      <div className="flex ml-[230px] text-[10px] uppercase tracking-wide text-muted">
        {meses.map((m, i) => (
          <div key={i} className="flex-1 border-l border-line pl-1">{m}</div>
        ))}
      </div>
      {/* franja de liquidez inmediata */}
      {totalLiquido > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-[230px] shrink-0 text-sm text-right pr-3">
            <span className="font-medium">Disponible hoy</span>
            <span className="block text-[11px] text-muted">{liquidas.map((l) => l.entidad).join(" · ")}</span>
          </div>
          <div className="flex-1 relative h-8 rounded-md bg-pos/15 border border-pos/30">
            <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-pos">
              {fmtCompact(totalLiquido)} a la vista (fiducias + bolsillos)
            </span>
          </div>
        </div>
      )}
      {/* una barra por CDT */}
      {conVenc.map((x) => {
        const fin = Math.min(Math.max(x.diasRestantes as number, 0) / HORIZONTE, 1) * 100;
        const vencido = (x.diasRestantes as number) < 0;
        return (
          <div key={x.id} className="flex items-center gap-2">
            <div className="w-[230px] shrink-0 text-sm text-right pr-3">
              <span className="font-medium">{x.entidad}</span>
              <span className="block text-[11px] text-muted tnum">{fmtCompact(x.monto)} · {fmtPct(x.tasaEa)}</span>
            </div>
            <div className="flex-1 relative h-8">
              <div className="absolute inset-0 rounded-md bg-card2/70" />
              {vencido ? (
                <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-neg">
                  ● VENCIDO hace {Math.abs(x.diasRestantes as number)} días — decidir
                </span>
              ) : (
                <>
                  <div className={`absolute inset-y-1 left-0 rounded-md ${color(x.estadoVenc)}`} style={{ width: `${Math.max(fin, 2)}%` }} />
                  <span className="absolute inset-y-0 flex items-center text-[11px] font-semibold tnum"
                    style={{ left: `calc(${Math.max(fin, 2)}% + 8px)` }}>
                    {x.fechaVencimiento} · {x.diasRestantes} d
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-royal" /> vigente</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gold" /> vence en ≤30 días</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neg" /> decisión requerida / vencido</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pos/40 border border-pos/50" /> disponible hoy</span>
      </div>
    </div>
  );
}

/* ---------- Dot plot: tasa por posición vs. referencias ---------- */
function DotPlot({ posiciones, benchmark, ipc }: { posiciones: Posicion[]; benchmark: number; ipc: number }) {
  const max = Math.max(...posiciones.map((x) => x.tasaEa), benchmark, ipc) * 1.15 || 0.15;
  const pos = (v: number) => `${(v / max) * 100}%`;
  const orden = [...posiciones].sort((a, b) => b.tasaEa - a.tasaEa);
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
      <div className="flex items-center gap-4 pt-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-royal" /> tasa E.A. de la posición</span>
        {benchmark > 0 && <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-neg/60" /> referencia CDT 180d ({fmtPct(benchmark)})</span>}
        {ipc > 0 && <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-gold" /> IPC 12m ({fmtPct(ipc)})</span>}
        {benchmark === 0 && ipc === 0 && <span>define las referencias en Mantenimiento para ver las líneas de comparación</span>}
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
  vencido: ["VENCIDO", "bg-neg text-white"],
};
function Badge({ estado }: { estado: EstadoVenc }) {
  const [label, cls] = BADGE[estado];
  return <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-md px-2 py-1 ${cls}`}>{label}</span>;
}
function Tab({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm border transition-colors ${
      active ? "brand-grad text-white border-transparent font-medium" : "border-line text-muted hover:text-fg hover:bg-card2"
    }`}>
      {icon}{children}
    </Link>
  );
}
