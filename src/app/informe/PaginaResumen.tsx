/* Página 1: el resumen ejecutivo. Nueve cifras y cuatro series mensuales.
 *
 * Es la única página del informe que NO es una tabla, y es deliberado: cuando algo tiene
 * que entenderse de un golpe, se usan tarjetas y barras. Las páginas 2 a 7 son el anexo
 * probatorio; ésta es la lectura.
 *
 * Los gráficos son SVG dibujado a mano, sin librería: siete barras con su valor escrito
 * encima y el mes en curso en azul institucional. Nada de leyendas ni ejes — si hay que
 * consultar una leyenda para leer la barra, la barra falló.
 *
 * Unidad: MILLONES. Componente de presentación. */
import { fmtContMill } from "@/lib/format";
import type { Nota, Tarjeta } from "@/lib/informe-tipos";
import BloqueNotas from "./BloqueNotas";

type Serie = { titulo: string; valores: number[]; etiquetas: string[] };
type Props = {
  periodo: string; corte: string; rangoMeses: string;
  tarjetas: Tarjeta[]; evolucion: Serie[]; notas: Nota[]; comentario?: string;
};

const mill = (v: number) => {
  const m = Math.abs(v) / 1e6;
  return `$${m >= 1000 ? Math.round(m).toLocaleString("es-CO") : fmtContMill(v)} millones`;
};

/* Geometría del gráfico, tomada del informe certificado: siete barras de 42 pt con 7 de
   separación, línea base en 59 y la barra mayor a 42 de alto. */
const ANCHO = 42, PASO = 49, BASE = 59, ALTO_MAX = 42;

function Grafico({ s }: { s: Serie }) {
  const max = Math.max(...s.valores.map((v) => Math.abs(v) / 1e6), 0.0001);
  const ultimo = s.valores.length - 1;
  return (
    <div className="graf">
      <div className="graf-t">{s.titulo}</div>
      <svg viewBox={`0 0 ${s.valores.length * PASO - 7} 72`} width="100%" height={72}
           preserveAspectRatio="xMidYMid meet">
        {s.valores.map((v, i) => {
          const m = v / 1e6;
          const alto = (Math.abs(m) / max) * ALTO_MAX;
          const y = BASE - alto;
          const x = i * PASO;
          return (
            <g key={i}>
              <rect x={x} y={y} width={ANCHO} height={alto} rx={1.5}
                    fill={i === ultimo ? "#1e40af" : "#a9c1e6"} />
              <text x={x + ANCHO / 2} y={y - 3} textAnchor="middle" fontSize={11.5}
                    fontWeight={700} fill="#1a2438">{fmtContMill(v)}</text>
              <text x={x + ANCHO / 2} y={70} textAnchor="middle" fontSize={10.5}
                    fontWeight={500} fill="#8d9bb3">{s.etiquetas[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Franja({ t }: { t: Tarjeta[] }) {
  return (
    <div className="strip" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
      {t.map((c) => (
        <div key={c.etiqueta} className="stat"
             style={c.etiqueta === "Portafolio de inversiones" ? { gridColumn: "span 2" } : undefined}>
          <div className="lbl">{c.etiqueta}</div>
          <div className="val">{mill(c.valor)}</div>
          <div className="ctx">
            {c.destacado && <b className={c.tono ?? undefined}>{c.destacado}</b>}
            {c.destacado ? " " : ""}{c.contexto}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PaginaResumen({
  periodo, corte, rangoMeses, tarjetas, evolucion, notas, comentario,
}: Props) {
  return (
    <div className="page">
      <div className="band">
        <h1>RESUMEN EJECUTIVO</h1>
        <span className="periodo">{periodo}</span>
      </div>
      <div className="meta">
        <span>FMC S.A.S. · Fondo Mutuo de Cobertura</span>
        <span>Cifras en millones de pesos</span>
      </div>

      <Franja t={tarjetas.slice(0, 4)} />
      <Franja t={tarjetas.slice(4, 8)} />
      <Franja t={tarjetas.slice(8)} />

      <h2 className="sec-t">Evolución del año · {rangoMeses}, en millones de pesos</h2>
      <div className="grafs">
        {evolucion.map((s) => <Grafico key={s.titulo} s={s} />)}
      </div>

      <BloqueNotas notas={notas} comentario={comentario} titulo="Situación del período" />

      <div className="pie">
        <span>Corte: {corte}</span>
        <span>Las páginas siguientes soportan cada cifra de esta hoja</span>
      </div>
    </div>
  );
}
