/* Página 5: el detalle de gastos de administración.
 *
 * Mismas tres ejecuciones que la página 4, pero en PESOS: aquí caben porque el ejecutado
 * son dos columnas —mes y acumulado— y no siete. Encabeza la fila del total, y debajo los
 * rubros con sus subcuentas sangradas.
 *
 * Una subcuenta sin cuenta PUC mapeada imprime RAYA en el real, nunca un cero: el
 * presupuesto la tiene desglosada y la contabilidad no, y decir "0" sería afirmar que no
 * hubo gasto. Componente de presentación. */
import { fmtCont } from "@/lib/format";
import type { FilaResultados } from "@/lib/informe-tipos";

type Props = {
  periodo: string; corte: string; mesActual: string;
  totalMes: number; totalAcum: number;
  totalPptoMes: number | null; totalPptoAcum: number | null; totalPptoAnual: number | null;
  filas: FilaResultados[];
};

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v).toLocaleString("es-CO")}%`);
/** Verde si se gastó menos de lo previsto; rojo si se pasó. Sin meta, sin color. */
const tono = (v: number | null) => (v === null ? undefined : v <= 100 ? "pos" : "neg");

export default function PaginaGastos({
  periodo, corte, mesActual, totalMes, totalAcum,
  totalPptoMes, totalPptoAcum, totalPptoAnual, filas,
}: Props) {
  const m = mesActual.toLowerCase();
  const bloques = [
    { k: "mes", clase: "cmes", th: "gmes", t: "EJECUCIÓN DEL MES", d: `${m} vs. presupuesto de ${m}` },
    { k: "acum", clase: "cacum", th: "gacum", t: "EJECUCIÓN ACUMULADA", d: `enero–${m} vs. presupuesto del mismo período` },
    { k: "anio", clase: "canio", th: "ganio", t: "EJECUCIÓN DEL AÑO", d: `enero–${m} vs. presupuesto anual completo` },
  ];
  const cel = (f: FilaResultados) => [
    { meta: f.pptoMes, e: f.ejecMesPct, c: "cmes" },
    { meta: f.pptoAcumulado, e: f.ejecAcumuladaPct, c: "cacum" },
    { meta: f.pptoAnual, e: f.ejecAnualPct, c: "canio" },
  ];
  const sinMapear = (f: FilaResultados) => f.signo === "—";

  return (
    <div className="page densa">
      <div className="band">
        <h1>DETALLE DE GASTOS DE ADMINISTRACIÓN</h1>
        <span className="periodo">{periodo}</span>
      </div>
      <div className="meta">
        <span>FMC S.A.S. · Fondo Mutuo de Cobertura</span>
        <span>Cifras en pesos colombianos</span>
      </div>

      <table>
        <thead>
          <tr className="grupos">
            <th className="l" />
            <th colSpan={2}>EJECUTADO</th>
            {bloques.map((b) => (
              <Grupo key={b.k} th={b.th} t={b.t} d={b.d} />
            ))}
          </tr>
          <tr className="cols">
            <th className="l">Concepto</th>
            <th className="hoy">{mesActual}</th>
            <th>Acumulado</th>
            {bloques.map((b) => (
              <Cabecera key={b.k} clase={b.th} />
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="sec">
            <td className="l">Gastos de Administración</td>
            <td className="hoy">{fmtCont(totalMes)}</td>
            <td>{fmtCont(totalAcum)}</td>
            {[{ meta: totalPptoMes, e: totalPptoMes ? (totalMes / totalPptoMes) * 100 : null, c: "cmes" },
              { meta: totalPptoAcum, e: totalPptoAcum ? (totalAcum / totalPptoAcum) * 100 : null, c: "cacum" },
              { meta: totalPptoAnual, e: totalPptoAnual ? (totalAcum / totalPptoAnual) * 100 : null, c: "canio" },
            ].map((x, i) => (
              <Par key={i} clase={x.c} meta={x.meta === null ? "—" : fmtCont(x.meta)}
                pct={pct(x.e)} tono={tono(x.e)} />
            ))}
          </tr>
          {filas.map((f) => (
            <tr key={f.etiqueta} className="det">
              <td className={`l${f.sangria ? " s1" : ""}`}>{f.etiqueta}</td>
              <td className="hoy">{sinMapear(f) ? "—" : fmtCont(f.mes)}</td>
              <td>{sinMapear(f) ? "—" : fmtCont(f.acumulado)}</td>
              {cel(f).map((x, i) => (
                <Par key={i} clase={x.c} meta={x.meta === null ? "—" : fmtCont(x.meta)}
                  pct={pct(x.e)} tono={tono(x.e)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="leyenda">
        {bloques.map((b) => (
          <span key={b.k}><i className={`lchip ${b.clase}`} />{b.t.replace("EJECUCIÓN ", "")}: {b.d}</span>
        ))}
      </div>
      <div className="pie">
        <span>Corte: {corte}</span>
        <span>Una raya en el ejecutado significa que el presupuesto desglosa lo que la contabilidad no</span>
      </div>
    </div>
  );
}

function Grupo({ th, t, d }: { th: string; t: string; d: string }) {
  return (<><th className="gap" /><th className={th} colSpan={2}>
    <span className="gtitulo">{t}</span><span className="gdef">{d}</span>
  </th></>);
}
function Cabecera({ clase }: { clase: string }) {
  return (<><th className="gap" /><th className={clase}>Ppto.</th><th className={clase}>% ejec.</th></>);
}
function Par({ clase, meta, pct, tono }: { clase: string; meta: string; pct: string; tono?: string }) {
  return (<><td className="gap" /><td className={clase}>{meta}</td>
    <td className={`${clase} pct${tono ? ` ${tono}` : ""}`}>{pct}</td></>);
}
