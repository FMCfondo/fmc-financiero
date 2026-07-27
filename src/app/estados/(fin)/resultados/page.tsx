import Link from "next/link";
import { erMatrizArbol, analisisMatriz, interanualData, TAM_UNIDAD, type UnidadPeriodo } from "@/lib/statements";
import { type FilaEjec } from "@/lib/ejecucion";
import { presupuestoArbol, ejecucionArbol, lineasMapeo } from "@/lib/presupuesto";
import { ensureLoaded, mesesVista, periodo, resolverEtq } from "@/lib/data";
import { indicadoresMatriz } from "@/lib/indicadores";
import { etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum, fmtCont, fmtM } from "@/lib/format";
import StatementMatrix from "@/components/StatementMatrix";
import AnalisisTabs from "@/components/AnalisisTabs";
import MesesSelector from "@/components/MesesSelector";
import AnalisisMatrix from "@/components/AnalisisMatrix";
import AnioSelector from "@/components/AnioSelector";
import InteranualSelector from "@/components/InteranualSelector";
import IndicadoresTabla from "@/components/IndicadoresTabla";
import PresupuestoMatrix from "@/components/PresupuestoMatrix";
import EjecucionMatrix from "@/components/EjecucionMatrix";
import MapeoEditor from "@/components/MapeoEditor";
import { Info, SlidersHorizontal, ArrowLeft } from "lucide-react";

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; meses?: string; anio?: string; contra?: string; unidad?: string; idx?: string }> }) {
  const { p, vista, meses, anio, contra, unidad, idx } = await searchParams;
  const current = vista || "estado";
  const nMeses = Math.min(Math.max(parseInt(meses || "4") || 4, 1), 24);
  const vContra = contra === "mes" ? "mes" as const : "anio" as const;
  await ensureLoaded();
  const etq = resolverEtq(p);
  // Por defecto, el segmentador arranca en el AÑO del corte (2026 hoy).
  const nAnio = anio === "ultimos" ? undefined : (parseInt(anio || "") || periodo(etq).anio);
  // Interanual: unidad de período + índice (por defecto, el período que contiene el mes del corte).
  const UNIDADES = ["mes", "bimestre", "trimestre", "cuatrimestre", "semestre", "anio"];
  const vUnidad = (UNIDADES.includes(unidad || "") ? unidad : "mes") as UnidadPeriodo;
  const maxIdx = 12 / TAM_UNIDAD[vUnidad];
  const vIdx = Math.min(Math.max(parseInt(idx || "") || Math.ceil(periodo(etq).mes / TAM_UNIDAD[vUnidad]), 1), maxIdx);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">{etqNombre(etq)} · pesos colombianos</p>
        <AnalisisTabs current={current} />
      </div>
      {current === "estado" && <VistaEstado etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "vertical" && <VistaAnalisis modo="vertical" etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "horizontal" && <VistaAnalisis modo="horizontal" etq={etq} nMeses={nMeses} anio={nAnio} contra={vContra} />}
      {current === "interanual" && <VistaInteranual unidad={vUnidad} idx={vIdx} />}
      {current === "presupuesto" && <VistaPresupuesto etq={etq} />}
      {current === "mapeo" && <VistaMapeo etq={etq} />}
      {current === "ejec-acum" && <VistaEjecucion etq={etq} modo="acum" />}
      {current === "ejec-mes" && <VistaEjecucion etq={etq} modo="mes" />}
    </div>
  );
}

