/* Páginas 4 y 5 del informe: el estado de resultados, en DOS hojas.
 *
 * Antes iban en una sola y no cabían: la serie mensual gana una columna cada mes
 * -en diciembre son doce- y entre las dos cosas estrujaban la columna de concepto
 * hasta partir cada etiqueta en tres renglones. Se separaron por lo que responden:
 *
 *   · «evolucion»  → cómo se movió el año, mes a mes.
 *   · «ejecucion»  → cómo va contra el presupuesto, con LAS TRES EJECUCIONES.
 *
 * Las tres ejecuciones son medidas distintas y no se mezclan nunca en la misma
 * columna. Cada bloque lleva su sombreado (--g1/--g2/--g3), su definición escrita
 * bajo el título y una columna en blanco que lo separa del siguiente; al pie, la
 * leyenda que las explica en lenguaje llano, porque tres porcentajes distintos en
 * la misma fila confunden si no se dice cuál es cuál.
 *
 * Unidad: MILLONES, y la cabecera lo declara. Componente de presentación: las dos
 * vistas se alimentan de las MISMAS filas, así que no pueden discrepar. */
import { fmtContMill } from "@/lib/format";
import type { FilaResultados, Nota } from "@/lib/informe-tipos";
import BloqueNotas from "./BloqueNotas";

type Vista = "evolucion" | "ejecucion";

type Props = {
  vista: Vista;
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
  vista, periodo, corte, anio, mesNombre, etiquetasMeses, filas, notas,
}: Props) {
  const n = etiquetasMeses.length;
  const mes = mesNombre.toLowerCase();
  const esEvolucion = vista === "evolucion";

  const bloques = [
    { k: "mes" as const, clase: "cmes", th: "gmes", titulo: "EJECUCIÓN DEL MES",
      def: `${mes} vs. presupuesto de ${mes}`,
      ppto: (f: FilaResultados) => f.pptoMes, ej: (f: FilaResultados) => f.ejecMesPct },
    { k: "acum" as const, clase: "cacum", th: "gacum", titulo: "EJECUCIÓN ACUMULADA",
      def: `enero–${mes} vs. presupuesto del mismo período`,
      ppto: (f: FilaResultados) => f.pptoAcumulado, ej: (f: FilaResultados) => f.ejecAcumuladaPct },
    { k: "anio" as const, clase: "canio", th: "ganio", titulo: "EJECUCIÓN DEL AÑO",
      def: `enero–${mes} vs. presupuesto anual completo`,
      ppto: (f: FilaResultados) => f.pptoAnual, ej: (f: FilaResultados) => f.ejecAnualPct },
  ];

  return (
    <div className="page densa">
      <div className="band">
        <h1>ESTADO DE RESULTADOS · {esEvolucion ? "EVOLUCIÓN DEL AÑO" : "EJECUCIÓN PRESUPUESTAL"}</h1>
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
            <th colSpan={esEvolucion ? n + 1 : 2}>
              {esEvolucion ? `EVOLUCIÓN MENSUAL ${anio}` : "EJECUTADO"}
            </th>
            {!esEvolucion && bloques.map((b) => (
              <Fragmento key={b.k} th={b.th} titulo={b.titulo} def={b.def} />
            ))}
          </tr>
          <tr className="cols">
            <th className="l">Concepto</th>
            {esEvolucion
              ? etiquetasMeses.map((m, i) => (
                  <th key={m} className={i === n - 1 ? "hoy" : undefined}>{m}</th>
                ))
              : <th className="hoy">{mesNombre}</th>}
            <th className={esEvolucion ? undefined : "hoy"}>Acum.</th>
            {!esEvolucion && bloques.map((b) => <Cabeceras key={b.k} clase={b.th} />)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.etiqueta} className={f.nivel}>
              <td className="l"><span className="signo">{f.signo}</span>{f.etiqueta}</td>
              {esEvolucion
                ? f.meses.map((v, i) => (
                    <td key={i} className={i === n - 1 ? "hoy" : undefined}>{M(v)}</td>
                  ))
                : <td className="hoy">{M(f.mes)}</td>}
              <td className="hoy">{M(f.acumulado)}</td>
              {!esEvolucion && bloques.map((b) => {
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

      {!esEvolucion && (
        <div className="leyenda">
          {bloques.map((b) => (
            <span key={b.k}>
              <i className={`lchip ${b.clase}`} />{b.titulo.replace("EJECUCIÓN ", "")}: {b.def}
            </span>
          ))}
        </div>
      )}

      <BloqueNotas notas={notas} />

      <div className="pie">
        <span>Corte: {corte}</span>
        <span>
          {esEvolucion
            ? "La ejecución contra el presupuesto va en la página siguiente"
            : "Los tres porcentajes miden cosas distintas: no se comparan entre sí"}
        </span>
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
