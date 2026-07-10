import { dashboard } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCompact, fmtPct } from "@/lib/format";
import StatCard from "@/components/StatCard";
import { TrendChart, ResultBars, DonutComposition, HBars, PALETTE } from "@/components/Charts";
import { Landmark, Scale, PiggyBank, TrendingUp, TrendingDown } from "lucide-react";

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const d = dashboard(etq);

  const top = d.compActivo.slice(0, 6);
  const otros = d.compActivo.slice(6).reduce((s, x) => s + x.value, 0);
  const donut = otros > 0 ? [...top, { name: "Otros", value: otros }] : top;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resumen financiero</h1>
          <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · cifras en pesos colombianos</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Activos totales" value={fmtCOP(d.activo)} icon={Landmark} tone="accent" sub={`Patrimonio: ${fmtCompact(d.patrim)}`} />
        <StatCard label="Pasivos totales" value={fmtCOP(d.pasivo)} icon={Scale} sub={`Endeudamiento: ${fmtPct(d.indicadores.endeudamiento)}`} />
        <StatCard label="Patrimonio" value={fmtCOP(d.patrim)} icon={PiggyBank} sub={`Autonomía: ${fmtPct(d.indicadores.autonomia)}`} />
        <StatCard
          label="Resultado del mes"
          value={fmtCOP(d.resMes)}
          icon={d.resMes >= 0 ? TrendingUp : TrendingDown}
          tone={d.resMes >= 0 ? "pos" : "neg"}
          sub={`Acumulado año: ${fmtCompact(d.resYTD)}`}
        />
      </div>

      {/* Tendencia + composición */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">Ingresos vs Gastos</h2>
            <span className="text-xs text-faint">Últimos 12 meses</span>
          </div>
          <TrendChart data={d.trend} />
        </div>
        <div className="card p-5">
          <h2 className="font-medium mb-1">Composición del activo</h2>
          <DonutComposition data={donut} />
          <ul className="mt-3 space-y-1.5">
            {donut.map((x, i) => (
              <li key={x.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="text-muted truncate flex-1">{x.name}</span>
                <span className="tnum text-faint">{fmtCompact(x.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Resultado mensual + gastos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-medium mb-4">Resultado mensual</h2>
          <ResultBars data={d.trend} />
        </div>
        <div className="card p-5">
          <h2 className="font-medium mb-4">Principales gastos del mes</h2>
          {d.gastosMes.length ? <HBars data={d.gastosMes} /> : <p className="text-sm text-faint">Sin gastos en el período.</p>}
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Indicador label="Margen neto (año)" value={fmtPct(d.indicadores.margenNeto)} />
        <Indicador label="ROE (año)" value={fmtPct(d.indicadores.roe)} />
        <Indicador label="Endeudamiento" value={fmtPct(d.indicadores.endeudamiento)} />
        <Indicador label="Autonomía" value={fmtPct(d.indicadores.autonomia)} />
      </div>
    </div>
  );
}

function Indicador({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold tnum mt-1">{value}</div>
    </div>
  );
}
