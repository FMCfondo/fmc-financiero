/* Página 7: el portafolio de inversiones activas.
 * Cuatro cifras · composición por tipo · detalle por posición · concentración por entidad.
 *
 * La barra de concentración se escala contra la MAYOR, no contra el total: así las
 * entidades se comparan entre sí, que es la pregunta que responde esa sección.
 * Componente de presentación. */
import { fmtCont, fmtContMill } from "@/lib/format";
import type { Portafolio } from "@/lib/informe-tipos";
import BloqueNotas from "./BloqueNotas";

type Props = {
  periodo: string; corte: string; mesActual: string;
  p: Portafolio; rendimientoMes: number; rendimientoAcum: number;
  comentario?: string;
};

const pct1 = (v: number) => `${(v * 100).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const pct2 = (v: number) => `${(v * 100).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
/* Estilo de la casa (plantillas del informe): por encima de mil millones se imprime sin
   decimales, por debajo con uno. Un decimal en una cifra de cuatro dígitos es ruido. */
const mill = (v: number) => {
  const m = Math.abs(v) / 1e6;
  const txt = m >= 1000
    ? Math.round(m).toLocaleString("es-CO")
    : fmtContMill(v);
  return `$${txt} millones`;
};

export default function PaginaPortafolio({
  periodo, corte, mesActual, p, rendimientoMes, rendimientoAcum, comentario,
}: Props) {
  const entidades = new Set(p.posiciones.map((x) => x.entidad)).size;
  const porTipo = ["FIDUCIA", "CDT"].map((tipo) => {
    const monto = p.posiciones.filter((x) => x.tipo === tipo).reduce((s, x) => s + x.monto, 0);
    return { tipo: tipo === "FIDUCIA" ? "FIDUCIAS" : "CDT A 180 DÍAS", monto,
      pct: p.total ? monto / p.total : 0 };
  }).filter((x) => x.monto > 0);
  const mayor = p.concentracion[0]?.monto ?? 1;

  const tarjetas = [
    { l: "Total invertido", v: mill(p.total), c: `${pct1(p.pctActivo)} del activo total` },
    { l: "Tasa ponderada por monto", v: pct2(p.tasaPonderada), c: "efectiva anual" },
    { l: "Posiciones", v: String(p.posiciones.length), c: `en ${entidades} entidades vigiladas` },
    { l: `Rendimientos de ${mesActual.toLowerCase()}`, v: mill(rendimientoMes),
      c: `${mill(rendimientoAcum)} acumulados en el año` },
  ];

  return (
    <div className="page">
      <div className="band">
        <h1>PORTAFOLIO DE INVERSIONES ACTIVAS</h1>
        <span className="periodo">{periodo}</span>
      </div>
      <div className="meta">
        <span>FMC S.A.S. · Fondo Mutuo de Cobertura</span>
        <span>{p.concilia ? "Cuadra con Inversiones líquidas del balance" : "NO cuadra con el balance"}</span>
      </div>

      <div className="strip" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {tarjetas.map((t) => (
          <div key={t.l} className="stat">
            <span className="lbl">{t.l}</span>
            <span className="val">{t.v}</span>
            <span className="ctx">{t.c}</span>
          </div>
        ))}
      </div>

      <h2 className="sec-t">Composición por tipo de activo</h2>
      <div className="compo">
        {porTipo.map((t, i) => (
          <span key={t.tipo} className="seg"
            style={{ width: `${(t.pct * 100).toFixed(1)}%`, background: i === 0 ? "var(--royal)" : "#8fb3e0" }}>
            <span className={`seg-lbl${i === 0 ? "" : " osc"}`}>
              {t.tipo} · {mill(t.monto)} · {pct1(t.pct)}
            </span>
          </span>
        ))}
      </div>

      <div className="dos-col">
        <div>
          <h2 className="sec-t">Detalle por inversión</h2>
          <table className="mini">
            <thead>
              <tr className="cols">
                <th className="l">ID</th><th className="l">Tipo</th><th className="l">Entidad</th>
                <th>Monto</th><th>Plazo</th><th>Tasa</th>
              </tr>
            </thead>
            <tbody>
              {p.posiciones.map((x) => (
                <tr key={x.id} className="det">
                  <td className="l">{x.id}</td>
                  <td className="l"><span className="tipo-tag">{x.tipo}</span></td>
                  <td className="l">{x.entidad}</td>
                  <td>{fmtCont(x.monto)}</td>
                  <td>{x.diasPlazo === null ? "a la vista" : `${x.diasPlazo} d`}</td>
                  <td>{pct2(x.tasaEA)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="sec-t">Concentración por entidad</h2>
          {p.concentracion.map((c) => (
            <div key={c.entidad} className="conc">
              <div className="conc-cab">
                <span>{c.entidad}</span>
                <span className="conc-val">{pct1(c.pct)} · {mill(c.monto)}</span>
              </div>
              <div className="conc-track">
                <i className="conc-fill" style={{ width: `${(c.monto / mayor) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="conc-nota">
            Las barras se comparan contra la mayor posición, no contra el total: así se
            ve de un vistazo cuánto pesa cada entidad frente a las demás.
          </p>
        </div>
      </div>

      <BloqueNotas notas={[]} comentario={comentario} />

      <div className="pie">
        <span>Corte: {corte}</span>
        <span>Tasa ponderada por monto, no promedio simple</span>
      </div>
    </div>
  );
}
