import {
  dashboard, cascadaChart, kpisResumen, esfCharts, contribucion, contribucionTrend,
  gastosAdminDetalle, flujoEfectivo, esfAnalisis, erAnalisis, type LineaAnalisis,
} from "@/lib/statements";
import { indicadoresPorCategoria, indicadoresClave, type Indicador } from "@/lib/indicadores";
import { ensureLoaded, ultimosPeriodos, fact, ytd } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCompact, fmtPct, fmtNum } from "@/lib/format";
import {
  TrendChart, ResultBars, WaterfallChart, DualLine, HBars, PctBars, VarBars,
  Sparkline, ContribBars,
} from "@/components/Charts";
import SeccionesTabs from "@/components/SeccionesTabs";
import { ShieldCheck, TrendingUp, TrendingDown, Info, AlertTriangle } from "lucide-react";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string; sec?: string }> }) {
  const { p, sec } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = sec || "resumen";
  await ensureLoaded();

  return (
    <div className="space-y-5">
      <SeccionesTabs current={current} />
      <p className="text-sm text-muted">{etqNombre(etq)} · cifras en pesos colombianos</p>
      {current === "resumen" && <Resumen etq={etq} />}
      {current === "situacion" && <Situacion etq={etq} />}
      {current === "resultados" && <Resultados etq={etq} />}
      {current === "flujo" && <Flujo etq={etq} />}
      {current === "indicadores" && <Indicadores etq={etq} />}
      {current === "tendencias" && <Tendencias etq={etq} />}
    </div>
  );
}

/* ================= RESUMEN — la portada ejecutiva ================= */
function Resumen({ etq }: { etq: string }) {
  const c = contribucion(etq);
  const k = kpisResumen(etq);
  const claves = indicadoresClave(etq);
  const cob = claves.find((i) => i.id === "cobertura");
  const exc = claves.find((i) => i.id === "excedente");
  const respaldo = fact(etq, "12") + fact(etq, "11");
  const oblig = fact(etq, "2640");
  const serieCob = ultimosPeriodos(etq, 12).map((q) => {
    const r = fact(q.etiqueta, "12") + fact(q.etiqueta, "11");
    const o = fact(q.etiqueta, "2640");
    return o ? r / o : 0;
  });

  return (
    <div className="space-y-5">
      {/* Titular: la cobertura */}
      <div className="card p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-muted mb-1">
            <ShieldCheck size={16} className="text-pos" /> Razón de cobertura
          </div>
          <div className={`text-5xl font-semibold tnum tracking-tight ${(cob?.valor ?? 0) >= 1 ? "text-pos" : "text-neg"}`}>
            {fmtPct(cob?.valor ?? 0)}
          </div>
          <p className="text-sm text-muted mt-2">
            El respaldo cubre {fmtPct(cob?.valor ?? 0)} de las obligaciones de garantía.
          </p>
          <div className="mt-3"><Sparkline data={serieCob} color="#16a34a" height={34} /></div>
          <p className="text-[11px] text-faint mt-1">12 meses</p>
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Cifra label="Respaldo (inversiones + efectivo)" value={fmtCOP(respaldo)} />
          <Cifra label="Obligaciones de garantías" value={fmtCOP(oblig)} />
          <Cifra label="Excedente de respaldo" value={fmtCOP(exc?.valor ?? 0)} tone={(exc?.valor ?? 0) >= 0 ? "pos" : "neg"} />
        </div>
      </div>

      {/* Los dos motores */}
      <div className="card p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-medium">¿De dónde sale la utilidad?</h2>
          <span className="text-xs text-faint">Contribución acumulada del año</span>
        </div>
        <p className="text-sm text-muted mb-4">
          Dos motores sobre una misma estructura administrativa. Los gastos de administración no se reparten
          entre ellos porque son un costo conjunto.
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
          <KpiMini label="Patrimonio" value={fmtCOP(k.patrim)} yoy={k.patrimYoY} />
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiMini label="Activos totales" value={fmtCOP(k.activo)} yoy={k.activoYoY} />
        <KpiMini label="Pasivos totales" value={fmtCOP(k.pasivo)} yoy={k.pasivoYoY} inv />
        <KpiMini label="Patrimonio" value={fmtCOP(k.patrim)} yoy={k.patrimYoY} />
        <KpiMini label="Excedente de respaldo" value={fmtCOP(respaldo - oblig)} yoy={null} tone={respaldo >= oblig ? "pos" : "neg"} />
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
        <Cifra label="Contribución de cobertura" value={fmtCOP(c.contribCob)} sub={fmtPct(c.pctCob) + " del total"} />
        <Cifra label="Contribución de inversiones" value={fmtCOP(c.contribInv)} sub={fmtPct(c.pctInv) + " del total"} />
        <Cifra label="Gastos de administración" value={fmtCOP(c.gastosAdmin)} />
        <Cifra label="Utilidad neta (año)" value={fmtCOP(c.utilNeta)} tone={c.utilNeta >= 0 ? "pos" : "neg"} />
      </div>

      <Card titulo="De los ingresos a la utilidad" sub="Acumulado del año">
        <WaterfallChart data={cascadaChart(etq)} />
      </Card>

      <Card titulo="Los dos motores, mes a mes" sub="Contribución de cobertura e inversiones">
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
  const serie = ultimosPeriodos(etq, 12).map((q) => ({ mes: q.etiqueta, efectivo: fact(q.etiqueta, "11") }));
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
        <HBars data={serie.map((s) => ({ name: s.mes, value: s.efectivo }))} />
      </Card>

      {Math.abs(f.ajuste) > 1 && (
        <Aviso>
          Hay {fmtCOP(Math.abs(f.ajuste))} de partidas no monetarias y ajustes que se absorben en el flujo de operación
          para que el estado cuadre exactamente contra el efectivo real. Viene de los ajustes manuales de la hoja AJUSTADO.
        </Aviso>
      )}
    </div>
  );
}

