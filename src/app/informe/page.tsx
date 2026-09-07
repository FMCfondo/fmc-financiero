/* /informe — el Informe de Junta en pantalla.
 *
 * La MISMA marcación sirve para la pantalla y para el PDF: `informe.css` trae los bloques
 * @media screen y @media print, así que lo que se ve es lo que se imprime. No puede haber
 * dos versiones que diverjan.
 *
 * La hoja está acotada bajo `.informe`, así que no toca el resto de la app; al imprimir,
 * el bloque @media print esconde la barra lateral y la cabecera.
 */
import { ensureLoaded, resolverEtq, sameMonthPrevYear } from "@/lib/data";
import { construirInforme } from "@/lib/informe";
import { mesNombre } from "@/lib/format";
import PaginaBalance from "./PaginaBalance";
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
    </div>
  );
}
