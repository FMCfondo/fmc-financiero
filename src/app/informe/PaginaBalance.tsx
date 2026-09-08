/* Páginas 2 y 3 del informe: el balance en ventana de cuatro meses más la comparación
 * contra el mismo mes del año anterior. Componente de PRESENTACIÓN: no calcula nada,
 * recibe el objeto ya armado por informe.ts.
 *
 * Convenciones contables del informe (requisito profesional, no gusto): negativos entre
 * paréntesis, cero como raya, regla simple sobre subtotal y doble bajo el total. Las trae
 * `fmtCont`. Unidad: PESOS — así lo declara la cabecera de la página. */
import { fmtCont } from "@/lib/format";
import type { FilaBalance, Nota } from "@/lib/informe-tipos";
import BloqueNotas from "./BloqueNotas";

type Props = {
  titulo: string;
  periodo: string;
  corte: string;
  anio: number;
  etiquetasMeses: string[];
  filas: FilaBalance[];
  mesInteranual: string;
  notas: Nota[];
};

const pct = (v: number | null) => {
  if (v === null) return "—";
  const r = Math.round(v);
  return `${r > 0 ? "+" : ""}${r.toLocaleString("es-CO")}%`;
};

export default function PaginaBalance({
  titulo, periodo, corte, anio, etiquetasMeses, filas, mesInteranual, notas,
}: Props) {
  const ultimo = etiquetasMeses.length - 1;
  return (
    <div className="page">
      <div className="band">
        <h1>{titulo}</h1>
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
            <th colSpan={etiquetasMeses.length}>EJECUTADO {anio}</th>
            <th className="gap" />
            <th colSpan={3}>VARIACIÓN INTERANUAL</th>
          </tr>
          <tr className="cols">
            <th className="l">Concepto</th>
            {etiquetasMeses.map((m, i) => (
              <th key={m} className={i === ultimo ? "hoy" : undefined}>{m}</th>
            ))}
            <th className="gap" />
            <th>{mesInteranual}</th>
            <th>Var. %</th>
            <th>Var. $</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const signo = f.varIAPesos === 0 ? undefined : f.varIAPesos > 0 ? "pos" : "neg";
            return (
              <tr key={f.etiqueta} className={f.nivel}>
                <td className={`l${f.sangria ? " s1" : ""}`}>{f.etiqueta}</td>
                {f.meses.map((v, i) => (
                  <td key={i} className={i === ultimo ? "hoy" : undefined}>{fmtCont(v)}</td>
                ))}
                <td className="gap" />
                <td className="ref">{fmtCont(f.interanual)}</td>
                <td className={`pct${signo ? ` ${signo}` : ""}`}>{pct(f.varIAPct)}</td>
                <td className={signo}>{fmtCont(f.varIAPesos)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <BloqueNotas notas={notas} />

      <div className="pie">
        <span>Corte: {corte}</span>
        <span>Comparativo contra {mesInteranual}</span>
      </div>
    </div>
  );
}
