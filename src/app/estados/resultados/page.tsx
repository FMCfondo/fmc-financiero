import Link from "next/link";
import { er } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import StatementTree, { type Nodo } from "@/components/StatementTree";

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const s = er(etq);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted -mt-1">{etqNombre(etq)} · mes y acumulado del año · pesos colombianos</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Mini label="Ingresos del mes" value={fmtCOP(s.ingMes)} />
        <Mini label="Gastos del mes" value={fmtCOP(s.gasMes)} />
        <Mini label="Resultado del mes" value={fmtCOP(s.resMes)} tone={s.resMes >= 0 ? "pos" : "neg"} />
        <Mini label="Resultado neto (año)" value={fmtCOP(s.netoYTD)} tone={s.netoYTD >= 0 ? "pos" : "neg"} />
      </div>

      <SeccionER titulo="Ingresos" lineas={s.ingresos?.hijos ?? []} totalMes={s.ingMes} totalYtd={s.ingYTD} totalLabel="TOTAL INGRESOS" />
      <SeccionER titulo="Gastos" lineas={s.gastos?.hijos ?? []} totalMes={s.gasMes} totalYtd={s.gasYTD} totalLabel="TOTAL GASTOS" />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Resultado</h2></div>
        <ResRow label="Resultado antes de impuestos" mes={s.resMes} ytd={s.resYTD} />
        <ResRow label={`(-) Impuesto de renta estimado (${fmtNum(s.tasa * 100)}%)`} mes={s.impuestoMes} ytd={s.impuestoYTD} muted />
        <div className="flex items-center px-4 py-3 fila-total">
          <span className="flex-1 font-semibold uppercase tracking-wide text-sm">(=) Resultado neto</span>
          <span className={`w-40 text-right tnum font-semibold ${s.netoYTD >= 0 ? "text-pos" : "text-neg"}`}>{fmtNum(s.netoYTD)}</span>
          <span className={`w-40 text-right tnum font-semibold ${s.netoMes >= 0 ? "text-pos" : "text-neg"}`}>{fmtNum(s.netoMes)}</span>
        </div>
      </div>

      <p className="text-xs text-faint">
        Presentación neta. Impuesto configurable en{" "}
        <Link href={`/impuesto?p=${etq}`} className="text-accent2 hover:underline">Provisión de Impuesto</Link>.
      </p>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold tnum mt-1 ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-fg"}`}>{value}</div>
    </div>
  );
}

function SeccionER({
  titulo, lineas, totalMes, totalYtd, totalLabel,
}: { titulo: string; lineas: Nodo[]; totalMes: number; totalYtd: number; totalLabel: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">{titulo}</h2></div>
      <StatementTree lineas={lineas} showYtd expandDepth={1} />
      <div className="flex items-center px-4 py-3 fila-total">
        <span className="flex-1 font-semibold text-sm uppercase tracking-wide">{totalLabel}</span>
        <span className="w-40 text-right tnum font-semibold">{fmtNum(totalYtd)}</span>
        <span className="w-40 text-right tnum font-semibold">{fmtNum(totalMes)}</span>
      </div>
    </div>
  );
}

function ResRow({ label, mes, ytd, muted }: { label: string; mes: number; ytd: number; muted?: boolean }) {
  return (
    <div className="flex items-center px-4 py-2 border-b border-line-soft text-sm">
      <span className={`flex-1 ${muted ? "text-muted" : "text-fg"}`}>{label}</span>
      <span className="w-40 text-right tnum">{fmtNum(ytd)}</span>
      <span className="w-40 text-right tnum">{fmtNum(mes)}</span>
    </div>
  );
}
