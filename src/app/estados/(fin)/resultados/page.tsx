import Link from "next/link";
import { redirect } from "next/navigation";
import { erMatrizArbol, analisisMatriz, interanualData, TAM_UNIDAD, type UnidadPeriodo } from "@/lib/statements";
import { ensureLoaded, mesesVista, periodo, periodos, resolverEtq } from "@/lib/data";
import { obtenerSesion } from "@/lib/auth";
import { accesoA } from "@/lib/permisos";
import { indicadoresMatriz } from "@/lib/indicadores";
import { ejecucionPresupuestal } from "@/lib/informe";
import { etqNombre, rangoNombre, nombrePeriodoInteranual } from "@/lib/periodos";
import { fmtNum, fmtCont } from "@/lib/format";
import StatementMatrix, { CabeceraDocumento } from "@/components/StatementMatrix";
import AnalisisTabs from "@/components/AnalisisTabs";
import MesesSelector from "@/components/MesesSelector";
import AnalisisMatrix from "@/components/AnalisisMatrix";
import AnioSelector from "@/components/AnioSelector";
import InteranualSelector from "@/components/InteranualSelector";
import IndicadoresTabla from "@/components/IndicadoresTabla";
import EjecucionInforme from "@/components/EjecucionInforme";
import StmtScroll from "@/components/StmtScroll";
import { Info, SlidersHorizontal } from "lucide-react";

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; meses?: string; anio?: string; contra?: string; unidad?: string; idx?: string }> }) {
  await accesoA("/estados/resultados");
  const { p, vista, meses, anio, contra, unidad, idx } = await searchParams;
  /* Direcciones viejas. La ejecución jerárquica se reemplazó por la hoja del informe, y
     el presupuesto con su mapeo viven en su módulo: quien llegue con la ruta antigua
     (un favorito, un enlace guardado) aterriza donde está ahora. */
  if (vista === "ejec-acum" || vista === "ejec-mes") redirect(`/estados/resultados?vista=ejecucion${p ? `&p=${p}` : ""}`);
  if (vista === "presupuesto" || vista === "mapeo") redirect(`/presupuesto?v=${vista === "mapeo" ? "mapeo" : "plan"}${anio ? `&anio=${anio}` : ""}`);
  const current = vista || "estado";
  const esAdmin = (await obtenerSesion())?.usuario.rol === "admin";
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
      {current === "ejecucion" && <VistaEjecucion etq={etq} esAdmin={esAdmin} />}
      {current === "interanual" && <VistaInteranual unidad={vUnidad} idx={vIdx} />}
      {current === "vertical" && <VistaAnalisis modo="vertical" etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "horizontal" && <VistaAnalisis modo="horizontal" etq={etq} nMeses={nMeses} anio={nAnio} contra={vContra} />}
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
        resaltar={meses.findIndex((x) => x.etiqueta === etq)}
        encabezado={{ titulo: "Estado de Resultados", periodo: rangoNombre(meses.map((x) => x.etiqueta)), unidad: "Movimiento de cada mes · acumulado del año · pesos colombianos" }}
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
      <p className="stmt-nota">
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
          <span className="flex items-center">
            <span className="seg-label">Comparar contra</span>
            <span className="seg">
              <Link href="?vista=horizontal" className={contra === "anio" ? "on" : ""}>Mismo mes, año anterior</Link>
              <Link href="?vista=horizontal&contra=mes" className={contra === "mes" ? "on" : ""}>Mes anterior</Link>
            </span>
          </span>
        )}
      </div>
      <AnalisisMatrix
        labels={a.labels} secciones={a.secciones} filasFinales={a.filasFinales} colorear={modo === "horizontal"}
        resaltar={meses.findIndex((x) => x.etiqueta === etq)}
        encabezado={{
          titulo: `Estado de Resultados · ${modo === "vertical" ? "Análisis vertical" : "Análisis horizontal"}`,
          periodo: rangoNombre(meses.map((x) => x.etiqueta)),
          unidad: modo === "vertical" ? `Participación de cada cuenta sobre ${a.base}` : `Variación de cada mes contra ${a.base}`,
        }}
      />
      <p className="stmt-nota">
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
  const nombre = nombrePeriodoInteranual(unidad, idx);
  const anios = d.labels.length > 1 ? `${d.labels[0]} – ${d.labels[d.labels.length - 1]}` : d.labels[0] ?? "";
  const periodoTxt = `${nombre} · ${anios}`.replace(/\*/g, "");
  return (
    <div className="space-y-5">
      <InteranualSelector unidad={unidad} idx={idx} />

      {/* Los tres documentos, deslizando a la derecha */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 w-max items-start">
          <div className="shrink-0 max-w-full">
            <StatementMatrix
              labels={d.labels}
              conAcum={false}
              encabezado={{ titulo: "Estado de Resultados · Cifras del período", periodo: periodoTxt, unidad: "Cada columna suma los meses del período · pesos colombianos" }}
              secciones={[
                { titulo: "Ingresos", arbol: d.cifras[0].arbol, totalLabel: "Total ingresos", totalVals: d.cifras[0].totalVals },
                { titulo: "Gastos (sin dep. ni amort.)", arbol: d.cifras[1].arbol, totalLabel: "Total gastos operativos", totalVals: d.cifras[1].totalVals },
              ]}
              filasFinales={d.finalesCifras}
            />
          </div>
          <div className="shrink-0 max-w-full">
            <AnalisisMatrix labels={d.labels} secciones={d.horizontal} filasFinales={d.finalesHorizontal} colorear
              encabezado={{ titulo: "Estado de Resultados · Análisis horizontal", periodo: periodoTxt, unidad: "Cada año contra el año anterior con datos" }} />
          </div>
          <div className="shrink-0 max-w-full">
            <AnalisisMatrix labels={d.labels} secciones={d.vertical} filasFinales={d.finalesVertical}
              encabezado={{ titulo: "Estado de Resultados · Análisis vertical", periodo: periodoTxt, unidad: "Participación dentro de su propio período" }} />
          </div>
        </div>
      </div>

      {/* Resumen del período: los dos motores, año contra año */}
      <div className="card overflow-hidden">
        <CabeceraDocumento titulo="Resumen del período" periodo={periodoTxt} unidad="Los dos motores del resultado, año contra año · pesos colombianos" />
        <StmtScroll>
          <table>
            <thead>
              <tr>
                <th className="col1">Concepto</th>
                {d.labels.map((l) => <th key={l} className="num">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.resumen.map((r) => {
                const total = r.nombre.startsWith("(=)");
                return (
                  <tr key={r.nombre} className={total ? "total" : "row"}>
                    <td className="col1"><span className="etq">{r.nombre}</span></td>
                    {r.vals.map((v, i) => (
                      <td key={i} className="num">
                        <span className={total && v !== null ? "rule-total" : ""}>{v === null ? "—" : fmtCont(v, total)}</span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </StmtScroll>
      </div>

      <div className="card overflow-hidden">
        <CabeceraDocumento titulo="Indicadores al cierre del período" periodo={periodoTxt} unidad="Pasa el mouse por un indicador para ver qué es y cómo leerlo" />
        <IndicadoresTabla labels={d.labelsCierre} cats={cats} conAcum={false} />
      </div>

      <p className="stmt-nota">
        Columnas: el mismo período en cada año de funcionamiento.
        {d.algunParcial && <> Los años con <b>*</b> tienen el período incompleto (aún no existen todos sus meses); la raya (—) indica que no hay datos.</>}
      </p>
    </div>
  );
}

/* ---------- Ejecución presupuestal: LA HOJA DEL INFORME DE JUNTA, en pantalla ----------
   Las mismas filas y el mismo ensamblador que imprime el informe (páginas 5 a 7): el
   estado de resultados contra las tres metas y, debajo, el detalle de gastos de
   administración. Decisión del usuario (2026-09-16): la ejecución que ve la Junta en
   el papel es la que se ve aquí, no otra. */
function VistaEjecucion({ etq, esAdmin }: { etq: string; esAdmin: boolean }) {
  const e = ejecucionPresupuestal(etq);
  const delAnio = periodos.filter((q) => q.anio === e.anio && q.mes <= e.mes).map((q) => q.etiqueta);
  const periodoTxt = rangoNombre(delAnio);
  if (!e.hayPresupuesto) {
    return (
      <AvisoInfo>
        El presupuesto de {e.anio} aún no está cargado, así que no hay metas contra las que medir el año.
        {esAdmin && <> Se carga en <Link href="/presupuesto?v=cargar" className="text-accent2 hover:underline">Presupuesto</Link>.</>}
      </AvisoInfo>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">La misma hoja del Informe de Junta: el real frente a las tres metas del presupuesto · pesos colombianos</p>
        {esAdmin && (
          <Link href={`/presupuesto?v=mapeo&anio=${e.anio}`} className="text-xs text-accent2 hover:underline inline-flex items-center gap-1"><SlidersHorizontal size={12} /> Editar mapeo de cuentas</Link>
        )}
      </div>
      <EjecucionInforme
        titulo="Estado de Resultados · Ejecución presupuestal"
        periodo={periodoTxt}
        unidad="El mes y el acumulado frente a las tres metas · pesos colombianos"
        mesNombre={e.mesNombre}
        filas={e.resultados}
      />
      <EjecucionInforme
        titulo="Detalle de gastos de administración · Ejecución presupuestal"
        periodo={periodoTxt}
        unidad="Los rubros del presupuesto de la Junta · pesos colombianos"
        mesNombre={e.mesNombre}
        filas={e.gastos}
        encabezaCon={e.totalGastos}
        nota="Una subcuenta sin cuenta contable asociada imprime raya en el real, nunca un cero; «Otros» recoge lo que el rubro tiene y sus subcuentas no desglosan."
      />
    </div>
  );
}

/* ---------- helpers ---------- */
function AvisoInfo({ children }: { children: React.ReactNode }) {
  return <div className="card p-6 flex items-start gap-3 border-accent/25"><Info size={18} className="text-accent2 mt-0.5 shrink-0" /><p className="text-sm text-muted">{children}</p></div>;
}
