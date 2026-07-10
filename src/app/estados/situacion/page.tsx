import Link from "next/link";
import { esf } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import StatementTree, { type Nodo } from "@/components/StatementTree";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default async function SituacionPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const s = esf(etq);
  const cuadra = Math.abs(s.descuadre) < 1;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted -mt-1">{etqNombre(etq)} · cifras en pesos colombianos</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Mini label="Total Activos" value={fmtCOP(s.totalActivo)} tone="accent" />
        <Mini label="Total Pasivos" value={fmtCOP(s.totalPasivo)} />
        <Mini label="Total Patrimonio" value={fmtCOP(s.totalPatrim)} />
        <div className={`card p-4 flex items-center gap-3 ${cuadra ? "" : "border-neg/50"}`}>
          {cuadra ? <CheckCircle2 className="text-pos" size={22} /> : <AlertTriangle className="text-neg" size={22} />}
          <div>
            <div className="text-xs text-muted">Ecuación contable</div>
            <div className={`text-sm font-medium ${cuadra ? "text-pos" : "text-neg"}`}>
              {cuadra ? "Cuadra (A = P + K)" : `Descuadre ${fmtNum(s.descuadre)}`}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Seccion titulo="Activo" total={s.totalActivo} totalLabel="TOTAL ACTIVOS" lineas={s.activo?.hijos ?? []} />
        <div className="space-y-4">
          <Seccion titulo="Pasivo" total={s.totalPasivo} totalLabel="TOTAL PASIVOS" lineas={s.pasivo?.hijos ?? []}
            extra={[{ nombre: "Provisión impuesto de renta (estimado)", valor: s.impuesto }]} />
          <Seccion titulo="Patrimonio" total={s.totalPatrim} totalLabel="TOTAL PATRIMONIO" lineas={s.patrimonio?.hijos ?? []}
            extra={[{ nombre: "Resultado del ejercicio (estimado)", valor: s.neto }]} />
        </div>
      </div>

      <p className="text-xs text-faint">
        Impuesto estimado al {fmtNum(s.tasa * 100)}% sobre el resultado antes de impuestos ({fmtCOP(s.preTax)}).
        Ajústalo en <Link href={`/impuesto?p=${etq}`} className="text-accent2 hover:underline">Provisión de Impuesto</Link>.
      </p>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold tnum mt-1 ${tone === "accent" ? "text-accent2" : "text-fg"}`}>{value}</div>
    </div>
  );
}

function Seccion({
  titulo, total, totalLabel, lineas, extra = [],
}: { titulo: string; total: number; totalLabel: string; lineas: Nodo[]; extra?: { nombre: string; valor: number }[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">{titulo}</h2></div>
      <StatementTree lineas={lineas} expandDepth={1} />
      {extra.map((e) => (
        <div key={e.nombre} className="flex items-center px-4 py-1.5 border-b border-line-soft text-sm">
          <span className="flex-1 text-muted italic pl-[14px]">{e.nombre}</span>
          <span className="w-40 text-right tnum">{fmtNum(e.valor)}</span>
        </div>
      ))}
      <div className="flex items-center px-4 py-3 fila-total">
        <span className="flex-1 font-semibold text-sm uppercase tracking-wide text-fg">{totalLabel}</span>
        <span className="w-40 text-right tnum font-semibold text-base">{fmtNum(total)}</span>
      </div>
    </div>
  );
}
