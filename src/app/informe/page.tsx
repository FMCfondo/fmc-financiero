/* /informe — el Informe de Junta en pantalla.
 *
 * La MISMA marcación sirve para la pantalla y para el PDF: `informe.css` trae los bloques
 * @media screen y @media print, así que lo que se ve es lo que se imprime. No puede haber
 * dos versiones que diverjan.
 *
 * La hoja está acotada bajo `.informe`, así que no toca el resto de la app; al imprimir,
 * el bloque @media print esconde la barra lateral y la cabecera.
 */
import type { Metadata } from "next";
import { ensureLoaded, resolverEtq, periodo as periodoDe, sameMonthPrevYear, fact, ytd } from "@/lib/data";
import { ING_FINANCIERO } from "@/lib/statements";
import { construirInforme } from "@/lib/informe";
import { puedeExportar } from "@/lib/informe-notas";
import { mesNombre } from "@/lib/format";
import PaginaResumen from "./PaginaResumen";
import PaginaBalance from "./PaginaBalance";
import PaginaResultados from "./PaginaResultados";
import PaginaGastos from "./PaginaGastos";
import PaginaInteranual from "./PaginaInteranual";
import PaginaPortafolio from "./PaginaPortafolio";
import BarraInforme from "./BarraInforme";
import { type EdicionNota } from "./BloqueNotas";
import type { BloqueNota } from "@/lib/informe-tipos";
import "./informe.css";

export const dynamic = "force-dynamic";

/* El nombre del archivo que propone el navegador al guardar el PDF sale del
 * <title>. Sin esto el informe de la Junta se descargaria como «FMC Financiero». */
export async function generateMetadata({
  searchParams,
}: { searchParams: Promise<{ p?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  await ensureLoaded();
  const p = periodoDe(resolverEtq(sp.p));
  return { title: `Informe de Junta ${mesNombre[p.mes].toUpperCase()} ${p.anio} - FMC S.A.S.` };
}

export default async function InformePage({
  searchParams,
}: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  await ensureLoaded();
  const etq = resolverEtq(sp.p);
  const inf = await construirInforme(etq);

  const prev = sameMonthPrevYear(etq);
  const mesIA = prev ? `${mesNombre[prev.mes]} ${prev.anio}` : "—";
  const periodo = `${mesNombre[inf.periodo.mes].toUpperCase()} ${inf.periodo.anio}`;
  const comun = { periodo, corte: inf.periodo.corte, anio: inf.periodo.anio, mesInteranual: mesIA };
  // La fila de total de la página 5 es la misma que ya calculó la página 4.
  const gAdmin = inf.resultados.filas.find((f) => f.etiqueta === "Gastos de Administración");

  /* La barrera de calidad: con una nota sin explicar o con el portafolio
     descuadrado, el informe no sale. Se evalúa sobre TODAS las notas del
     documento, no las de una página. */
  const barrera = puedeExportar([
    ...inf.resumen.notas, ...inf.balanceActivos.notas, ...inf.balancePasivos.notas,
    ...inf.resultados.notas, ...inf.gastos.notas,
  ]);

  const resultados = {
    periodo,
    corte: inf.periodo.corte,
    anio: inf.periodo.anio,
    mesNombre: mesNombre[inf.periodo.mes],
    etiquetasMeses: inf.resultados.etiquetasMeses,
    filas: inf.resultados.filas,
  };

  const gastos = {
    periodo,
    corte: inf.periodo.corte,
    mesActual: mesNombre[inf.periodo.mes],
    totalMes: gAdmin?.mes ?? 0,
    totalAcum: gAdmin?.acumulado ?? 0,
    totalPptoMes: gAdmin?.pptoMes ?? null,
    totalPptoAcum: gAdmin?.pptoAcumulado ?? null,
    totalPptoAnual: gAdmin?.pptoAnual ?? null,
  };

  /* El árbol de gastos se parte por la mitad, pero el corte baja hasta el siguiente
     rubro de primer nivel: separar un rubro de sus subcuentas sangradas dejaría
     huérfanas unas cifras que solo se entienden bajo su padre. */
  const corteGastos = (() => {
    let i = Math.ceil(inf.gastos.filas.length / 2);
    while (i < inf.gastos.filas.length && inf.gastos.filas[i].sangria) i++;
    return i;
  })();

  /* Lo que cada bloque de notas necesita para poder editarse sobre la hoja: a qué
     página pertenece, de qué período es y si ya hay un texto escrito a mano. */
  const edicion = (bloque: BloqueNota): EdicionNota =>
    ({ bloque, anio: inf.periodo.anio, mes: inf.periodo.mes, manual: inf.textos[bloque] });

  const meses = inf.resultados.etiquetasMeses;
  const rango = meses.length > 1 ? `${meses[0].toLowerCase()}–${meses[meses.length - 1].toLowerCase()}` : meses[0] ?? "";

  return (
    <>
      <BarraInforme
        periodo={periodo}
        pendientes={barrera.pendientes}
        portafolioConcilia={inf.portafolio.concilia}
      />
      <div className="informe">
        <PaginaResumen
          periodo={periodo}
          corte={inf.periodo.corte}
          rangoMeses={rango}
          tarjetas={inf.resumen.tarjetas}
          evolucion={inf.resumen.evolucion}
          notas={inf.resumen.notas}
          edicion={edicion("situacion")}
        />
        <PaginaBalance
          titulo="BALANCE GENERAL ADMINISTRATIVO · ACTIVOS"
          etiquetasMeses={inf.balanceActivos.etiquetasMeses}
          filas={inf.balanceActivos.filas}
          notas={inf.balanceActivos.notas}
          edicion={edicion("activos")}
          {...comun}
        />
        <PaginaBalance
          titulo="BALANCE GENERAL ADMINISTRATIVO · PASIVOS Y PATRIMONIO"
          etiquetasMeses={inf.balancePasivos.etiquetasMeses}
          filas={inf.balancePasivos.filas}
          notas={inf.balancePasivos.notas}
          edicion={edicion("pasivos")}
          {...comun}
        />
        <PaginaResultados vista="evolucion" {...resultados} notas={[]} />
        <PaginaResultados vista="ejecucion" {...resultados} notas={inf.resultados.notas}
          edicion={edicion("resultados")} />

        <PaginaGastos parte={1} {...gastos} filas={inf.gastos.filas.slice(0, corteGastos)}
          edicion={edicion("gastos")} />
        <PaginaGastos parte={2} {...gastos} filas={inf.gastos.filas.slice(corteGastos)}
          edicion={edicion("gastos")} />
        <PaginaInteranual
          periodo={periodo}
          corte={inf.periodo.corte}
          mesActual={`${mesNombre[inf.periodo.mes]} ${inf.periodo.anio}`}
          mesAnterior={mesIA}
          disponible={inf.interanual.disponible}
          motivo={inf.interanual.motivo}
          filas={inf.interanual.filas}
          edicion={edicion("interanual")}
        />
        <PaginaPortafolio
          periodo={periodo}
          corte={inf.periodo.corte}
          mesActual={mesNombre[inf.periodo.mes]}
          p={inf.portafolio}
          rendimientoMes={fact(etq, ING_FINANCIERO)}
          rendimientoAcum={ytd(etq, ING_FINANCIERO)}
          edicion={edicion("portafolio")}
        />
      </div>
    </>
  );
}
