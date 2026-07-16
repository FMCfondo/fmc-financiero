import {
  dashboard, cascadaChart, kpisResumen, esfCharts, contribucion, contribucionPeriodo, contribucionTrend,
  gastosAdminDetalle, esfAnalisis, erAnalisis, provisionRenta, trendCompleto, resultadosPanel, serieResultados,
  patrimonioComposicion, type LineaAnalisis,
} from "@/lib/statements";
import { indicadoresMatriz } from "@/lib/indicadores";
import Link from "next/link";
import { ensureLoaded, ultimosPeriodos, mesesVista, fact, ytd, periodo, resolverEtq } from "@/lib/data";
import { etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCompact, fmtPct, fmtMillones, fmtCont, fmtPctCont } from "@/lib/format";
import {
  TrendChart, ResultBars, WaterfallChart, DualLine, HBars, PctBars, VarBars,
  Sparkline, ContribBars, MesBars,
} from "@/components/Charts";
import TrendExplorer from "@/components/TrendExplorer";
import IndicadoresTabla from "@/components/IndicadoresTabla";
import SeccionesTabs from "@/components/SeccionesTabs";
import MesesSelector from "@/components/MesesSelector";
import AnioSelector from "@/components/AnioSelector";
import { ShieldCheck, TrendingUp, TrendingDown, Info, AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string; sec?: string; meses?: string; anio?: string; modo?: string }> }) {
  const { p, sec, meses, anio, modo } = await searchParams;
  const current = sec || "resumen";
  const nMeses = Math.min(Math.max(parseInt(meses || "6") || 6, 1), 24);
  await ensureLoaded();
  const etq = resolverEtq(p);
  // Por defecto, el segmentador arranca en el AÑO del corte (2026 hoy).
  const nAnio = anio === "ultimos" ? undefined : (parseInt(anio || "") || periodo(etq).anio);

  return (
    <div className="space-y-5">
      <SeccionesTabs current={current} />
      <p className="text-sm text-muted">{etqNombre(etq)} · cifras en pesos colombianos</p>
      {current === "resumen" && <Resumen etq={etq} modo={modo === "mes" ? "mes" : "acum"} />}
      {current === "situacion" && <Situacion etq={etq} />}
      {current === "resultados" && <Resultados etq={etq} modo={modo === "mes" ? "mes" : "acum"} />}
      {current === "indicadores" && <Indicadores etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "tendencias" && <Tendencias etq={etq} />}
    </div>
  );
}

