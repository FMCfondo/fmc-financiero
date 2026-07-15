import {
  dashboard, cascadaChart, kpisResumen, esfCharts, contribucion, contribucionTrend,
  gastosAdminDetalle, flujoEfectivo, esfAnalisis, erAnalisis, provisionRenta, type LineaAnalisis,
} from "@/lib/statements";
import { indicadoresMatriz } from "@/lib/indicadores";
import { ensureLoaded, ultimosPeriodos, mesesVista, fact, ytd } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCompact, fmtPct, fmtMillones, fmtCont, fmtPctCont } from "@/lib/format";
import {
  TrendChart, ResultBars, WaterfallChart, DualLine, HBars, PctBars, VarBars,
  Sparkline, ContribBars,
} from "@/components/Charts";
import SeccionesTabs from "@/components/SeccionesTabs";
import MesesSelector from "@/components/MesesSelector";
import AnioSelector from "@/components/AnioSelector";
import { ShieldCheck, TrendingUp, TrendingDown, Info, AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string; sec?: string; meses?: string; anio?: string }> }) {
  const { p, sec, meses, anio } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = sec || "resumen";
  const nMeses = Math.min(Math.max(parseInt(meses || "6") || 6, 1), 24);
  const nAnio = anio ? parseInt(anio) : undefined;
  await ensureLoaded();

  return (
    <div className="space-y-5">
      <SeccionesTabs current={current} />
      <p className="text-sm text-muted">{etqNombre(etq)} · cifras en pesos colombianos</p>
      {current === "resumen" && <Resumen etq={etq} />}
      {current === "situacion" && <Situacion etq={etq} />}
      {current === "resultados" && <Resultados etq={etq} />}
      {current === "flujo" && <Flujo etq={etq} />}
      {current === "indicadores" && <Indicadores etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "tendencias" && <Tendencias etq={etq} />}
    </div>
  );
}

/* ================= RESUMEN — la portada ejecutiva ================= */
function Resumen({ etq }: { etq: string }) {
  const c = contribucion(etq);
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
          <span className="text-xs text-muted">Contribución acumulada del año</span>
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
          <Cifra label="Utilidad neta (año)" value={fmtCOP(c.utilNeta)} tone={c.utilNeta >= 0 ? "pos" : "neg"} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-medium mb-1">De los ingresos a la utilidad</h2>
          <WaterfallChart data={cascadaChart(etq)} />
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

      <div className="card p-5">
        <h2 className="font-medium mb-1">Respaldo frente a obligaciones</h2>
        <p className="text-sm text-muted mb-4">Lo que el fondo tiene invertido contra lo que debe garantizar.</p>
        <HBars data={[{ name: "Respaldo (inversiones + efectivo)", value: respaldo }, { name: "Obligaciones de garantías", value: oblig }]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card titulo="Composición del activo" sub="Ordenado por peso">
          <PctBars data={pctData(a.activo)} />
        </Card>
        <Card titulo="Composición del pasivo" sub="Ordenado por peso">
          <PctBars data={pctData(a.pasivo)} />
        </Card>
      </div>

      <Card titulo="Tendencia Activo vs Pasivo" sub="12 meses">
        <DualLine data={ec.trend} />
      </Card>
    </div>
  );
}

/* ================= RESULTADOS ================= */
function Resultados({ etq }: { etq: string }) {
  const c = contribucion(etq);
  const d = dashboard(etq);
  const gastos = gastosAdminDetalle(etq);
  const a = erAnalisis(etq);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Cifra label="Ingresos por cobertura de créditos" value={fmtCOP(c.ingCob)} sub={`aporte neto tras costo: ${fmtCompact(c.contribCob)}`} />
        <Cifra label="Ingresos por inversiones" value={fmtCOP(c.contribInv)} sub={`${fmtPct(c.pctInv)} de la contribución`} />
        <Cifra label="Gastos de administración" value={fmtCOP(c.gastosAdmin)} />
        <Cifra label="Utilidad neta (año)" value={fmtCOP(c.utilNeta)} tone={c.utilNeta >= 0 ? "pos" : "neg"} />
      </div>

      <Card titulo="De los ingresos a la utilidad" sub="Acumulado del año">
        <WaterfallChart data={cascadaChart(etq)} />
      </Card>

      <Card titulo="Las dos vías de ingreso, mes a mes" sub="Cobertura de créditos e inversiones (aporte neto)">
        <ContribBars data={contribucionTrend(etq)} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card titulo="Gastos de administración por categoría" sub="Sin el costo de cobertura">
          <HBars data={gastos.slice(0, 8)} />
          <p className="text-xs text-faint mt-2">
            El costo de cobertura ({fmtCOP(c.costoCob)}) se excluye a propósito: vive en la cuenta 5199 y es el 84% de
            la clase 51. Incluirlo taparía todo lo demás bajo una barra llamada &ldquo;Otros gastos&rdquo;.
          </p>
        </Card>
        <Card titulo="Ingresos vs Gastos" sub="12 meses">
          <TrendChart data={d.trend} />
        </Card>
      </div>

      <Card titulo="Participación de los ingresos" sub="% sobre ingresos totales">
        <PctBars data={pctData(a.ingresos)} />
      </Card>
    </div>
  );
}

