import Link from "next/link";
import { er, erAnalisis, erMatriz } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum, fmtCont } from "@/lib/format";
import StatementTree, { TotalRow, type Nodo } from "@/components/StatementTree";
import AnalisisTabs from "@/components/AnalisisTabs";
import AnalisisTree, { type NodoA } from "@/components/AnalisisTree";
import MesesSelector from "@/components/MesesSelector";
import { Info } from "lucide-react";

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; meses?: string }> }) {
  const { p, vista, meses } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = vista || "estado";
  const nMeses = Math.min(Math.max(parseInt(meses || "4") || 4, 1), 24);
  await ensureLoaded();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">{etqNombre(etq)} · pesos colombianos</p>
        <AnalisisTabs current={current} mensual />
      </div>
      {current === "estado" && <VistaEstado etq={etq} />}
      {current === "mensual" && <VistaMensual etq={etq} nMeses={nMeses} />}
      {current === "vertical" && <VistaVertical etq={etq} />}
      {current === "horizontal" && <VistaHorizontal etq={etq} />}
      {(current === "ejec-acum" || current === "ejec-mes") && <Pendiente />}
    </div>
  );
}

/* ---------- Estado (detallado, mes + acumulado) ---------- */
function VistaEstado({ etq }: { etq: string }) {
  const s = er(etq);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Mini label="Ingresos del mes" value={fmtCOP(s.ingMes)} />
        <Mini label="Gastos del mes" value={fmtCOP(s.gasMes)} />
        <Mini label="Utilidad del mes" value={fmtCOP(s.resMes)} tone={s.resMes >= 0 ? "pos" : "neg"} />
        <Mini label="Utilidad neta (año)" value={fmtCOP(s.netoYTD)} tone={s.netoYTD >= 0 ? "pos" : "neg"} />
      </div>
      <SeccionER titulo="Ingresos" lineas={s.ingresos?.hijos ?? []} totalMes={s.ingMes} totalYtd={s.ingYTD} totalLabel="Total ingresos" />
      <SeccionER titulo="Gastos" lineas={s.gastos?.hijos ?? []} totalMes={s.gasMes} totalYtd={s.gasYTD} totalLabel="Total gastos" />
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line"><h2 className="font-semibold">Resultado</h2></div>
        <ResRow label="Utilidad antes de impuestos" mes={s.resMes} ytd={s.resYTD} />
        <ResRow label={`(−) Impuesto de renta estimado (${fmtNum(s.tasa * 100)}%)`} mes={s.impuestoMes} ytd={s.impuestoYTD} muted />
        <TotalRow label="(=) Utilidad neta" valores={[s.netoYTD, s.netoMes]} doble tono={s.netoYTD >= 0 ? "pos" : "neg"} />
      </div>
      <p className="text-xs text-faint">Impuesto configurable en <Link href={`/impuesto?p=${etq}`} className="text-accent2 hover:underline">Provisión de Impuesto</Link>.</p>
    </div>
  );
}