/* ================= RESUMEN — la portada ejecutiva ================= */
function Resumen({ etq, modo }: { etq: string; modo: "acum" | "mes" }) {
  const c = contribucionPeriodo(etq, modo);
  const tag = modo === "mes" ? "del mes" : "acumulada del año";
  const k = kpisResumen(etq);
  const respaldo = fact(etq, "12") + fact(etq, "11");
  const oblig = fact(etq, "2640");
  const cobertura = oblig ? respaldo / oblig : 0;
  const serieCob = ultimosPeriodos(etq, 12).map((q) => {
    const r = fact(q.etiqueta, "12") + fact(q.etiqueta, "11");
    const o = fact(q.etiqueta, "2640");
    return o ? r / o : 0;
  });

  return (
    <div className="space-y-5">
      <ModoToggle modo={modo} />
      {/* Titular: la cobertura. Cifras de reservas redondeadas a millones mientras
          se concilia la contabilidad con el informe de gestión. */}
      <div className="card p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-muted mb-1">
            <ShieldCheck size={16} className="text-pos" /> Razón de cobertura
          </div>
          <div className={`text-5xl font-semibold tnum tracking-tight ${cobertura >= 1 ? "text-pos" : "text-neg"}`}>
            {fmtPct(cobertura)}
          </div>
          <p className="text-sm text-muted mt-2">
            El respaldo cubre {fmtPct(cobertura)} de las obligaciones de garantía.
          </p>
          <div className="mt-3"><Sparkline data={serieCob} color="#1B7A3D" height={34} /></div>
          <p className="text-[11px] text-faint mt-1">12 meses</p>
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Cifra label="Respaldo (inversiones + efectivo)" value={fmtMillones(respaldo)} />
          <Cifra label="Obligaciones de garantías" value={fmtMillones(oblig)} />
          <Cifra label="Excedente de respaldo" value={fmtMillones(respaldo - oblig)} tone={respaldo >= oblig ? "pos" : "neg"} />
        </div>
      </div>

      {/* Los dos motores */}
      <div className="card p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-medium">¿De dónde sale la utilidad?</h2>
          <span className="text-xs text-muted">Contribución {tag}</span>
        </div>
        <p className="text-sm text-muted mb-4">
          Dos vías sobre una misma estructura administrativa. Los gastos de administración no se reparten
          entre ellas porque son un costo conjunto.
        </p>
        <BarraMezcla pctCob={c.pctCob} pctInv={c.pctInv} cob={c.contribCob} inv={c.contribInv} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <Cifra label="Contribución total" value={fmtCOP(c.contribTotal)} />
          <Cifra label="(−) Gastos de administración" value={fmtCOP(c.gastosAdmin)} />
          <Cifra label="(+) Otros netos" value={fmtCOP(c.otrosNetos)} />
          <Cifra label={modo === "mes" ? "Utilidad neta (mes)" : "Utilidad neta (año)"} value={fmtCOP(c.utilNeta)} tone={c.utilNeta >= 0 ? "pos" : "neg"} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-medium mb-1">De los ingresos a la utilidad <span className="text-xs text-muted font-normal">({tag})</span></h2>
          <WaterfallChart data={cascadaChart(etq, modo)} />
        </div>
        <div className="space-y-4">
          <KpiMini label="Activos totales" value={fmtCOP(k.activo)} yoy={k.activoYoY} />
          <KpiMini label="Patrimonio (incluida utilidad)" value={fmtCOP(k.patrim)} yoy={k.patrimYoY} />
          <KpiMini label="Utilidad neta (año)" value={fmtCOP(k.utilNeta)} yoy={k.utilYoY} tone={k.utilNeta >= 0 ? "pos" : "neg"} />
        </div>
      </div>
    </div>
  );
}

/* ================= SITUACIÓN FINANCIERA ================= */
function Situacion({ etq }: { etq: string }) {
  const k = kpisResumen(etq);
  const ec = esfCharts(etq);
  const a = esfAnalisis(etq);
  const pat = patrimonioComposicion(etq);
  const respaldo = fact(etq, "12") + fact(etq, "11");
  const oblig = fact(etq, "2640");
  const cuadra = Math.abs(k.activo - (k.pasivo + k.patrim)) < 1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiMini label="Activos totales" value={fmtCOP(k.activo)} yoy={k.activoYoY} />
        <KpiMini label="Pasivos totales (incluida provisión)" value={fmtCOP(k.pasivo)} yoy={k.pasivoYoY} inv />
        <KpiMini label="Patrimonio (incluida utilidad)" value={fmtCOP(k.patrim)} yoy={k.patrimYoY} />
        <div className={`card p-4 flex items-center gap-3 ${cuadra ? "" : "border-neg/50"}`}>
          {cuadra ? <CheckCircle2 className="text-pos shrink-0" size={22} /> : <AlertTriangle className="text-neg shrink-0" size={22} />}
          <div>
            <div className="text-[13px] text-muted">Ecuación contable</div>
            <div className={`text-sm font-medium ${cuadra ? "text-pos" : "text-neg"}`}>
              {cuadra ? "Cuadra: A = P + K" : `Descuadre: ${fmtCont(k.activo - k.pasivo - k.patrim)}`}
            </div>
          </div>
        </div>
      </div>

      {/* Las participaciones que la Junta siempre pregunta: protagonistas y a lo ancho. */}
      <Card titulo="Composición del activo" sub="Participación sobre el total de activos">
        <PctBars grueso data={pctData(a.activo)} />
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card titulo="Composición del pasivo" sub="Participación sobre el total de activos">
          <PctBars grueso data={pctData(a.pasivo)} />
        </Card>
        <Card titulo="Composición del patrimonio" sub="Incluye utilidad estimada — suma el patrimonio total">
          <PctBars grueso data={pat.partes.map((x) => ({ name: x.name, pct: +((x.value / (pat.total || 1)) * 100).toFixed(1), valor: x.value }))} />
          <p className="text-xs text-muted mt-1">Patrimonio total: <b className="tnum text-fg">{fmtCOP(pat.total)}</b> — con este total la ecuación A = P + K cuadra.</p>
        </Card>
      </div>

      <Card titulo="Respaldo frente a obligaciones" sub="Lo invertido contra lo que se debe garantizar">
        <HBars grueso data={[{ name: "Respaldo (inversiones + efectivo)", value: respaldo }, { name: "Obligaciones de garantías", value: oblig }]} />
      </Card>

      <Card titulo="Tendencia Activo vs Pasivo" sub="12 meses">
        <DualLine data={ec.trend} />
      </Card>
    </div>
  );
}

