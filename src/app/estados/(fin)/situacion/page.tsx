import { accesoA } from "@/lib/permisos";
import Link from "next/link";
import { esfMatrizArbol, analisisMatriz, interanualData, provisionRenta, TAM_UNIDAD, type UnidadPeriodo } from "@/lib/statements";
import { ensureLoaded, mesesVista, periodo, resolverEtq } from "@/lib/data";
import { indicadoresMatriz } from "@/lib/indicadores";
import { etqNombre, rangoNombre, nombrePeriodoInteranual } from "@/lib/periodos";
import { fmtNum } from "@/lib/format";
import StatementMatrix, { CabeceraDocumento } from "@/components/StatementMatrix";
import AnalisisTabs from "@/components/AnalisisTabs";
import MesesSelector from "@/components/MesesSelector";
import AnalisisMatrix from "@/components/AnalisisMatrix";
import AnioSelector from "@/components/AnioSelector";
import InteranualSelector from "@/components/InteranualSelector";
import IndicadoresTabla from "@/components/IndicadoresTabla";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default async function SituacionPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; meses?: string; anio?: string; contra?: string; unidad?: string; idx?: string }> }) {
  await accesoA("/estados/situacion");
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
  /* Se comprueban TODOS los meses a la vista, no solo el último: antes el rótulo
     afirmaba "en todos los meses" mirando uno solo, y con feb y mar de 2025
     descuadrados por el dato de origen decía que todo estaba bien. */
  const descuadrados = m.labels
    .map((etiqueta, i) => ({ etiqueta, valor: m.descuadre[i] }))
    .filter((x) => Math.abs(x.valor) >= 1);
  const cuadra = descuadrados.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        <AnioSelector current={anio} />
        {!anio && <MesesSelector current={nMeses} />}
        <span className={`flex items-center gap-1.5 text-xs ${cuadra ? "text-pos" : "text-neg"}`}>
          {cuadra ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {cuadra
            ? "Ecuación contable: cuadra (A = P + K) en todos los meses"
            : `No cuadra en ${descuadrados.map((x) => x.etiqueta).join(", ")} — diferencia de ${fmtNum(descuadrados[0].valor)}`}
        </span>
      </div>
      <StatementMatrix
        labels={m.labels}
        conAcum={false}
        resaltar={meses.findIndex((x) => x.etiqueta === etq)}
        encabezado={{ titulo: "Estado de Situación Financiera", periodo: rangoNombre(meses.map((x) => x.etiqueta)), unidad: "Saldos al cierre de cada mes · pesos colombianos" }}
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
        labels={a.labels} secciones={a.secciones} colorear={modo === "horizontal"}
        resaltar={meses.findIndex((x) => x.etiqueta === etq)}
        encabezado={{
          titulo: `Estado de Situación Financiera · ${modo === "vertical" ? "Análisis vertical" : "Análisis horizontal"}`,
          periodo: rangoNombre(meses.map((x) => x.etiqueta)),
          unidad: modo === "vertical" ? `Participación de cada cuenta sobre ${a.base}` : `Variación de cada mes contra ${a.base}`,
        }}
      />
      <p className="stmt-nota">
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
  const nombre = nombrePeriodoInteranual(unidad, idx);
  const anios = d.labels.length > 1 ? `${d.labels[0]} – ${d.labels[d.labels.length - 1]}` : d.labels[0] ?? "";
  const periodoTxt = `${nombre} · ${anios}`.replace(/\*/g, "");
  return (
    <div className="space-y-5">
      <InteranualSelector unidad={unidad} idx={idx} />

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 w-max items-start">
          <div className="shrink-0 max-w-full">
            <StatementMatrix
              labels={d.labels}
              conAcum={false}
              encabezado={{ titulo: "Estado de Situación Financiera · Cifras al cierre", periodo: periodoTxt, unidad: "Saldo al último mes de cada período · pesos colombianos" }}
              secciones={[
                { titulo: "Activo", arbol: d.cifras[0].arbol, totalLabel: "Total activos", totalVals: d.cifras[0].totalVals },
                {
                  titulo: "Pasivo", arbol: d.cifras[1].arbol,
                  extra: [{ nombre: "Provisión impuesto de renta (estimada)", vals: prov }],
                  totalLabel: "Total pasivos", totalVals: suma(d.cifras[1].totalVals, prov),
                },
                {
                  titulo: "Patrimonio", arbol: d.cifras[2].arbol,
                  extra: [{ nombre: "Utilidad del ejercicio (estimada)", vals: util }],
                  totalLabel: "Total patrimonio", totalVals: suma(d.cifras[2].totalVals, util),
                },
              ]}
            />
          </div>
          <div className="shrink-0 max-w-full">
            <AnalisisMatrix labels={d.labels} secciones={d.horizontal} colorear
              encabezado={{ titulo: "Estado de Situación Financiera · Análisis horizontal", periodo: periodoTxt, unidad: "Cada año contra el año anterior con datos" }} />
          </div>
          <div className="shrink-0 max-w-full">
            <AnalisisMatrix labels={d.labels} secciones={d.vertical}
              encabezado={{ titulo: "Estado de Situación Financiera · Análisis vertical", periodo: periodoTxt, unidad: "Participación sobre el activo de su propio período" }} />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <CabeceraDocumento titulo="Indicadores al cierre del período" periodo={periodoTxt} unidad="Pasa el mouse por un indicador para ver qué es y cómo leerlo" />
        <IndicadoresTabla labels={d.labelsCierre} cats={cats} conAcum={false} />
      </div>

      <p className="stmt-nota">
        Columnas: el mismo período en cada año. Los saldos del balance se toman al CIERRE del período elegido.
        {d.algunParcial && <> Los años con <b>*</b> tienen el período incompleto; la raya (—) indica que no hay datos.</>}
      </p>
    </div>
  );
}
