import { flujoEfectivo, flujoMatriz } from "@/lib/statements";
import { ensureLoaded, mesesVista, periodo } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCont } from "@/lib/format";
import MesesSelector from "@/components/MesesSelector";
import AnioSelector from "@/components/AnioSelector";
import { CheckCircle2, Info } from "lucide-react";

export default async function FlujoPage({ searchParams }: { searchParams: Promise<{ p?: string; meses?: string; anio?: string }> }) {
  const { p, meses, anio } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const nMeses = Math.min(Math.max(parseInt(meses || "4") || 4, 1), 24);
  await ensureLoaded();
  const nAnio = anio === "ultimos" ? undefined : (parseInt(anio || "") || periodo(etq).anio);

  const cols = mesesVista(etq, nAnio, nMeses);
  const m = flujoMatriz(cols);
  const f = flujoEfectivo(cols[cols.length - 1]?.etiqueta ?? etq);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5 flex-wrap">
        <p className="text-sm text-muted">{etqNombre(etq)} · método indirecto · pesos colombianos</p>
        <AnioSelector current={nAnio} />
        {!nAnio && <MesesSelector current={nMeses} />}
      </div>

      {/* Meses de izquierda a derecha */}
      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              <th className="sticky left-0 z-10 bg-card text-left font-normal px-5 py-2.5 border-b border-line min-w-[260px]">Concepto</th>
              {m.labels.map((l) => (
                <th key={l} className="text-right font-normal px-3 py-2.5 border-b border-line min-w-[122px]">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.filas.map((fila) => (
              <tr key={fila.id} className={fila.total ? "bg-card2 font-semibold" : fila.sub ? "bg-card2/50 font-medium" : ""}>
                <td className={`sticky left-0 z-10 px-5 py-2.5 border-b border-line-soft ${fila.total ? "bg-card2 uppercase text-[13px] tracking-wide" : fila.sub ? "bg-card2/70" : "bg-card"}`}>
                  {fila.nombre}
                </td>
                {fila.vals.map((v, i) => (
                  <td key={i} className="text-right tnum tabular-nums px-3 py-2.5 border-b border-line-soft whitespace-nowrap">
                    <span className={fila.total ? "border-t border-b-[3px] border-double border-fg/60 py-0.5 inline-block" : fila.sub ? "border-t border-fg/30 inline-block" : ""}>
                      {v === null ? "—" : fmtCont(v, fila.total)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalle del último mes visible */}
      {f && (
        <div className="card overflow-hidden max-w-3xl">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h2 className="font-semibold">Detalle del mes — {etqNombre(cols[cols.length - 1].etiqueta)}</h2>
            <span className="flex items-center gap-1.5 text-xs text-pos"><CheckCircle2 size={14} /> cuadra con el disponible ({fmtCOP(f.dispReal)})</span>
          </div>
          <Linea label="Utilidad del período (antes de impuestos)" valor={f.util} bold />
          <Header>Actividades de operación</Header>
          {f.opAssets.map((x) => <Linea key={x.codigo} label={`Variación en ${x.nombre}`} valor={x.valor} />)}
          {f.opLiab.map((x) => <Linea key={x.codigo} label={`Variación en ${x.nombre}`} valor={x.valor} />)}
          {Math.abs(f.ajuste) > 0.5 && <Linea label="Partidas no monetarias y ajustes" valor={f.ajuste} />}
          <Subtotal label="Flujo neto de operación" valor={f.flujoOp} />
          <Header>Actividades de inversión</Header>
          {f.invAssets.length ? f.invAssets.map((x) => <Linea key={x.codigo} label={`Variación en ${x.nombre}`} valor={x.valor} />) : <Vacia />}
          <Subtotal label="Flujo neto de inversión" valor={f.flujoInv} />
          <Header>Actividades de financiación</Header>
          {[...f.finLiab, ...f.finPat].length ? [...f.finLiab, ...f.finPat].map((x) => <Linea key={x.codigo} label={`Variación en ${x.nombre}`} valor={x.valor} />) : <Vacia />}
          <Subtotal label="Flujo neto de financiación" valor={f.flujoFin} />
        </div>
      )}

      {f && Math.abs(f.ajuste) > 0.5 && (
        <div className="card p-4 flex items-start gap-3 border-gold/30 max-w-3xl">
          <Info size={16} className="text-gold mt-0.5 shrink-0" />
          <p className="text-xs text-muted">
            <b className="text-fg">¿Qué es &ldquo;Partidas no monetarias y ajustes&rdquo;?</b> Movimientos contables que no pasaron por caja
            (causaciones, reclasificaciones y los ajustes manuales que venían de la hoja AJUSTADO del Excel). Se muestran como línea
            propia dentro de operación para que el estado cuadre exactamente contra el efectivo real del balance.
          </p>
        </div>
      )}
    </div>
  );
}

function Linea({ label, valor, bold }: { label: string; valor: number; bold?: boolean }) {
  return (
    <div className={`flex items-center px-4 py-2 border-b border-line-soft text-sm ${bold ? "fila-total" : ""}`}>
      <span className={`flex-1 ${bold ? "font-semibold" : "text-muted"}`}>{label}</span>
      <span className={`w-44 text-right tnum tabular-nums ${bold ? "font-semibold" : "text-fg"}`}>{fmtCont(valor)}</span>
    </div>
  );
}
function Header({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-2 bg-card2 text-xs font-semibold uppercase tracking-wide text-accent2 border-b border-line">{children}</div>;
}
function Subtotal({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center px-4 py-2.5 border-b border-line text-sm bg-card2">
      <span className="flex-1 font-semibold">{label}</span>
      <span className="w-44 text-right tnum tabular-nums font-semibold"><span className="border-t border-fg/30 inline-block">{fmtCont(valor)}</span></span>
    </div>
  );
}
function Vacia() {
  return <div className="px-4 py-2 border-b border-line-soft text-sm text-faint italic">Sin movimientos en el período.</div>;
}