/* ---------- Estado: árbol completo, meses de izquierda a derecha + Acumulado ---------- */
function VistaEstado({ etq, nMeses, anio }: { etq: string; nMeses: number; anio?: number }) {
  const meses = mesesVista(etq, anio, nMeses);
  if (!meses.length) return <div className="card p-6 text-sm text-muted">No hay datos para ese año.</div>;
  const m = erMatrizArbol(meses);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        <AnioSelector current={anio} />
        {!anio && <MesesSelector current={nMeses} />}
      </div>
      <StatementMatrix
        labels={m.labels}
        conAcum
        persistKey="er-estado"
        secciones={[
          { titulo: "Ingresos", tono: "bg-pos", arbol: m.ingresos, totalLabel: "Total ingresos", totalVals: m.totalIng.vals, totalAcum: m.totalIng.acum },
          { titulo: "Gastos (sin depreciaciones ni amortizaciones)", tono: "bg-gold", arbol: m.gastos, totalLabel: "Total gastos operativos", totalVals: m.totalGas.vals, totalAcum: m.totalGas.acum },
        ]}
        filasFinales={[
          { nombre: "(=) EBITDA", vals: m.ebitda.vals, acum: m.ebitda.acum, tipo: "sub" },
          { nombre: "(−) Depreciaciones", vals: m.dep.vals, acum: m.dep.acum },
          { nombre: "(−) Amortizaciones", vals: m.amort.vals, acum: m.amort.acum },
          { nombre: "(=) Utilidad antes de impuestos", vals: m.utilAntes.vals, acum: m.utilAntes.acum, tipo: "sub" },
          { nombre: `(−) Impuesto de renta estimado (${fmtNum(m.tasa * 100)}%)`, vals: m.impuesto.vals, acum: m.impuesto.acum },
          { nombre: "(=) Utilidad neta", vals: m.utilNeta.vals, acum: m.utilNeta.acum, tipo: "total" },
        ]}
      />
      <p className="text-xs text-faint">
        Estructura EBITDA: los gastos se muestran sin depreciaciones ni amortizaciones, que bajan como líneas propias hasta la
        utilidad antes de impuestos. Cada columna es el movimiento del mes y el <b>Acumulado</b> del año va en el recuadro final;
        el impuesto de cada mes es la provisión marginal (los meses suman el acumulado, que usa la provisión completa de{" "}
        <Link href={`/impuesto?p=${etq}`} className="text-accent2 hover:underline">Provisión de Impuesto</Link>).
      </p>
    </div>
  );
}

/* ---------- Análisis Vertical / Horizontal: misma vista de árbol × meses ---------- */
function VistaAnalisis({ modo, etq, nMeses, anio, contra = "anio" }: { modo: "vertical" | "horizontal"; etq: string; nMeses: number; anio?: number; contra?: "anio" | "mes" }) {
  const meses = mesesVista(etq, anio, nMeses);
  if (!meses.length) return <div className="card p-6 text-sm text-muted">No hay datos para ese año.</div>;
  const a = analisisMatriz("er", modo, meses, contra);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        <AnioSelector current={anio} />
        {!anio && <MesesSelector current={nMeses} />}
        {modo === "horizontal" && (
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-fg mr-1">Comparar contra:</span>
            <Link href="?vista=horizontal" className={`px-2.5 py-1 rounded-md text-xs font-medium border ${contra === "anio" ? "bg-royal text-white border-royal" : "border-line text-muted hover:text-fg hover:bg-card2"}`}>Mismo mes, año anterior</Link>
            <Link href="?vista=horizontal&contra=mes" className={`px-2.5 py-1 rounded-md text-xs font-medium border ${contra === "mes" ? "bg-royal text-white border-royal" : "border-line text-muted hover:text-fg hover:bg-card2"}`}>Mes anterior</Link>
          </span>
        )}
      </div>
      <AnalisisMatrix labels={a.labels} secciones={a.secciones} filasFinales={a.filasFinales} colorear={modo === "horizontal"} persistKey={`er-${modo}`} />
      <p className="text-xs text-muted">
        {modo === "vertical"
          ? `Cada celda es la participación de la cuenta sobre ${a.base}. Los gastos van sin depreciaciones ni amortizaciones, que cierran la estructura EBITDA al pie.`
          : `Cada celda es la variación del mes contra ${a.base}; la raya (—) indica que no existe comparativo. El cierre EBITDA va al pie.`}
      </p>
    </div>
  );
}

/* ---------- Comparación interanual: el mismo período, a través de los años ----------
   Todo en UNA hoja: recuadros de Cifras, Horizontal y Vertical deslizando a la
   derecha, más el Resumen del período y los Indicadores al cierre. */
