import { dashboard, areaDetalle, operacion, cascadaChart, kpisResumen } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCompact, fmtPct, fmtNum } from "@/lib/format";
import DashboardTabs from "@/components/DashboardTabs";
import { TrendChart, ResultBars, DonutComposition, WaterfallChart, PALETTE } from "@/components/Charts";
import { Landmark, Scale, PiggyBank, TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string; tab?: string }> }) {
  const { p, tab } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = tab || "resumen";
  await ensureLoaded();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · cifras en pesos colombianos</p>
      </div>
      <DashboardTabs current={current} />
      {current === "resumen" && <Resumen etq={etq} />}
      {current === "activos" && <Area etq={etq} clase={1} titulo="Activos" />}
      {current === "pasivos" && <Area etq={etq} clase={2} titulo="Pasivos" />}
      {current === "ingresos" && <Ingresos etq={etq} />}
      {current === "gastos" && (
        <Area etq={etq} clase={5} titulo="Gastos de operación"
          nota="El costo de cobertura (5199150101 «Mutuales») se reclasifica como costo y se presenta en la pestaña Ingresos, no aquí." />
      )}
    </div>
  );
}

/* ---------- Resumen ---------- */
function Resumen({ etq }: { etq: string }) {
  const k = kpisResumen(etq);
  const d = dashboard(etq);
  const cas = cascadaChart(etq);
  const top = d.compActivo.slice(0, 6);
  const otros = d.compActivo.slice(6).reduce((s, x) => s + x.value, 0);
  const donut = otros > 0 ? [...top, { name: "Otros", value: otros }] : top;

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Ind label="Margen neto (año)" value={fmtPct(d.indicadores.margenNeto)} />
        <Ind label="ROE (año)" value={fmtPct(d.indicadores.roe)} />
        <Ind label="Endeudamiento" value={fmtPct(d.indicadores.endeudamiento)} />
        <Ind label="Autonomía" value={fmtPct(d.indicadores.autonomia)} />
      </div>
    </div>
  );
}

/* ---------- Área genérica (Activos/Pasivos/Gastos) ---------- */
function Area({ etq, clase, titulo, nota }: { etq: string; clase: number; titulo: string; nota?: string }) {
  const a = areaDetalle(etq, clase);
  const donut = a.grupos.slice(0, 7).map((g) => ({ name: g.nombre, value: Math.abs(g.valor) }));
  const inv = clase === 5;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label={`Total ${titulo}`} value={fmtCOP(a.total)} tone="accent" yoy={a.pctAnio} inv={inv} />
        <MiniVar label="Variación mensual" pct={a.pctMes} inv={inv} />
        <MiniVar label="Variación anual" pct={a.pctAnio} inv={inv} />
      </div>
      {nota && <p className="text-xs text-faint">{nota}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="card p-5">
          <h2 className="font-medium mb-1">Composición</h2>
          <DonutComposition data={donut} />
          <Legend items={donut} />
        </div>
        <div className="card overflow-hidden lg:col-span-2">
          <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-faint border-b border-line flex">
            <span className="flex-1">Grupo</span>
            <span className="w-40 text-right">Valor</span>
            <span className="w-36 text-right">Participación</span>
            <span className="w-24 text-right">Var. año</span>
          </div>
          {a.grupos.map((g) => (
            <div key={g.codigo} className="flex items-center px-4 py-2 border-b border-line-soft text-sm hover:bg-card2">
              <span className="flex-1 truncate"><span className="text-faint tnum text-[11px] mr-2">{g.codigo}</span>{g.nombre}</span>
              <span className={`w-40 text-right tnum ${g.valor < 0 ? "text-neg" : ""}`}>{fmtNum(g.valor)}</span>
              <span className="w-36"><Vbar share={g.share} /></span>
              <span className="w-24 text-right"><Badge pct={g.pctAnio} inv={inv} /></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Ingresos (con costo de cobertura) ---------- */
function Ingresos({ etq }: { etq: string }) {
  const o = operacion(etq);
  const a = areaDetalle(etq, 4);
  const donut = a.grupos.slice(0, 6).map((g) => ({ name: g.nombre, value: Math.abs(g.valor) }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Resultado de operación · acumulado</h2></div>
          <Row label="Ingresos por servicios de cobertura" value={o.ingCob} />
          <Row label="(−) Costo del servicio (5199150101)" value={-o.costo} muted />
          <RowTotal label="Resultado bruto de cobertura" value={o.brutoCob} />
          <Row label="(+) Otros ingresos (inversiones, recuperaciones…)" value={o.otrosIng} />
          <Row label="(−) Gastos de administración" value={-o.gastosAdmin} muted />
          <RowTotal label="Utilidad antes de impuestos" value={o.utilAntesImp} />
          <Row label={`(−) Impuesto estimado (${fmtNum(o.tasa * 100)}%)`} value={-o.impuesto} muted />
          <div className="flex items-center px-4 py-3 fila-total">
            <span className="flex-1 font-semibold uppercase text-sm tracking-wide">Utilidad neta</span>
            <span className={`w-40 text-right tnum font-semibold ${o.utilNeta >= 0 ? "text-pos" : "text-neg"}`}>{fmtNum(o.utilNeta)}</span>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-medium mb-1">Composición de ingresos</h2>
          <DonutComposition data={donut} />
          <Legend items={donut} />
        </div>
      </div>
      <p className="text-xs text-faint">El costo de cobertura (5199150101 «Mutuales») se resta sólo de los ingresos por servicios de cobertura (4180). No es margen de contribución porque no aplica a inversiones ni recuperaciones.</p>
    </div>
  );
}

/* ---------- Piezas reutilizables ---------- */
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
  const cls = good ? "text-pos bg-pos/10" : "text-neg bg-neg/10";
  return <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${cls}`}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>;
}

function Vbar({ share }: { share: number }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-2 rounded-full bg-card2 overflow-hidden"><div className="h-full rounded-full bg-sky" style={{ width: `${Math.min(share * 100, 100)}%` }} /></div>
      <span className="text-xs text-faint tnum w-9 text-right">{(share * 100).toFixed(0)}%</span>
    </div>
  );
}

function MiniVar({ label, pct, inv }: { label: string; pct: number | null; inv?: boolean }) {
  return <div className="card p-4"><div className="text-xs text-muted mb-2">{label}</div><Badge pct={pct} inv={inv} /></div>;
}

function Ind({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><div className="text-xs text-muted">{label}</div><div className="text-lg font-semibold tnum mt-1">{value}</div></div>;
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center px-4 py-2 border-b border-line-soft text-sm">
      <span className={`flex-1 ${muted ? "text-muted" : "text-fg"}`}>{label}</span>
      <span className={`w-40 text-right tnum ${value < 0 ? "text-neg" : ""}`}>{fmtNum(value)}</span>
    </div>
  );
}
function RowTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center px-4 py-2.5 border-b border-line-soft text-sm fila-total">
      <span className="flex-1 font-semibold">{label}</span>
      <span className="w-40 text-right tnum font-semibold">{fmtNum(value)}</span>
    </div>
  );
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
