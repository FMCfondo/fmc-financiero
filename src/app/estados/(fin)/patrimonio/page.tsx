import { cambiosPatrimonio } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtNum } from "@/lib/format";

export default async function PatrimonioPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const c = cambiosPatrimonio(etq);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {etqNombre(etq)} · acumulado del año{c.ini ? ` (desde ${etqNombre(c.ini)})` : ""} · pesos colombianos
      </p>

      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-faint">
              <th className="sticky left-0 z-10 bg-card text-left font-normal px-4 py-2.5 border-b border-line min-w-[220px]">Concepto</th>
              {c.comps.map((comp) => (
                <th key={comp.codigo} className="text-right font-normal px-4 py-2.5 border-b border-line min-w-[130px]">{comp.nombre}</th>
              ))}
              <th className="text-right font-semibold px-4 py-2.5 border-b border-line min-w-[140px] bg-card2">Total</th>
            </tr>
          </thead>
          <tbody>
            <MRow label="Saldo inicial" vals={c.comps.map((x) => x.inicial)} total={c.totalInicial} />
            <MRow label="Movimientos del patrimonio (aportes, reservas…)" vals={c.comps.map((x) => x.movimiento)} total={c.totalFinalBase - c.totalInicial} />
            <MRow label="Saldo final del patrimonio contable" vals={c.comps.map((x) => x.final)} total={c.totalFinalBase} bold />
            <MRow label="(+) Utilidad del ejercicio" vals={c.comps.map(() => null)} total={c.resultado} />
            <MRow label="Patrimonio total (incluye utilidad)" vals={c.comps.map(() => null)} total={c.totalFinal} grand />
          </tbody>
        </table>
      </div>

      <p className="text-xs text-faint">
        La utilidad del ejercicio ({fmtNum(c.resultado)}) aún no está cerrada en las cuentas de patrimonio; se muestra por separado y se suma al patrimonio total.
      </p>
    </div>
  );
}

function MRow({ label, vals, total, bold, grand }: { label: string; vals: (number | null)[]; total: number; bold?: boolean; grand?: boolean }) {
  const rowCls = grand ? "brand-grad text-white font-semibold" : bold ? "fila-total font-semibold" : "";
  const cell = "text-right tnum px-4 py-2.5 border-b border-line-soft";
  return (
    <tr className={rowCls}>
      <td className={`sticky left-0 z-10 px-4 py-2.5 border-b border-line-soft ${grand ? "bg-transparent" : bold ? "bg-[color:var(--color-card2)]" : "bg-card"}`}>{label}</td>
      {vals.map((v, i) => (
        <td key={i} className={`${cell} ${v !== null && v < 0 ? "text-neg" : ""}`}>{v === null ? "—" : fmtNum(v)}</td>
      ))}
      <td className={`${cell} font-semibold ${!grand ? "bg-card2" : ""}`}>{fmtNum(total)}</td>
    </tr>
  );
}