function VistaInteranual({ unidad, idx }: { unidad: UnidadPeriodo; idx: number }) {
  const d = interanualData("er", unidad, idx);
  const cats = indicadoresMatriz(d.periodosCierre);
  return (
    <div className="space-y-4">
      <InteranualSelector unidad={unidad} idx={idx} />

      {/* Los tres recuadros, deslizando a la derecha */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 w-max items-start">
          <Recuadro titulo="Cifras del período" sub="cada celda SUMA los meses del período" tono="bg-royal">
            <StatementMatrix
              labels={d.labels}
              conAcum={false}
              secciones={[
                { titulo: "Ingresos", tono: "bg-pos", arbol: d.cifras[0].arbol, totalLabel: "Total ingresos", totalVals: d.cifras[0].totalVals },
                { titulo: "Gastos (sin dep. ni amort.)", tono: "bg-gold", arbol: d.cifras[1].arbol, totalLabel: "Total gastos operativos", totalVals: d.cifras[1].totalVals },
              ]}
              filasFinales={d.finalesCifras}
            />
          </Recuadro>
          <Recuadro titulo="Análisis Horizontal" sub="cada año contra el año anterior con datos" tono="bg-gold">
            <AnalisisMatrix labels={d.labels} secciones={d.horizontal} filasFinales={d.finalesHorizontal} colorear />
          </Recuadro>
          <Recuadro titulo="Análisis Vertical" sub="participación dentro de su propio período" tono="bg-pos">
            <AnalisisMatrix labels={d.labels} secciones={d.vertical} filasFinales={d.finalesVertical} />
          </Recuadro>
        </div>
      </div>

      {/* Resumen del período: los dos motores, año contra año */}
      <Recuadro titulo="Resumen del período" sub="los dos motores, año contra año">
        <div className="card overflow-auto">
          <table className="text-sm border-collapse w-max min-w-full">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted">
                <th className="text-left font-normal px-5 py-2.5 border-b border-line min-w-[300px]">Concepto</th>
                {d.labels.map((l) => <th key={l} className="text-right font-normal px-3 py-2.5 border-b border-line min-w-[122px]">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.resumen.map((r) => {
                const total = r.nombre.startsWith("(=)");
                return (
                  <tr key={r.nombre} className={total ? "bg-card2 font-semibold" : ""}>
                    <td className={`px-5 py-2.5 border-b border-line-soft ${total ? "uppercase text-[13px] tracking-wide" : "text-muted"}`}>{r.nombre}</td>
                    {r.vals.map((v, i) => (
                      <td key={i} className="text-right tnum tabular-nums px-3 py-2.5 border-b border-line-soft whitespace-nowrap">
                        <span className={total ? "border-t border-b-[3px] border-double border-fg/60 py-0.5 inline-block" : ""}>
                          {v === null ? "—" : fmtCont(v, total)}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Recuadro>

      <Recuadro titulo="Indicadores al cierre del período" sub="pasa el mouse por un indicador para ver qué es y cómo leerlo">
        <IndicadoresTabla labels={d.labelsCierre} cats={cats} conAcum={false} />
      </Recuadro>

      <p className="text-xs text-muted">
        Columnas: el mismo período en cada año de funcionamiento.
        {d.algunParcial && <> Los años con <b>*</b> tienen el período incompleto (aún no existen todos sus meses); la raya (—) indica que no hay datos.</>}
      </p>
    </div>
  );
}

function Recuadro({ titulo, sub, tono, children }: { titulo: string; sub?: string; tono?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-line bg-card2/40 p-4 space-y-3 shrink-0 max-w-full">
      <div className="flex items-baseline gap-2 flex-wrap">
        {tono && <span className={`w-1.5 h-4 rounded ${tono}`} />}
        <h2 className="font-semibold">{titulo}</h2>
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

/* ---------- Presupuesto: la plantilla anual completa, expandible ---------- */
function VistaPresupuesto({ etq }: { etq: string }) {
  const ANIO = periodo(etq).anio;
  const p = presupuestoArbol(ANIO);
  if (!p.hay) return <AvisoInfo>El presupuesto de {ANIO} aún no está cargado.</AvisoInfo>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Presupuesto {ANIO} · estructura EBITDA · el mismo orden del Estado de Resultados · pesos colombianos</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MiniKpi label="Ingresos de operación" valor={p.resumen.ingOperacion} />
        <MiniKpi label="Gastos de administración" valor={p.resumen.gastosAdmin} />
        <MiniKpi label="EBITDA presupuestado" valor={p.resumen.ebitda} />
        <MiniKpi label="Utilidad neta presupuestada" valor={p.resumen.utilNeta} />
      </div>
      <PresupuestoMatrix labels={p.labels} roots={p.roots} persistKey={`ppto-${ANIO}`} />
    </div>
  );
}

/* ---------- Editor del mapeo presupuesto → cuentas PUC ---------- */
function VistaMapeo({ etq }: { etq: string }) {
  const ANIO = periodo(etq).anio;
  const lineas = lineasMapeo(ANIO, periodo(etq).mes, "acum");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">Mapeo de cuentas del presupuesto {ANIO}</p>
        <Link href="?vista=ejec-acum" className="text-xs text-accent2 hover:underline inline-flex items-center gap-1"><ArrowLeft size={12} /> Volver a la ejecución</Link>
      </div>
      <MapeoEditor anio={ANIO} lineas={lineas} />
    </div>
  );
}

/* ---------- Ejecución presupuestal JERÁRQUICA: presupuesto vs. real ---------- */
function VistaEjecucion({ etq, modo }: { etq: string; modo: "acum" | "mes" }) {
  const ANIO = periodo(etq).anio;
  const mesHasta = periodo(etq).mes;
  const e = ejecucionArbol(ANIO, mesHasta, modo);
  if (!e.hay) return <AvisoInfo>El presupuesto de {ANIO} aún no está cargado.</AvisoInfo>;
  if (!e.hayReal) return <div className="card p-6 text-sm text-muted">Aún no hay datos reales de {ANIO} para comparar.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">Ejecución {e.periodoLabel} · el real (Estado de Resultados) frente al presupuesto de la Junta · pesos colombianos</p>
        <Link href="?vista=mapeo" className="text-xs text-accent2 hover:underline inline-flex items-center gap-1"><SlidersHorizontal size={12} /> Editar mapeo de cuentas</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiEjec label="Ingresos de operación" fila={e.kpis.ingOp} />
        <KpiEjec label="Gastos de administración" fila={e.kpis.gastosAdmin} />
        <KpiEjec label="EBITDA" fila={e.kpis.ebitda} />
        <KpiEjec label="Utilidad neta" fila={e.kpis.utilNeta} />
      </div>

      <EjecucionMatrix roots={e.roots} persistKey={`ejec-${ANIO}-${modo}`} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="card p-5">
          <h3 className="font-medium">Rubros que más se desvían del plan</h3>
          <p className="text-xs text-muted mb-3">{e.fueraDeRango} rubro{e.fueraDeRango === 1 ? "" : "s"} fuera de rango (desvío &gt; 15%)</p>
          {e.top.length === 0 ? <p className="text-sm text-faint">Sin desvíos materiales en el período.</p> : e.top.map((t) => {
            const bien = t.clase === "gasto" ? t.variacion <= 0 : t.variacion >= 0;
            return (
              <div key={t.etiqueta} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line-soft last:border-0">
                <span className="text-[13px] truncate">{t.etiqueta}</span>
                <span className={`text-[13px] font-bold tnum whitespace-nowrap ${bien ? "text-pos" : "text-neg"}`} title={fmtCOP(t.variacion)}>
                  {t.variacion >= 0 ? "+" : "−"}{fmtCont(Math.abs(t.variacion))} · {t.pctEjec?.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
        {e.proyeccion && (
          <div className="card p-5">
            <h3 className="font-medium">Proyección de cierre del año</h3>
            <p className="text-xs text-muted mb-3">al ritmo actual (real acumulado anualizado) frente al plan anual</p>
            {e.proyeccion.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line-soft last:border-0">
                <span className="text-[13px]">{r.label}</span>
                <span className="text-[13px] tnum whitespace-nowrap">
                  <b title={r.proyectado !== null ? fmtCOP(r.proyectado) : undefined}>{r.proyectado === null ? "—" : fmtM(r.proyectado)}</b>
                  <span className="text-faint"> / plan {fmtM(r.planAnual)}</span>
                  {r.pct !== null && <span className="text-muted"> · {r.pct.toFixed(0)}%</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- helpers de presupuesto / ejecución ---------- */
function AvisoInfo({ children }: { children: React.ReactNode }) {
  return <div className="card p-6 flex items-start gap-3 border-accent/25"><Info size={18} className="text-accent2 mt-0.5 shrink-0" /><p className="text-sm text-muted">{children}</p></div>;
}
function MiniKpi({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted leading-snug">{label}</div>
      <div className="text-lg font-semibold tnum mt-1" title={fmtCOP(valor)}>{fmtM(valor)}</div>
    </div>
  );
}
function KpiEjec({ label, fila }: { label: string; fila: FilaEjec | null }) {
  const col = fila?.semaforo === "bueno" ? "text-pos" : fila?.semaforo === "malo" ? "text-neg" : "text-muted";
  return (
    <div className="card p-4">
      <div className="text-xs text-muted leading-snug">{label}</div>
      <div className="text-lg font-semibold tnum mt-1" title={fila && fila.real !== null ? fmtCOP(fila.real) : undefined}>{fila && fila.real !== null ? fmtM(fila.real) : "—"}</div>
      <div className="text-[11px] mt-0.5">
        <span className={col}>{fila?.pctEjec != null ? `${fila.pctEjec.toFixed(0)}% del plan` : "—"}</span>
        <span className="text-faint"> · plan {fila ? fmtM(fila.ppto) : "—"}</span>
      </div>
    </div>
  );
}
