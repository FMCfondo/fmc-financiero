import Link from "next/link";
import { erMatrizArbol, analisisMatriz, interanualData, TAM_UNIDAD, type UnidadPeriodo } from "@/lib/statements";
import { ensureLoaded, mesesVista, periodo } from "@/lib/data";
import { indicadoresMatriz } from "@/lib/indicadores";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum, fmtCont } from "@/lib/format";
import StatementMatrix from "@/components/StatementMatrix";
import AnalisisTabs from "@/components/AnalisisTabs";
import MesesSelector from "@/components/MesesSelector";
import AnalisisMatrix from "@/components/AnalisisMatrix";
import AnioSelector from "@/components/AnioSelector";
import InteranualSelector from "@/components/InteranualSelector";
import IndicadoresTabla from "@/components/IndicadoresTabla";
import { Info } from "lucide-react";

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; meses?: string; anio?: string; contra?: string; unidad?: string; idx?: string }> }) {
  const { p, vista, meses, anio, contra, unidad, idx } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = vista || "estado";
  const nMeses = Math.min(Math.max(parseInt(meses || "4") || 4, 1), 24);
  const nAnio = anio ? parseInt(anio) : undefined;
  const vContra = contra === "mes" ? "mes" as const : "anio" as const;
  await ensureLoaded();
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
      {(current === "ejec-acum" || current === "ejec-mes") && <Pendiente />}
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
        secciones={[
          { titulo: "Ingresos", tono: "bg-pos", arbol: m.ingresos, totalLabel: "Total ingresos", totalVals: m.totalIng.vals, totalAcum: m.totalIng.acum },
          { titulo: "Gastos", tono: "bg-gold", arbol: m.gastos, totalLabel: "Total gastos", totalVals: m.totalGas.vals, totalAcum: m.totalGas.acum },
        ]}
        filasFinales={[
          { nombre: "Utilidad antes de impuestos", vals: m.utilAntes.vals, acum: m.utilAntes.acum, tipo: "sub" },
          { nombre: `(−) Impuesto de renta estimado (${fmtNum(m.tasa * 100)}%)`, vals: m.impuesto.vals, acum: m.impuesto.acum },
          { nombre: "(=) Utilidad neta", vals: m.utilNeta.vals, acum: m.utilNeta.acum, tipo: "total" },
        ]}
      />
      <p className="text-xs text-faint">
        Cada columna es el movimiento del mes; el <b>Acumulado</b> del año va en el recuadro final. El impuesto acumulado usa la
        provisión completa de <Link href={`/impuesto?p=${etq}`} className="text-accent2 hover:underline">Provisión de Impuesto</Link>.
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
      <AnalisisMatrix labels={a.labels} secciones={a.secciones} colorear={modo === "horizontal"} />
      <p className="text-xs text-muted">
        {modo === "vertical"
          ? `Cada celda es la participación de la cuenta sobre ${a.base}.`
          : `Cada celda es la variación del mes contra ${a.base}; la raya (—) indica que no existe comparativo.`}
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
                { titulo: "Gastos", tono: "bg-gold", arbol: d.cifras[1].arbol, totalLabel: "Total gastos", totalVals: d.cifras[1].totalVals },
              ]}
              filasFinales={[{ nombre: "Utilidad del período (antes de impuestos)", vals: d.utilPeriodo, tipo: "total" }]}
            />
          </Recuadro>
          <Recuadro titulo="Análisis Horizontal" sub="cada año contra el año anterior con datos" tono="bg-gold">
            <AnalisisMatrix labels={d.labels} secciones={d.horizontal} colorear />
          </Recuadro>
          <Recuadro titulo="Análisis Vertical" sub="participación dentro de su propio período" tono="bg-pos">
            <AnalisisMatrix labels={d.labels} secciones={d.vertical} />
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

function Pendiente() {
  return <div className="card p-6 flex items-start gap-3 border-accent/25"><Info size={18} className="text-accent2 mt-0.5 shrink-0" /><p className="text-sm text-muted">La ejecución presupuestal se activa al migrar el <span className="text-fg">PPTO 2026</span> a la base de datos.</p></div>;
}