/* ================= RESULTADOS — el corazón del análisis ================= */
// Rediseño (revisión del analista): KPIs con EBITDA y utilidad neta, cascada,
// las series mensuales de EBITDA y utilidad neta, y toggle acumulado/mes.
function Resultados({ etq, modo }: { etq: string; modo: "acum" | "mes" }) {
  const r = resultadosPanel(etq, modo);
  const serie = serieResultados(etq);
  const gastos = gastosAdminDetalle(etq);
  const a = erAnalisis(etq);
  const tag = modo === "mes" ? "del mes" : "acumulado del año";

  return (
    <div className="space-y-5">
      <ModoToggle modo={modo} sec="resultados" />

      {/* 1. Las cinco cifras que cuentan la historia */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Cifra label={`Ingresos por cobertura (${tag})`} value={fmtCOP(r.ingCob)} sub={`aporte neto tras costo: ${fmtCompact(r.contribCob)}`} />
        <Cifra label={`Ingresos por inversiones (${tag})`} value={fmtCOP(r.contribInv)} />
        <Cifra label={`EBITDA (${tag})`} value={fmtCOP(r.ebitda)} sub={`margen EBITDA: ${fmtPct(r.margenEbitda)}`} tone={r.ebitda >= 0 ? "pos" : "neg"} />
        <Cifra label={`Utilidad neta (${tag})`} value={fmtCOP(r.utilNeta)} sub={`margen neto: ${fmtPct(r.margenNeto)}`} tone={r.utilNeta >= 0 ? "pos" : "neg"} />
        <Cifra label={`Gastos de administración (${tag})`} value={fmtCOP(r.gastosAdmin)} />
      </div>

      {/* 2. De los ingresos a la utilidad */}
      <Card titulo="De los ingresos a la utilidad" sub={tag}>
        <WaterfallChart data={cascadaChart(etq, modo)} />
      </Card>

      {/* 3. EBITDA y utilidad neta, mes a mes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card titulo="EBITDA mensual" sub="utilidad + depreciaciones y amortizaciones · 12 meses">
          <MesBars data={serie.map((x) => ({ mes: x.mes, valor: x.ebitda }))} nombre="EBITDA del mes" />
        </Card>
        <Card titulo="Utilidad neta mensual" sub="después de la provisión de renta · 12 meses">
          <MesBars data={serie.map((x) => ({ mes: x.mes, valor: x.utilNeta }))} nombre="Utilidad neta del mes" color="#1B7A3D" />
        </Card>
      </div>

      {/* 4. Las dos vías + explorador */}
      <Card titulo="Las dos vías de ingreso, mes a mes" sub="Cobertura de créditos e inversiones (aporte neto)">
        <ContribBars data={contribucionTrend(etq)} />
      </Card>
      <Card titulo="Ingresos vs Gastos" sub="elige años y meses">
        <TrendExplorer data={trendCompleto()} />
      </Card>

      {/* 5. En qué se va y de dónde viene */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card titulo="Gastos de administración por categoría" sub="acumulado del año, sin el costo de cobertura">
          <HBars data={gastos.slice(0, 8)} />
        </Card>
        <Card titulo="Participación de los ingresos" sub="% sobre ingresos totales, acumulado">
          <PctBars data={pctData(a.ingresos)} />
        </Card>
      </div>
    </div>
  );
}

/* ================= INDICADORES — filas por indicador, meses en columnas ================= */
function Indicadores({ etq, nMeses, anio }: { etq: string; nMeses: number; anio?: number }) {
  const meses = mesesVista(etq, anio, nMeses);
  if (!meses.length) return <Vacio texto="No hay datos para ese año." />;
  const cats = indicadoresMatriz(meses);
  const labels = meses.map((m) => `${["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m.mes]} ${String(m.anio).slice(2)}`);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5 flex-wrap">
        <AnioSelector current={anio} />
        {!anio && <MesesSelector current={nMeses} />}
        <span className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-pos/20 border border-pos/50" /> bien</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-gold/20 border border-gold/60" /> alerta</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-neg/15 border border-neg/50" /> mal</span>
          <span>· pasa el mouse por un indicador para ver qué es y cómo leerlo</span>
        </span>
      </div>
      <IndicadoresTabla labels={labels} cats={cats} />
      <p className="text-xs text-muted">
        Los indicadores de ingresos muestran el valor de cada mes y su acumulado del año; los de saldo y las razones
        muestran su valor al cierre de cada mes (la última columna es el cierre del último mes visible).
      </p>
    </div>
  );
}

/* ================= TENDENCIAS ================= */
function Tendencias({ etq }: { etq: string }) {
  const d = dashboard(etq);
  const ec = esfCharts(etq);
  const per = ultimosPeriodos(etq, 12);
  const serie = (cod: string, acum = false) =>
    per.map((q) => (acum ? ytd(q.etiqueta, cod) : fact(q.etiqueta, cod)));
  const utilSerie = per.map((q) => provisionRenta(q.etiqueta).neto);

  const lineas = [
    { label: "Activos", data: serie("1"), color: "#13286E" },
    { label: "Pasivos", data: serie("2"), color: "#C99A2E" },
    { label: "Patrimonio", data: serie("3"), color: "#1B7A3D" },
    { label: "Efectivo", data: serie("11"), color: "#3B5BD9" },
    { label: "Inversiones", data: serie("12"), color: "#5E718D" },
    { label: "Obligaciones de garantías", data: serie("2640"), color: "#B3261E" },
    { label: "Ingresos (mes)", data: serie("4"), color: "#1B7A3D" },
    { label: "Utilidad neta (acum.)", data: utilSerie, color: "#13286E" },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Evolución de los últimos 12 meses. Cada línea tiene su propia escala — sirven para leer la forma, no para
        comparar magnitudes entre ellas.
      </p>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line">
          {lineas.map((l) => {
            const ult = l.data[l.data.length - 1] ?? 0;
            const pri = l.data[0] ?? 0;
            const var12 = pri ? ((ult - pri) / Math.abs(pri)) * 100 : null;
            return (
              <div key={l.label} className="bg-card p-4">
                <div className="text-[13px] text-muted">{l.label}</div>
                <div className="text-lg font-semibold tnum mt-0.5">{fmtCompact(ult)}</div>
                <div className="my-2"><Sparkline data={l.data} color={l.color} /></div>
                <div className="text-xs text-muted">
                  {var12 === null ? "—" : `${var12 >= 0 ? "▲" : "▼"} ${Math.abs(var12).toFixed(1)}% en 12 meses`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card titulo="Activo vs Pasivo" sub="12 meses"><DualLine data={ec.trend} /></Card>
        <Card titulo="Ingresos vs Gastos" sub="elige años y meses"><TrendExplorer data={trendCompleto()} /></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card titulo="Resultado mensual" sub="12 meses"><ResultBars data={d.trend} /></Card>
        <Card titulo="Las dos vías de ingreso" sub="Aporte neto mensual"><ContribBars data={contribucionTrend(etq)} /></Card>
      </div>
    </div>
  );
}

/* ================= helpers ================= */
function pctData(lineas: LineaAnalisis[]) {
  return lineas
    .filter((l) => l.valor !== 0)
    .map((l) => ({ name: l.nombre, pct: +(l.pct * 100).toFixed(1), valor: l.valor }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}
function Card({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <h2 className="font-medium">{titulo}</h2>
        {sub && <span className="text-xs text-muted whitespace-nowrap">{sub}</span>}
      </div>
      {children}
    </div>
  );
}
function Cifra({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted leading-snug">{label}</div>
      <div className={`text-lg font-semibold tnum mt-1 ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-fg"}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
function KpiMini({ label, value, yoy, tone, inv }: { label: string; value: string; yoy: number | null; tone?: "pos" | "neg"; inv?: boolean }) {
  const up = (yoy ?? 0) >= 0;
  const bien = yoy === null ? null : inv ? !up : up;
  return (
    <div className="card p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={`text-xl font-semibold tnum mt-1 ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-fg"}`}>{value}</div>
      <div className="text-xs mt-1.5">
        {yoy === null ? <span className="text-faint">sin comparativo</span> : (
          <>
            <span className={bien ? "text-pos" : "text-neg"}>{up ? "▲" : "▼"} {Math.abs(yoy).toFixed(1)}%</span>
            <span className="text-muted"> vs. año anterior</span>
          </>
        )}
      </div>
    </div>
  );
}
function BarraMezcla({ pctCob, pctInv, cob, inv }: { pctCob: number; pctInv: number; cob: number; inv: number }) {
  return (
    <div>
      <div className="flex h-9 rounded-lg overflow-hidden">
        <div className="bg-royal grid place-items-center text-white text-xs font-medium" style={{ width: `${pctCob * 100}%` }}>
          {fmtPct(pctCob)}
        </div>
        <div className="grid place-items-center text-white text-xs font-medium" style={{ width: `${pctInv * 100}%`, background: "#C99A2E" }}>
          {fmtPct(pctInv)}
        </div>
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-royal" /><span className="text-muted">Ingresos por cobertura de créditos (netos)</span> <span className="tnum text-fg">{fmtCompact(cob)}</span></span>
        <span className="flex items-center gap-1.5"><span className="tnum text-fg">{fmtCompact(inv)}</span> <span className="text-muted">Ingresos por inversiones</span><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#C99A2E" }} /></span>
      </div>
    </div>
  );
}
function ModoToggle({ modo, sec = "resumen" }: { modo: "acum" | "mes"; sec?: string }) {
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
      active ? "bg-royal text-white border-royal" : "border-line text-muted hover:text-fg hover:bg-card2"
    }`;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-fg mr-1">Ver:</span>
      <Link href={`?sec=${sec}`} className={chip(modo === "acum")}>Acumulado del año</Link>
      <Link href={`?sec=${sec}&modo=mes`} className={chip(modo === "mes")}>Mes seleccionado</Link>
    </div>
  );
}
function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="card p-5 flex items-start gap-3 border-gold/30">
      <Info size={17} className="text-gold mt-0.5 shrink-0" />
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}
function Vacio({ texto }: { texto: string }) {
  return <div className="card p-6 text-sm text-muted">{texto}</div>;
}
