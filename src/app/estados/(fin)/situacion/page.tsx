import Link from "next/link";
import { esfMatrizArbol, analisisMatriz, interanualData, provisionRenta, TAM_UNIDAD, type UnidadPeriodo } from "@/lib/statements";
import { ensureLoaded, mesesVista, periodo, resolverEtq } from "@/lib/data";
import { indicadoresMatriz } from "@/lib/indicadores";
import { etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import StatementMatrix from "@/components/StatementMatrix";
import AnalisisTabs from "@/components/AnalisisTabs";
import MesesSelector from "@/components/MesesSelector";
import AnalisisMatrix from "@/components/AnalisisMatrix";
import AnioSelector from "@/components/AnioSelector";
import InteranualSelector from "@/components/InteranualSelector";
import IndicadoresTabla from "@/components/IndicadoresTabla";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default async function SituacionPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; meses?: string; anio?: string; contra?: string; unidad?: string; idx?: string }> }) {
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
        <p className="text-sm text-muted">{etqNombre(etq)} · cifras en pesos colombianos</p>
        <AnalisisTabs current={current} ejec={false} />
      </div>
      {current === "estado" && <VistaEstado etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "vertical" && <VistaAnalisis modo="vertical" etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "horizontal" && <VistaAnalisis modo="horizontal" etq={etq} nMeses={nMeses} anio={nAnio} contra={vContra} />}
      {current === "interanual" && <VistaInteranual unidad={vUnidad} idx={vIdx} />}
    </div>
  );
}

/* ---------- Estado: saldos por mes, de izquierda a derecha ----------
   Sin columna de acumulado: cada saldo del balance YA es acumulado por naturaleza. */
function VistaEstado({ etq, nMeses, anio }: { etq: string; nMeses: number; anio?: number }) {
  const meses = mesesVista(etq, anio, nMeses);
  if (!meses.length) return <div className="card p-6 text-sm text-muted">No hay datos para ese año.</div>;
  const m = esfMatrizArbol(meses);
  const ult = m.labels.length - 1;
  const cuadra = Math.abs(m.descuadre[ult]) < 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        <AnioSelector current={anio} />
        {!anio && <MesesSelector current={nMeses} />}
        <span className={`flex items-center gap-1.5 text-xs ${cuadra ? "text-pos" : "text-neg"}`}>
          {cuadra ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {cuadra ? "Ecuación contable: cuadra (A = P + K) en todos los meses" : `Descuadre: ${fmtNum(m.descuadre[ult])}`}
        </span>
      </div>
      <StatementMatrix
        labels={m.labels}
        conAcum={false}
        persistKey="esf-estado"
        secciones={[
          { titulo: "Activo", tono: "bg-royal", arbol: m.activo, totalLabel: "Total activos", totalVals: m.totalActivo },
          {
            titulo: "Pasivo", tono: "bg-gold", arbol: m.pasivo,
            extra: [{ nombre: "Provisión impuesto de renta (estimada)", vals: m.provision }],
            totalLabel: "Total pasivos", totalVals: m.totalPasivo,
          },
          {
            titulo: "Patrimonio", tono: "bg-pos", arbol: m.patrimonio,
            extra: [{ nombre: "Utilidad del ejercicio (estimada)", vals: m.utilidad }],
            totalLabel: "Total patrimonio", totalVals: m.totalPatrim,
          },
        ]}
      />
      <p className="text-xs text-faint">
        Cada columna es el saldo al cierre de ese mes (ya acumulado por naturaleza). La provisión se ajusta en{" "}
        <Link href={`/impuesto?p=${etq}`} className="text-accent2 hover:underline">Provisión de Impuesto</Link>.
      </p>
    </div>
  );
}

/* ---------- Análisis Vertical / Horizontal: misma vista de árbol × meses ---------- */
function VistaAnalisis({ modo, etq, nMeses, anio, contra = "anio" }: { modo: "vertical" | "horizontal"; etq: string; nMeses: number; anio?: number; contra?: "anio" | "mes" }) {
  const meses = mesesVista(etq, anio, nMeses);
  if (!meses.length) return <div className="card p-6 text-sm text-muted">No hay datos para ese año.</div>;
  const a = analisisMatriz("esf", modo, meses, contra);
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
      <AnalisisMatrix labels={a.labels} secciones={a.secciones} colorear={modo === "horizontal"} persistKey={`esf-${modo}`} />
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
   derecha, más los Indicadores al cierre. Saldos al CIERRE del período. */
function VistaInteranual({ unidad, idx }: { unidad: UnidadPeriodo; idx: number }) {
  const d = interanualData("esf", unidad, idx);
  const cats = indicadoresMatriz(d.periodosCierre);
  // Provisión y utilidad estimadas al cierre de cada columna, para que A = P + K cuadre.
  const prov = d.finEtqs.map((e) => (e ? provisionRenta(e).provision : null));
  const util = d.finEtqs.map((e) => (e ? provisionRenta(e).neto : null));
  const suma = (a: (number | null)[], b: (number | null)[]) => a.map((v, i) => (v === null || b[i] === null ? null : v + (b[i] as number)));
  return (
    <div className="space-y-4">
      <InteranualSelector unidad={unidad} idx={idx} />

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 w-max items-start">
          <Recuadro titulo="Cifras al cierre del período" sub="saldo al último mes de cada período" tono="bg-royal">
            <StatementMatrix
              labels={d.labels}
              conAcum={false}
              secciones={[
                { titulo: "Activo", tono: "bg-royal", arbol: d.cifras[0].arbol, totalLabel: "Total activos", totalVals: d.cifras[0].totalVals },
                {
                  titulo: "Pasivo", tono: "bg-gold", arbol: d.cifras[1].arbol,
                  extra: [{ nombre: "Provisión impuesto de renta (estimada)", vals: prov }],
                  totalLabel: "Total pasivos", totalVals: suma(d.cifras[1].totalVals, prov),
                },
                {
                  titulo: "Patrimonio", tono: "bg-pos", arbol: d.cifras[2].arbol,
                  extra: [{ nombre: "Utilidad del ejercicio (estimada)", vals: util }],
                  totalLabel: "Total patrimonio", totalVals: suma(d.cifras[2].totalVals, util),
                },
              ]}
            />
          </Recuadro>
          <Recuadro titulo="Análisis Horizontal" sub="cada año contra el año anterior con datos" tono="bg-gold">
            <AnalisisMatrix labels={d.labels} secciones={d.horizontal} colorear />
          </Recuadro>
          <Recuadro titulo="Análisis Vertical" sub="participación sobre el activo de su propio período" tono="bg-pos">
            <AnalisisMatrix labels={d.labels} secciones={d.vertical} />
          </Recuadro>
        </div>
      </div>

      <Recuadro titulo="Indicadores al cierre del período" sub="pasa el mouse por un indicador para ver qué es y cómo leerlo">
        <IndicadoresTabla labels={d.labelsCierre} cats={cats} conAcum={false} />
      </Recuadro>

      <p className="text-xs text-muted">
        Columnas: el mismo período en cada año. Los saldos del balance se toman al CIERRE del período elegido.
        {d.algunParcial && <> Los años con <b>*</b> tienen el período incompleto; la raya (—) indica que no hay datos.</>}
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