/* ---------- Por meses (columnas por mes + acumulado) ---------- */
type Fila = { codigo: string; nombre: string; vals: number[]; acum: number };
function VistaMensual({ etq, nMeses }: { etq: string; nMeses: number }) {
  const m = erMatriz(etq, nMeses);
  const cols = m.meses.length + 2;
  return (
    <div className="space-y-3">
      <MesesSelector current={nMeses} />
      <div className="card overflow-auto">
        <table className="text-sm border-collapse w-max min-w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-faint">
              <th className="sticky left-0 z-10 bg-card text-left font-normal px-4 py-2.5 border-b border-line min-w-[230px]">Concepto</th>
              {m.meses.map((mo) => <th key={mo.etq} className="text-right font-normal px-3 py-2.5 border-b border-line min-w-[110px]">{mo.label}</th>)}
              <th className="text-right font-semibold px-4 py-2.5 border-b border-line min-w-[130px] bg-card2">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            <SecHead cols={cols}>Ingresos</SecHead>
            {m.ingresos.map((f) => <FilaM key={f.codigo} f={f} />)}
            <FilaM f={m.totalIng} bold />
            <SecHead cols={cols}>Gastos</SecHead>
            {m.gastos.map((f) => <FilaM key={f.codigo} f={f} />)}
            <FilaM f={m.totalGas} bold />
            <FilaM f={m.utilidad} grand />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-faint">Cada columna es el movimiento del mes; la última es el acumulado del año. Desliza para ver más meses.</p>
    </div>
  );
}
function FilaM({ f, bold, grand }: { f: Fila; bold?: boolean; grand?: boolean }) {
  const rowCls = grand ? "brand-grad text-white font-semibold" : bold ? "fila-total font-semibold" : "";
  const stickyBg = grand ? "bg-transparent" : bold ? "bg-card2" : "bg-card";
  return (
    <tr className={rowCls}>
      <td className={`sticky left-0 z-10 px-4 py-2 border-b border-line-soft ${stickyBg}`}>
        {f.codigo && <span className="text-faint tnum text-[11px] mr-2">{f.codigo}</span>}{f.nombre}
      </td>
      {f.vals.map((v, i) => <td key={i} className={`text-right tnum px-3 py-2 border-b border-line-soft ${v < 0 ? "text-neg" : ""}`}>{v === 0 ? "—" : fmtNum(v)}</td>)}
      <td className={`text-right tnum px-4 py-2 border-b border-line-soft font-semibold ${!grand ? "bg-card2" : ""}`}>{fmtNum(f.acum)}</td>
    </tr>
  );
}
function SecHead({ children, cols }: { children: React.ReactNode; cols: number }) {
  return <tr><td colSpan={cols} className="bg-card2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent2 border-b border-line">{children}</td></tr>;
}

/* ---------- Vertical / Horizontal ---------- */
function VistaVertical({ etq }: { etq: string }) {
  const a = erAnalisis(etq);
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">Cada línea como <b>% de los ingresos totales</b> (base = {fmtCOP(a.ingYTD)}), acumulado del año.</p>
      <div className="card overflow-hidden"><div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Ingresos</h2></div><AnalisisTree lineas={a.ingresos as NodoA[]} modo="vertical" /></div>
      <div className="card overflow-hidden"><div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Gastos</h2></div><AnalisisTree lineas={a.gastos as NodoA[]} modo="vertical" /></div>
    </div>
  );
}
function VistaHorizontal({ etq }: { etq: string }) {
  const a = erAnalisis(etq);
  if (!a.py) return <div className="card p-6 text-sm text-muted">No hay período del año anterior para comparar.</div>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">Acumulado del año vs. el mismo período del año anterior.</p>
      <div className="card overflow-hidden"><div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Ingresos</h2></div><AnalisisTree lineas={a.ingresos as NodoA[]} modo="horizontal" /></div>
      <div className="card overflow-hidden"><div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Gastos</h2></div><AnalisisTree lineas={a.gastos as NodoA[]} modo="horizontal" /></div>
    </div>
  );
}

/* ---------- helpers ---------- */
function Mini({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return <div className="card p-4"><div className="text-xs text-muted">{label}</div><div className={`text-lg font-semibold tnum mt-1 ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-fg"}`}>{value}</div></div>;
}
function SeccionER({ titulo, lineas, totalMes, totalYtd, totalLabel }: { titulo: string; lineas: Nodo[]; totalMes: number; totalYtd: number; totalLabel: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-line"><h2 className="font-semibold">{titulo}</h2></div>
      <StatementTree lineas={lineas} showYtd expandDepth={1} />
      <TotalRow label={totalLabel} valores={[totalYtd, totalMes]} />
    </div>
  );
}
function ResRow({ label, mes, ytd, muted }: { label: string; mes: number; ytd: number; muted?: boolean }) {
  return (
    <div className="flex items-center px-5 py-2 border-b border-line-soft text-sm">
      <span className={`flex-1 ${muted ? "text-muted" : "text-fg"}`}>{label}</span>
      <span className="w-36 text-right tnum tabular-nums">{fmtCont(ytd)}</span>
      <span className="w-36 text-right tnum tabular-nums">{fmtCont(mes)}</span>
    </div>
  );
}
function Pendiente() {
  return <div className="card p-6 flex items-start gap-3 border-accent/25"><Info size={18} className="text-accent2 mt-0.5 shrink-0" /><p className="text-sm text-muted">La ejecución presupuestal se activa al migrar el <span className="text-fg">PPTO 2026</span> a la base de datos.</p></div>;
}
