import { flujoEfectivo } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

type Mov = { codigo: string; nombre: string; valor: number };

export default async function FlujoPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const f = flujoEfectivo(etq);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{etqNombre(etq)} · método indirecto (variación del mes) · pesos colombianos</p>

      {!f ? (
        <div className="card p-6 flex items-start gap-3">
          <Info size={18} className="text-accent2 mt-0.5 shrink-0" />
          <p className="text-sm text-muted">Se requiere el período anterior para calcular el flujo por método indirecto. Elige un mes con período previo disponible.</p>
        </div>
      ) : (
        <div className="card overflow-hidden max-w-3xl">
          <Linea label="Utilidad del período (antes de impuestos)" valor={f.util} bold />

          <Header>Actividades de operación</Header>
          {f.opAssets.map((m) => <Linea key={m.codigo} label={`Variación en ${m.nombre}`} valor={m.valor} />)}
          {f.opLiab.map((m) => <Linea key={m.codigo} label={`Variación en ${m.nombre}`} valor={m.valor} />)}
          {Math.abs(f.ajuste) > 0.5 && <Linea label="Otras partidas y ajustes (no monetarios)" valor={f.ajuste} />}
          <Subtotal label="Flujo neto de operación" valor={f.flujoOp} />

          <Header>Actividades de inversión</Header>
          {f.invAssets.length ? f.invAssets.map((m) => <Linea key={m.codigo} label={`Variación en ${m.nombre}`} valor={m.valor} />) : <Vacia />}
          <Subtotal label="Flujo neto de inversión" valor={f.flujoInv} />

          <Header>Actividades de financiación</Header>
          {[...f.finLiab, ...f.finPat].length ? [...f.finLiab, ...f.finPat].map((m) => <Linea key={m.codigo} label={`Variación en ${m.nombre}`} valor={m.valor} />) : <Vacia />}
          <Subtotal label="Flujo neto de financiación" valor={f.flujoFin} />

          <div className="flex items-center px-4 py-3 fila-total border-t border-line">
            <span className="flex-1 font-semibold uppercase text-sm tracking-wide">Aumento (disminución) neto de efectivo</span>
            <span className={`w-44 text-right tnum font-semibold ${f.neto < 0 ? "text-neg" : ""}`}>{fmtNum(f.neto)}</span>
          </div>
          <Linea label="Efectivo al inicio del período" valor={f.dispIni} />
          <div className="flex items-center px-4 py-3 brand-grad text-white">
            <span className="flex-1 font-semibold text-sm">Efectivo al final del período</span>
            <span className="w-44 text-right tnum font-semibold">{fmtNum(f.dispFin)}</span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2.5 text-sm ${f.cuadra ? "text-pos bg-pos/5" : "text-warn bg-warn/5"}`}>
            {f.cuadra ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {f.cuadra ? `Cuadra con el disponible del balance (${fmtCOP(f.dispReal)})` : `Diferencia con el disponible: ${fmtNum(f.dif)}`}
          </div>
        </div>
      )}

      <p className="text-xs text-faint max-w-3xl">
        Método indirecto: parte de la utilidad y ajusta por las variaciones del balance. Las <b>inversiones</b> (12,15–18) se
        clasifican como actividad de inversión; si prefieres verlas dentro de operación (por ser un fondo), lo ajustamos.
      </p>
    </div>
  );
}

function Linea({ label, valor, bold }: { label: string; valor: number; bold?: boolean }) {
  return (
    <div className={`flex items-center px-4 py-2 border-b border-line-soft text-sm ${bold ? "fila-total" : ""}`}>
      <span className={`flex-1 ${bold ? "font-semibold" : "text-muted"}`}>{label}</span>
      <span className={`w-44 text-right tnum ${valor < 0 ? "text-neg" : bold ? "font-semibold" : "text-fg"}`}>{fmtNum(valor)}</span>
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
      <span className={`w-44 text-right tnum font-semibold ${valor < 0 ? "text-neg" : ""}`}>{fmtNum(valor)}</span>
    </div>
  );
}
function Vacia() {
  return <div className="px-4 py-2 border-b border-line-soft text-sm text-faint italic">Sin movimientos en el período.</div>;
}
