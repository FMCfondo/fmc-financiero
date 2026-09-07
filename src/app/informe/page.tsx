/* /informe — el Informe de Junta en pantalla.
 *
 * La MISMA marcación sirve para la pantalla y para el PDF: `informe.css` trae los bloques
 * @media screen y @media print, así que lo que se ve es lo que se imprime. No puede haber
 * dos versiones que diverjan.
 *
 * La hoja está acotada bajo `.informe`, así que no toca el resto de la app; al imprimir,
 * el bloque @media print esconde la barra lateral y la cabecera.
 */
import { ensureLoaded, resolverEtq, sameMonthPrevYear, fact, ytd } from "@/lib/data";
import { ING_FINANCIERO } from "@/lib/statements";
import { construirInforme } from "@/lib/informe";
import { mesNombre } from "@/lib/format";
import PaginaBalance from "./PaginaBalance";
import PaginaResultados from "./PaginaResultados";
import PaginaInteranual from "./PaginaInteranual";
import PaginaPortafolio from "./PaginaPortafolio";
import "./informe.css";

export const dynamic = "force-dynamic";

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

  return (
    <div className="informe">
      <PaginaBalance
        titulo="BALANCE GENERAL ADMINISTRATIVO · ACTIVOS"
        etiquetasMeses={inf.balanceActivos.etiquetasMeses}
        filas={inf.balanceActivos.filas}
        {...comun}
      />
      <PaginaBalance
        titulo="BALANCE GENERAL ADMINISTRATIVO · PASIVOS Y PATRIMONIO"
        etiquetasMeses={inf.balancePasivos.etiquetasMeses}
        filas={inf.balancePasivos.filas}
        {...comun}
      />
      <PaginaResultados
        periodo={periodo}
        corte={inf.periodo.corte}
        anio={inf.periodo.anio}
        mesNombre={mesNombre[inf.periodo.mes]}
        etiquetasMeses={inf.resultados.etiquetasMeses}
        filas={inf.resultados.filas}
      />
      <PaginaInteranual
        periodo={periodo}
        corte={inf.periodo.corte}
        mesActual={`${mesNombre[inf.periodo.mes]} ${inf.periodo.anio}`}
        mesAnterior={mesIA}
        disponible={inf.interanual.disponible}
        motivo={inf.interanual.motivo}
        filas={inf.interanual.filas}
      />
      <PaginaPortafolio
        periodo={periodo}
        corte={inf.periodo.corte}
        mesActual={mesNombre[inf.periodo.mes]}
        p={inf.portafolio}
        rendimientoMes={fact(etq, ING_FINANCIERO)}
        rendimientoAcum={ytd(etq, ING_FINANCIERO)}
      />
    </div>
  );
}
