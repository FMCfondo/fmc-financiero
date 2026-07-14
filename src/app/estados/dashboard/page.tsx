import {
  dashboard, cascadaChart, kpisResumen, esfCharts, erAnalisis, esfAnalisis,
  type LineaAnalisis,
} from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCompact, fmtPct } from "@/lib/format";
import {
  TrendChart, ResultBars, DonutComposition, WaterfallChart, DualLine, PctBars, VarBars, PALETTE,
} from "@/components/Charts";
import AnalisisTabs from "@/components/AnalisisTabs";
import { Landmark, Scale, PiggyBank, TrendingUp, TrendingDown, Info, type LucideIcon } from "lucide-react";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string }> }) {
  const { p, vista } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = vista || "estado";
  await ensureLoaded();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">{etqNombre(etq)} · cifras en pesos colombianos</p>
        <AnalisisTabs current={current} mensual />
      </div>
      {current === "estado" && <VistaEstado etq={etq} />}
      {current === "mensual" && <VistaMensual etq={etq} />}
      {current === "vertical" && <VistaVertical etq={etq} />}
      {current === "horizontal" && <VistaHorizontal etq={etq} />}
      {(current === "ejec-acum" || current === "ejec-mes") && <Pendiente />}
    </div>
  );
}

/* ---------- Estado: foto del período ---------- */
function VistaEstado({ etq }: { etq: string }) {
  const k = kpisResumen(etq);
  const d = dashboard(etq);
  const cas = cascadaChart(etq);
  const ec = esfCharts(etq);
  const top = d.compActivo.slice(0, 6);
  const otros = d.compActivo.slice(6).reduce((s, x) => s + x.value, 0);
  const donut = otros > 0 ? [...top, { name: "Otros", value: otros }] : top;
  const inv = ec.compInversiones.slice(0, 6);

  return (
    <div className="space-y-5">
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

      {inv.length > 0 && (
        <div className="card p-5">
          <h2 className="font-medium mb-2">Participación de inversiones</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            <DonutComposition data={inv} />
            <div className="lg:col-span-2"><Legend items={inv} cols /></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Ind label="Margen neto (año)" value={fmtPct(d.indicadores.margenNeto)} />
        <Ind label="ROE (año)" value={fmtPct(d.indicadores.roe)} />
        <Ind label="Endeudamiento" value={fmtPct(d.indicadores.endeudamiento)} />
        <Ind label="Autonomía" value={fmtPct(d.indicadores.autonomia)} />
      </div>
    </div>
  );
}

/* ---------- Por meses: series de tiempo ---------- */
function VistaMensual({ etq }: { etq: string }) {
  const d = dashboard(etq);
  const ec = esfCharts(etq);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5"><h2 className="font-medium mb-4">Ingresos vs Gastos (12 meses)</h2><TrendChart data={d.trend} /></div>
        <div className="card p-5"><h2 className="font-medium mb-4">Resultado mensual</h2><ResultBars data={d.trend} /></div>
      </div>
      <div className="card p-5">
        <h2 className="font-medium mb-3">Tendencia Activo vs Pasivo (12 meses)</h2>
        <DualLine data={ec.trend} />
      </div>
      <p className="text-xs text-faint">¿Buscas las cifras mes a mes en tabla? Están en <b>Estados Financieros → Estado de Resultados → Por meses</b>.</p>
    </div>
  );
}

/* ---------- Vertical: participación, en gráfico ---------- */
function VistaVertical({ etq }: { etq: string }) {
  const er = erAnalisis(etq);
  const esf = esfAnalisis(etq);
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">
        Participación de cada grupo. En el ER, sobre los ingresos totales ({fmtCOP(er.ingYTD)}); en el ESF, sobre el total de activos ({fmtCOP(esf.totalActivo)}).
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <ChartCard titulo="Ingresos (% de ingresos)"><PctBars data={pctData(er.ingresos)} /></ChartCard>
        <ChartCard titulo="Gastos (% de ingresos)"><PctBars data={pctData(er.gastos)} /></ChartCard>
        <ChartCard titulo="Activo (% del activo)"><PctBars data={pctData(esf.activo)} /></ChartCard>
        <div className="space-y-4">
          <ChartCard titulo="Pasivo (% del activo)"><PctBars data={pctData(esf.pasivo)} /></ChartCard>
          <ChartCard titulo="Patrimonio (% del activo)"><PctBars data={pctData(esf.patrimonio)} /></ChartCard>
        </div>
      </div>
      <p className="text-xs text-faint">Estos mismos números en tabla detallada por cuenta: <b>Estados Financieros → Análisis Vertical</b>.</p>
    </div>
  );
}

/* ---------- Horizontal: variación vs año anterior, en gráfico ---------- */
function VistaHorizontal({ etq }: { etq: string }) {
  const er = erAnalisis(etq);
  const esf = esfAnalisis(etq);
  if (!er.py) return <div className="card p-6 text-sm text-muted">No hay período del año anterior para comparar en este corte.</div>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">Variación % frente al mismo período del año anterior. Verde crece, rojo cae.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <ChartCard titulo="Ingresos — variación anual"><VarBars data={varData(er.ingresos)} /></ChartCard>
        <ChartCard titulo="Gastos — variación anual"><VarBars data={varData(er.gastos)} /></ChartCard>
        <ChartCard titulo="Activo — variación anual"><VarBars data={varData(esf.activo)} /></ChartCard>
        <div className="space-y-4">
          <ChartCard titulo="Pasivo — variación anual"><VarBars data={varData(esf.pasivo)} /></ChartCard>
          <ChartCard titulo="Patrimonio — variación anual"><VarBars data={varData(esf.patrimonio)} /></ChartCard>
        </div>
      </div>
      <p className="text-xs text-faint">Estos mismos números en tabla detallada por cuenta: <b>Estados Financieros → Análisis Horizontal</b>.</p>
    </div>
  );
}

/* ---------- adaptadores del motor -> gráfico (misma fuente que las tablas) ---------- */
function pctData(lineas: LineaAnalisis[]) {
  return lineas
    .filter((l) => l.valor !== 0)
    .map((l) => ({ name: l.nombre, pct: +(l.pct * 100).toFixed(1), valor: l.valor }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}
function varData(lineas: LineaAnalisis[]) {
  return lineas
    .filter((l) => l.varPct !== null && Number.isFinite(l.varPct))
    .map((l) => ({ name: l.nombre, varPct: +(l.varPct as number).toFixed(1), valor: l.valor }))
    .sort((a, b) => Math.abs(b.varPct) - Math.abs(a.varPct));
}

/* ---------- helpers ---------- */
function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="font-medium mb-3 text-sm">{titulo}</h2>
      {children}
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
function Legend({ items, cols }: { items: { name: string; value: number }[]; cols?: boolean }) {
  return (
    <ul className={`mt-3 gap-1.5 ${cols ? "grid grid-cols-1 sm:grid-cols-2" : "space-y-1.5"}`}>
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
function Pendiente() {
  return (
    <div className="card p-6 flex items-start gap-3 border-accent/25">
      <Info size={18} className="text-accent2 mt-0.5 shrink-0" />
      <p className="text-sm text-muted">La ejecución presupuestal se activa al migrar el <span className="text-fg">PPTO 2026</span> a la base de datos. La estructura ya está lista.</p>
    </div>
  );
}