/* ================= FLUJO DE EFECTIVO ================= */
function Flujo({ etq }: { etq: string }) {
  const f = flujoEfectivo(etq);
  if (!f) return <Vacio texto="No hay período anterior para calcular el flujo de este corte." />;
  const serie = ultimosPeriodos(etq, 12).map((q) => ({ name: q.etiqueta, value: fact(q.etiqueta, "11") }));
  const cascada = [
    { name: "Efectivo inicial", base: 0, value: f.dispIni, tipo: "total", signo: 1 },
    { name: "Operación", base: Math.min(f.dispIni, f.dispIni + f.flujoOp), value: Math.abs(f.flujoOp), tipo: f.flujoOp >= 0 ? "inc" : "dec", signo: Math.sign(f.flujoOp) },
    { name: "Inversión", base: Math.min(f.dispIni + f.flujoOp, f.dispIni + f.flujoOp + f.flujoInv), value: Math.abs(f.flujoInv), tipo: f.flujoInv >= 0 ? "inc" : "dec", signo: Math.sign(f.flujoInv) },
    { name: "Financiación", base: Math.min(f.dispIni + f.flujoOp + f.flujoInv, f.dispFin), value: Math.abs(f.flujoFin), tipo: f.flujoFin >= 0 ? "inc" : "dec", signo: Math.sign(f.flujoFin) },
    { name: "Efectivo final", base: 0, value: f.dispFin, tipo: "total", signo: 1 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Cifra label="Flujo de operación" value={fmtCOP(f.flujoOp)} tone={f.flujoOp >= 0 ? "pos" : "neg"} />
        <Cifra label="Flujo de inversión" value={fmtCOP(f.flujoInv)} tone={f.flujoInv >= 0 ? "pos" : "neg"} />
        <Cifra label="Flujo de financiación" value={fmtCOP(f.flujoFin)} tone={f.flujoFin >= 0 ? "pos" : "neg"} />
        <Cifra label="Variación neta del efectivo" value={fmtCOP(f.neto)} tone={f.neto >= 0 ? "pos" : "neg"} />
      </div>

      <Card titulo="De dónde vino y a dónde fue el efectivo" sub="Movimiento del mes">
        <WaterfallChart data={cascada} />
      </Card>

      <Card titulo="Evolución del efectivo" sub="12 meses">
        <HBars data={serie} />
      </Card>

      {Math.abs(f.ajuste) > 1 && (
        <Aviso>
          Hay {fmtCOP(Math.abs(f.ajuste))} de partidas no monetarias y ajustes que se absorben en el flujo de operación
          para que el estado cuadre exactamente contra el efectivo real.
        </Aviso>
      )}
    </div>
  );
}

/* ================= INDICADORES — filas por indicador, meses en columnas ================= */
function Indicadores({ etq, nMeses, anio }: { etq: string; nMeses: number; anio?: number }) {
  const meses = mesesVista(etq, anio, nMeses);
  if (!meses.length) return <Vacio texto="No hay datos para ese año." />;
  const cats = indicadoresMatriz(meses);
  const labels = meses.map((m) => `${["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m.mes]} ${String(m.anio).slice(2)}`);
  const conNota = cats.flatMap((c) => c.filas).filter((f) => f.nota);

  const fmtVal = (v: number, formato: string) =>
    formato === "pct" ? fmtPctCont(v) : formato === "veces" ? (v ? v.toFixed(2) + "x" : "—") : fmtCont(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5 flex-wrap">
        <AnioSelector current={anio} />
        {!anio && <MesesSelector current={nMeses} />}
      </div>

      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              <th className="sticky left-0 z-10 bg-card text-left font-normal px-5 py-2.5 border-b border-line min-w-[300px]">Indicador</th>
              {labels.map((l) => (
                <th key={l} className="text-right font-normal px-3 py-2.5 border-b border-line min-w-[104px]">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => (
              <CatRows key={cat.id} cat={cat} nCols={labels.length} fmtVal={fmtVal} />
            ))}
          </tbody>
        </table>
      </div>

      {conNota.length > 0 && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-fg"><AlertTriangle size={14} className="text-gold" /> Léelos con contexto</div>
          {conNota.map((f) => (
            <p key={f.id} className="text-xs text-muted"><b className="text-fg">{f.nombre}:</b> {f.nota}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function CatRows({ cat, nCols, fmtVal }: {
  cat: { id: string; nombre: string; desc: string; filas: { id: string; nombre: string; formato: string; nota?: string; formula: string; vals: number[] }[] };
  nCols: number;
  fmtVal: (v: number, formato: string) => string;
}) {
  return (
    <>
      <tr>
        <td colSpan={nCols + 1} className="px-5 py-2.5 bg-card2 border-y border-line">
          <span className="font-semibold">{cat.nombre}</span>
          <span className="text-xs text-muted ml-3">{cat.desc}</span>
        </td>
      </tr>
      {cat.filas.map((f) => (
        <tr key={f.id} className="hover:bg-card2/60">
          <td className="sticky left-0 z-10 bg-card px-5 py-2 border-b border-line-soft" title={f.formula}>
            <span className="flex items-center gap-1.5 pl-3">
              <span className="text-muted">{f.nombre}</span>
              {f.nota && <AlertTriangle size={12} className="text-gold shrink-0" />}
            </span>
          </td>
          {f.vals.map((v, i) => (
            <td key={i} className={`text-right tnum tabular-nums px-3 py-2 border-b border-line-soft whitespace-nowrap ${f.nota ? "text-muted" : "text-fg"}`}>
              {fmtVal(v, f.formato)}
            </td>
          ))}
        </tr>
      ))}
    </>
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
        <Card titulo="Ingresos vs Gastos" sub="12 meses"><TrendChart data={d.trend} /></Card>
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