/* ================= INDICADORES ================= */
function Indicadores({ etq }: { etq: string }) {
  const cats = indicadoresPorCategoria(etq);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Agrupados por lo que responden. Los que llevan aviso no deben leerse solos — su valor literal engaña
        sobre este negocio.
      </p>
      {cats.map((cat) => (
        <div key={cat.id} className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-line flex items-baseline gap-3">
            <h2 className="font-semibold">{cat.nombre}</h2>
            <span className="text-xs text-muted">{cat.desc}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line">
            {cat.indicadores.map((i) => <IndCard key={i.id} i={i} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function IndCard({ i }: { i: Indicador }) {
  const val = i.formato === "pct" ? fmtPct(i.valor) : i.formato === "veces" ? i.valor.toFixed(2) + "x" : fmtCOP(i.valor);
  const delta = i.prev !== null && i.prev !== 0 ? (i.valor - i.prev) / Math.abs(i.prev) : null;
  // Dirección: verde/rojo según si el movimiento es BUENO, no si sube.
  const bien = delta === null || !i.bueno ? null : i.bueno === "alto" ? delta >= 0 : delta <= 0;
  return (
    <div className="bg-card p-4 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-muted leading-snug">{i.nombre}</span>
        {i.nota && <AlertTriangle size={13} className="text-gold shrink-0 mt-0.5" />}
      </div>
      <div className={`text-xl font-semibold tnum ${i.nota ? "text-muted" : "text-fg"}`}>{val}</div>
      <div className="flex items-center gap-1.5 text-xs">
        {delta === null ? (
          <span className="text-faint">sin comparativo</span>
        ) : (
          <>
            <span className={bien === null ? "text-faint" : bien ? "text-pos" : "text-neg"}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
            </span>
            <span className="text-faint">vs. año anterior</span>
          </>
        )}
      </div>
      <p className="text-[11px] text-faint mt-1 leading-snug">{i.formula}</p>
      {i.nota && (
        <p className="text-[11px] text-gold/90 leading-snug mt-1 border-l-2 border-gold/40 pl-2">{i.nota}</p>
      )}
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

  const lineas = [
    { label: "Activos", data: serie("1"), color: "#1e40af" },
    { label: "Pasivos", data: serie("2"), color: "#c99a2e" },
    { label: "Patrimonio", data: serie("3"), color: "#16a34a" },
    { label: "Efectivo", data: serie("11"), color: "#45b6e8" },
    { label: "Inversiones", data: serie("12"), color: "#5b6ee1" },
    { label: "Obligaciones de garantías", data: serie("2640"), color: "#dc2626" },
    { label: "Ingresos (mes)", data: serie("4"), color: "#3ddc97" },
    { label: "Gastos (mes)", data: serie("5"), color: "#e0b94a" },
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
                <div className="text-xs text-faint">
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
        <Card titulo="Los dos motores" sub="Contribución mensual"><ContribBars data={contribucionTrend(etq)} /></Card>
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
        {sub && <span className="text-xs text-faint whitespace-nowrap">{sub}</span>}
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
      {sub && <div className="text-[11px] text-faint mt-0.5">{sub}</div>}
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
            <span className="text-faint"> vs. año anterior</span>
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
        <div className="bg-sky grid place-items-center text-royal text-xs font-medium" style={{ width: `${pctInv * 100}%` }}>
          {fmtPct(pctInv)}
        </div>
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-royal" /><span className="text-muted">Cobertura</span> <span className="tnum text-fg">{fmtCompact(cob)}</span></span>
        <span className="flex items-center gap-1.5"><span className="tnum text-fg">{fmtCompact(inv)}</span> <span className="text-muted">Inversiones</span><span className="h-2.5 w-2.5 rounded-full bg-sky" /></span>
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
