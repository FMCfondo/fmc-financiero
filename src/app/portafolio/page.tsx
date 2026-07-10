import * as D from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import { Info } from "lucide-react";

export default async function PortafolioPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await D.ensureLoaded();

  // Inversiones = grupo PUC 12; mostramos subcuentas con saldo
  const inv = D.children("12")
    .flatMap((g) => D.children(g.codigo))
    .map((c) => ({ codigo: c.codigo, nombre: c.nombre, valor: D.fact(etq, c.codigo) }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const total = D.fact(etq, "12");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Portafolio de Inversiones</h1>
        <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · saldos por cuenta (grupo 12)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-xs text-muted">Total invertido</div>
          <div className="text-2xl font-semibold tnum mt-1 text-accent2">{fmtCOP(total)}</div>
        </div>
        <div className="card p-4 flex items-start gap-3 border-accent/25">
          <Info size={18} className="text-accent2 mt-0.5 shrink-0" />
          <p className="text-sm text-muted">Tasas, fechas de vencimiento y entidad se conectan desde tu hoja PORTAFOLIO (tabla <code className="text-accent2">fact_inversion</code>), vinculadas <span className="text-fg">por cuenta</span>, no por celda.</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-faint border-b border-line flex">
          <span className="w-[110px]">Código</span>
          <span className="flex-1">Cuenta</span>
          <span className="w-44 text-right">Saldo</span>
        </div>
        {inv.map((r) => (
          <div key={r.codigo} className="flex items-center px-4 py-2 border-b border-line-soft text-sm hover:bg-white/[0.02]">
            <span className="w-[110px] tnum text-faint">{r.codigo}</span>
            <span className="flex-1 truncate text-muted">{r.nombre}</span>
            <span className="w-44 text-right tnum">{fmtNum(r.valor)}</span>
          </div>
        ))}
        {inv.length === 0 && <div className="px-4 py-6 text-sm text-faint text-center">Sin inversiones con saldo en el período.</div>}
      </div>
    </div>
  );
}
