/* Página 6: el mes contra el mismo mes del año anterior. Las mismas líneas del estado
 * de resultados, pero en PESOS — aquí caben, porque son dos columnas y no siete.
 * Componente de presentación. */
import { fmtCont } from "@/lib/format";
import type { FilaInteranual } from "@/lib/informe-tipos";
import BloqueNotas from "./BloqueNotas";

type Props = {
  periodo: string; corte: string; mesActual: string; mesAnterior: string;
  disponible: boolean; motivo?: string; filas: FilaInteranual[];
  comentario?: string;
};

const pct = (v: number | null) => {
  if (v === null) return "—";
  const r = Math.round(v);
  return `${r > 0 ? "+" : ""}${r.toLocaleString("es-CO")}%`;
};

export default function PaginaInteranual({
  periodo, corte, mesActual, mesAnterior, disponible, motivo, filas, comentario,
}: Props) {
  return (
    <div className="page">
      <div className="band">
        <h1>COMPARATIVO FRENTE AL MISMO MES DEL AÑO ANTERIOR</h1>
        <span className="periodo">{periodo}</span>
      </div>
      <div className="meta">
        <span>{mesActual} frente a {mesAnterior}</span>
        <span>Cifras en pesos colombianos</span>
      </div>

      {!disponible ? (
        <p className="conc-nota">{motivo}</p>
      ) : (
        <table>
          <thead>
            <tr className="grupos">
              <th className="l" />
              <th colSpan={2}>RESULTADO DEL MES</th>
              <th className="gap" />
              <th colSpan={2}>VARIACIÓN INTERANUAL</th>
            </tr>
            <tr className="cols">
              <th className="l">Concepto</th>
              <th>{mesAnterior}</th>
              <th className="hoy">{mesActual}</th>
              <th className="gap" />
              <th>Var. %</th>
              <th>Var. $</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              /* El color solo cuando el signo significa algo, y en gastos y provisiones
                 la lectura se invierte: crecer es malo. */
              const sube = f.varPesos > 0;
              const tono = f.varPesos === 0 ? undefined
                : (f.esGasto ? !sube : sube) ? "pos" : "neg";
              return (
                <tr key={f.etiqueta} className={f.nivel}>
                  <td className="l"><span className="signo">{f.signo}</span>{f.etiqueta}</td>
                  <td className="ref">{fmtCont(f.anioAnterior)}</td>
                  <td className="hoy">{fmtCont(f.anioActual)}</td>
                  <td className="gap" />
                  <td className={`pct${tono ? ` ${tono}` : ""}`}>{pct(f.varPct)}</td>
                  <td className={tono}>{fmtCont(f.varPesos)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <BloqueNotas notas={[]} comentario={comentario} />

      <div className="pie">
        <span>Corte: {corte}</span>
        <span>En gastos y provisiones, crecer frente al año anterior no es una mejora</span>
      </div>
    </div>
  );
}
