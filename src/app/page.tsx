import { dashboard, cascadaChart, kpisResumen, esfCharts } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCompact, fmtPct } from "@/lib/format";
import { TrendChart, ResultBars, DonutComposition, WaterfallChart, DualLine, PALETTE } from "@/components/Charts";
import { Landmark, Scale, PiggyBank, TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const k = kpisResumen(etq);
  const d = dashboard(etq);
  const cas = cascadaChart(etq);
  const ec = esfCharts(etq);
  const top = d.compActivo.slice(0, 6);
  const otros = d.compActivo.slice(6).reduce((s, x) => s + x.value, 0);
  const donut = otros > 0 ? [...top, { name: "Otros", value: otros }] : top;
  const inv = ec.compInversiones.slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · cifras en pesos colombianos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Activos totales" value={fmtCOP(k.activo)} icon={Landmark} tone="accent" yoy={k.activoYoY} />
        <Kpi label="Pasivos totales" value={fmtCOP(k.pasivo)} icon={Scale} yoy={k.pasivoYoY} inv />
        <Kpi label="Patrimonio" value={fmtCOP(k.patrim)} icon={PiggyBank} yoy={k.patrimYoY} />
        <Kpi label="Utilidad neta (año)" value={fmtCOP(k.utilNeta)} icon={k.utilNeta >= 0 ? TrendingUp : TrendingDown} tone={k.utilNeta >= 0 ? "pos" : "neg"} yoy={k.utilYoY} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium">Cascada de utilidad</h2>
            <span className="text-xs text-faint">Acumulado del año</span>
          </div>
          <WaterfallChart data={cas} />
        </div>
        <div className="card p-5">
          <h2 className="font-medium mb-1">Composición del activo</h2>
          <DonutComposition data={donut} />
          <Legend items={donut} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5"><h2 className="font-medium mb-4">Ingresos vs Gastos (12 meses)</h2><TrendChart data={d.trend} /></div>
        <div className="card p-5"><h2 className="font-medium mb-4">Resultado mensual</h2><ResultBars data={d.trend} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-medium mb-3">Tendencia Activo vs Pasivo (12 meses)</h2>
          <DualLine data={ec.trend} />
        </div>
        {inv.length > 0 && (
          <div className="card p-5">
            <h2 className="font-medium mb-1">Participación de inversiones</h2>
            <DonutComposition data={inv} />
            <Legend items={inv} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Ind label="Margen neto (año)" value={fmtPct(d.indicadores.margenNeto)} />
        <Ind label="ROE (año)" value={fmtPct(d.indicadores.roe)} />
        <Ind label="Endeudamiento" value={fmtPct(d.indicadores.endeudamiento)} />
        <Ind label="Autonomía" value={fmtPct(d.indicadores.autonomia)} />
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone, yoy, inv }: {
  label: string; value: string; icon?: LucideIcon; tone?: "pos" | "neg" | "accent"; yoy: number | null; inv?: boolean;
}) {
  const vt = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "accent" ? "text-accent2" : "text-fg";
  const iw = tone === "pos" ? "bg-pos/10 text-pos" : tone === "neg" ? "bg-neg/10 text-neg" : tone === "accent" ? "bg-accent/10 text-accent2" : "bg-card2 text-muted";
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        {Icon && <span className={`h-8 w-8 grid place-items-center rounded-lg ${iw}`}><Icon size={16} /></span>}
      </div>
      <div className={`text-2xl font-semibold tnum tracking-tight ${vt}`}>{value}</div>
      <div className="flex items-center gap-1.5 text-xs"><Badge pct={yoy} inv={inv} /><span className="text-faint">vs. año anterior</span></div>
    </div>
  );
}
function Badge({ pct, inv }: { pct: number | null; inv?: boolean }) {
  if (pct === null) return <span className="text-xs text-faint">—</span>;
  if (Math.abs(pct) < 0.1) return <span className="text-xs text-faint px-1.5 py-0.5 rounded-md bg-card2">= 0%</span>;
  const up = pct >= 0;
  const good = inv ? !up : up;
  return <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${good ? "text-pos bg-pos/10" : "text-neg bg-neg/10"}`}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>;
}
function Ind({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><div className="text-xs text-muted">{label}</div><div className="text-lg font-semibold tnum mt-1">{value}</div></div>;
}
function Legend({ items }: { items: { name: string; value: number }[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((x, i) => (
        <li key={x.name} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
          <span className="text-muted truncate flex-1">{x.name}</span>
          <span className="tnum text-faint">{fmtCompact(x.value)}</span>
        </li>
      ))}
    </ul>
  );
}
