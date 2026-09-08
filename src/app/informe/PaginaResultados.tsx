/* Página 4 del informe: el estado de resultados con LAS TRES EJECUCIONES.
 *
 * Son tres medidas distintas y no se mezclan nunca en la misma columna. Cada bloque
 * lleva su propio sombreado (--g1/--g2/--g3), su definición escrita bajo el título y
 * una columna en blanco que lo separa del siguiente. Al pie, la leyenda que las explica
 * en lenguaje llano — porque tres porcentajes distintos en la misma fila confunden si
 * no se dice cuál es cuál.
 *
 * Unidad: MILLONES. Con siete meses más seis columnas de ejecución los pesos no caben,
 * y la cabecera lo declara. Componente de presentación: no calcula nada. */
import { fmtContMill } from "@/lib/format";
import type { FilaResultados, Nota } from "@/lib/informe-tipos";
import BloqueNotas from "./BloqueNotas";

type Props = {
  periodo: string; corte: string; anio: number; mesNombre: string;
  etiquetasMeses: string[]; filas: FilaResultados[]; notas: Nota[];
};

const M = fmtContMill;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v).toLocaleString("es-CO")}%`);

/** Verde cuando supera la meta; rojo cuando no. En gastos y provisiones la lectura se
 *  invierte: gastar de más es malo. Sin meta no hay color. */
const tono = (v: number | null, esGasto?: boolean) => {
  if (v === null) return undefined;
  const bien = esGasto ? v <= 100 : v >= 100;
  return bien ? "pos" : "neg";
};

export default function PaginaResultados({
  periodo, corte, anio, mesNombre, etiquetasMeses, filas, notas,
}: Props) {
  const n = etiquetasMeses.length;
  const bloques = [
    { k: "mes" as const, clase: "cmes", th: "gmes", titulo: "EJECUCIÓN DEL MES",
      def: `${mesNombre.toLowerCase()} vs. presupuesto de ${mesNombre.toLowerCase()}`,
      ppto: (f: FilaResultados) => f.pptoMes, ej: (f: FilaResultados) => f.ejecMesPct },
    { k: "acum" as const, clase: "cacum", th: "gacum", titulo: "EJECUCIÓN ACUMULADA",
      def: `enero–${mesNombre.toLowerCase()} vs. presupuesto del mismo período`,
      ppto: (f: FilaResultados) => f.pptoAcumulado, ej: (f: FilaResultados) => f.ejecAcumuladaPct },
    { k: "anio" as const, clase: "canio", th: "ganio", titulo: "EJECUCIÓN DEL AÑO",
      def: `enero–${mesNombre.toLowerCase()} vs. presupuesto anual completo`,
      ppto: (f: FilaResultados) => f.pptoAnual, ej: (f: FilaResultados) => f.ejecAnualPct },
  ];

  return (
    <div className="page densa">
      <div className="band">
        <h1>ESTADO DE RESULTADOS ADMINISTRATIVO</h1>
        <span className="periodo">{periodo}</span>
      </div>
      <div className="meta">
        <span>FMC S.A.S. · Fondo Mutuo de Cobertura</span>
        <span>Cifras en millones de pesos</span>
      </div>

      <table>
        <thead>
          <tr className="grupos">
            <th className="l" />
            <th colSpan={n + 1}>EJECUTADO {anio}</th>
            {bloques.map((b) => (
              <Fragmento key={b.k} th={b.th} titulo={b.titulo} def={b.def} />
            ))}
          </tr>
          <tr className="cols">
            <th className="l">Concepto</th>
            {etiquetasMeses.map((m, i) => (
              <th key={m} className={i === n - 1 ? "hoy" : undefined}>{m}</th>
            ))}
            <th>Acum.</th>
            {bloques.map((b) => (
              <Cabeceras key={b.k} clase={b.th} />
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.etiqueta} className={f.nivel}>
              <td className="l"><span className="signo">{f.signo}</span>{f.etiqueta}</td>
              {f.meses.map((v, i) => (
                <td key={i} className={i === n - 1 ? "hoy" : undefined}>{M(v)}</td>
              ))}
              <td className="hoy">{M(f.acumulado)}</td>
              {bloques.map((b) => {
                const meta = b.ppto(f); const e = b.ej(f);
                return (
                  <Celdas key={b.k} clase={b.clase} meta={meta === null ? "—" : M(meta)}
                    pct={pct(e)} tono={tono(e, f.esGasto)} />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="leyenda">
        {bloques.map((b) => (
          <span key={b.k}>
            <i className={`lchip ${b.clase}`} />{b.titulo.replace("EJECUCIÓN ", "")}: {b.def}
          </span>
        ))}
      </div>

      <BloqueNotas notas={notas} />

      <div className="pie">
        <span>Corte: {corte}</span>
        <span>Los tres porcentajes miden cosas distintas: no se comparan entre sí</span>
      </div>
    </div>
  );
}

function Fragmento({ th, titulo, def }: { th: string; titulo: string; def: string }) {
  return (
    <>
      <th className="gap" />
      <th className={th} colSpan={2}>
        <span className="gtitulo">{titulo}</span>
        <span className="gdef">{def}</span>
      </th>
    </>
  );
}

function Cabeceras({ clase }: { clase: string }) {
  return (
    <>
      <th className="gap" />
      <th className={clase}>Ppto.</th>
      <th className={clase}>% ejec.</th>
    </>
  );
}

function Celdas({ clase, meta, pct, tono }: {
  clase: string; meta: string; pct: string; tono?: string;
}) {
  return (
    <>
      <td className="gap" />
      <td className={clase}>{meta}</td>
      <td className={`${clase} pct${tono ? ` ${tono}` : ""}`}>{pct}</td>
    </>
  );
}
