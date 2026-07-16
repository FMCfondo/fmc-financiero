import { flujoEfectivo, flujoMatriz } from "@/lib/statements";
import { ensureLoaded, mesesVista, periodo, resolverEtq } from "@/lib/data";
import { etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtCont } from "@/lib/format";
import MesesSelector from "@/components/MesesSelector";
import AnioSelector from "@/components/AnioSelector";
import StatementMatrix from "@/components/StatementMatrix";
import { CheckCircle2, Info } from "lucide-react";

export default async function FlujoPage({ searchParams }: { searchParams: Promise<{ p?: string; meses?: string; anio?: string }> }) {
  const { p, meses, anio } = await searchParams;
  const nMeses = Math.min(Math.max(parseInt(meses || "4") || 4, 1), 24);
  await ensureLoaded();
  const etq = resolverEtq(p);
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

      {/* Meses de izquierda a derecha — mismo renderizador que los demás estados */}
      <StatementMatrix
        labels={m.labels}
        conAcum={false}
        col1Label="Concepto"
        secciones={[]}
        filasFinales={m.filas.map((fila) => ({
          nombre: fila.nombre, vals: fila.vals,
          tipo: fila.total ? "total" as const : fila.sub ? "sub" as const : "linea" as const,
        }))}
      />

      {/* Detalle del último mes visible */}
      {f && (
        <div className="card overflow-hidden max-w-3xl">
          <div className="px-5 py-3.5 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">Detalle del mes · {etqNombre(cols[cols.length - 1].etiqueta)}</h2>
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
    <div className={`flex items-center px-5 py-2 border-b border-line-soft text-sm ${bold ? "bg-[var(--stmt-tint)]" : ""}`}>
      <span className={`flex-1 ${bold ? "font-semibold text-fg" : "text-muted"}`}>{label}</span>
      <span className={`w-44 text-right tnum tabular-nums ${bold ? "font-semibold" : "text-fg/90"}`}>{fmtCont(valor)}</span>
    </div>
  );
}
function Header({ children }: { children: React.ReactNode }) {
  return <div className="px-5 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">{children}</div>;
}
function Subtotal({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center px-5 py-2.5 border-b border-line text-sm bg-[var(--stmt-tint)]">
      <span className="flex-1 font-semibold">{label}</span>
      <span className="w-44 text-right tnum tabular-nums font-semibold"><span className="border-t border-fg/25 inline-block">{fmtCont(valor)}</span></span>
    </div>
  );
}
function Vacia() {
  return <div className="px-5 py-2 border-b border-line-soft text-sm text-faint italic">Sin movimientos en el período.</div>;
}
