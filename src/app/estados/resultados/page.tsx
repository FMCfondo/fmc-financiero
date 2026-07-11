import Link from "next/link";
import { er, erAnalisis } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import StatementTree, { type Nodo } from "@/components/StatementTree";
import AnalisisTabs from "@/components/AnalisisTabs";
import AnalisisTree, { type NodoA } from "@/components/AnalisisTree";
import { Info } from "lucide-react";

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string }> }) {
  const { p, vista } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = vista || "estado";
  await ensureLoaded();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">{etqNombre(etq)} · mes y acumulado del año · pesos colombianos</p>
        <AnalisisTabs current={current} />
      </div>
      {current === "estado" && <VistaEstado etq={etq} />}
      {current === "vertical" && <VistaVertical etq={etq} />}
      {current === "horizontal" && <VistaHorizontal etq={etq} />}
      {(current === "ejec-acum" || current === "ejec-mes") && <Pendiente />}
    </div>
  );
}

/* ---------- Estado ---------- */
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

      <SeccionER titulo="Ingresos" lineas={s.ingresos?.hijos ?? []} totalMes={s.ingMes} totalYtd={s.ingYTD} totalLabel="TOTAL INGRESOS" />
      <SeccionER titulo="Gastos" lineas={s.gastos?.hijos ?? []} totalMes={s.gasMes} totalYtd={s.gasYTD} totalLabel="TOTAL GASTOS" />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Resultado</h2></div>
        <ResRow label="Utilidad antes de impuestos" mes={s.resMes} ytd={s.resYTD} />
        <ResRow label={`(-) Impuesto de renta estimado (${fmtNum(s.tasa * 100)}%)`} mes={s.impuestoMes} ytd={s.impuestoYTD} muted />
        <div className="flex items-center px-4 py-3 fila-total">
          <span className="flex-1 font-semibold uppercase tracking-wide text-sm">(=) Utilidad neta</span>
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

/* ---------- Análisis Vertical ---------- */
function VistaVertical({ etq }: { etq: string }) {
  const a = erAnalisis(etq);
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">Cada línea como <b>% de los ingresos totales</b> (base = {fmtCOP(a.ingYTD)}), acumulado del año.</p>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Ingresos</h2></div>
        <AnalisisTree lineas={a.ingresos as NodoA[]} modo="vertical" />
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Gastos</h2></div>
        <AnalisisTree lineas={a.gastos as NodoA[]} modo="vertical" />
      </div>
    </div>
  );
}

/* ---------- Análisis Horizontal ---------- */
function VistaHorizontal({ etq }: { etq: string }) {
  const a = erAnalisis(etq);
  if (!a.py) return <SinComparativo />;
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">Acumulado del año vs. el mismo período del año anterior.</p>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Ingresos</h2></div>
        <AnalisisTree lineas={a.ingresos as NodoA[]} modo="horizontal" />
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Gastos</h2></div>
        <AnalisisTree lineas={a.gastos as NodoA[]} modo="horizontal" />
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function Mini({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold tnum mt-1 ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-fg"}`}>{value}</div>
    </div>
  );
}
function SeccionER({ titulo, lineas, totalMes, totalYtd, totalLabel }: { titulo: string; lineas: Nodo[]; totalMes: number; totalYtd: number; totalLabel: string }) {
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
function Pendiente() {
  return (
    <div className="card p-6 flex items-start gap-3 border-accent/25">
      <Info size={18} className="text-accent2 mt-0.5 shrink-0" />
      <p className="text-sm text-muted">La ejecución presupuestal se activa al migrar el <span className="text-fg">PPTO 2026</span> a la base de datos (siguiente paso). La estructura ya está lista.</p>
    </div>
  );
}
function SinComparativo() {
  return <div className="card p-6 text-sm text-muted">No hay período del año anterior para comparar en este corte.</div>;
}
