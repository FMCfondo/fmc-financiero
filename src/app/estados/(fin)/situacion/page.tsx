import Link from "next/link";
import { esf, esfAnalisis } from "@/lib/statements";
import { ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import StatementTree, { type Nodo } from "@/components/StatementTree";
import AnalisisTabs from "@/components/AnalisisTabs";
import AnalisisTree, { type NodoA } from "@/components/AnalisisTree";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

export default async function SituacionPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string }> }) {
  const { p, vista } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = vista || "estado";
  await ensureLoaded();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">{etqNombre(etq)} · cifras en pesos colombianos</p>
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
  const s = esf(etq);
  const cuadra = Math.abs(s.descuadre) < 1;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniK label="Total Activos" value={fmtCOP(s.totalActivo)} tone="accent" />
        <MiniK label="Total Pasivos" value={fmtCOP(s.totalPasivo)} />
        <MiniK label="Total Patrimonio" value={fmtCOP(s.totalPatrim)} />
        <div className={`card p-4 flex items-center gap-3 ${cuadra ? "" : "border-neg/50"}`}>
          {cuadra ? <CheckCircle2 className="text-pos" size={22} /> : <AlertTriangle className="text-neg" size={22} />}
          <div>
            <div className="text-xs text-muted">Ecuación contable</div>
            <div className={`text-sm font-medium ${cuadra ? "text-pos" : "text-neg"}`}>{cuadra ? "Cuadra (A = P + K)" : `Descuadre ${fmtNum(s.descuadre)}`}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Seccion titulo="Activo" tono="activo" total={s.totalActivo} totalLabel="TOTAL ACTIVOS" lineas={s.activo?.hijos ?? []} />
        <div className="space-y-4">
          <Seccion titulo="Pasivo" tono="pasivo" total={s.totalPasivo} totalLabel="TOTAL PASIVOS" lineas={s.pasivo?.hijos ?? []}
            extra={[{ nombre: "Provisión impuesto de renta (estimado)", valor: s.impuesto }]} />
          <Seccion titulo="Patrimonio" tono="patrimonio" total={s.totalPatrim} totalLabel="TOTAL PATRIMONIO" lineas={s.patrimonio?.hijos ?? []}
            extra={[{ nombre: "Utilidad del ejercicio (estimada)", valor: s.neto }]} />
        </div>
      </div>

      <p className="text-xs text-faint">
        Impuesto estimado al {fmtNum(s.tasa * 100)}% sobre la utilidad antes de impuestos ({fmtCOP(s.preTax)}).
        Ajústalo en <Link href={`/impuesto?p=${etq}`} className="text-accent2 hover:underline">Provisión de Impuesto</Link>.
      </p>
    </div>
  );
}

/* ---------- Vertical ---------- */
function VistaVertical({ etq }: { etq: string }) {
  const a = esfAnalisis(etq);
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">Cada línea como <b>% del total de activos</b> (base = {fmtCOP(a.totalActivo)}).</p>
      <SeccionA titulo="Activo" lineas={a.activo as NodoA[]} modo="vertical" />
      <SeccionA titulo="Pasivo" lineas={a.pasivo as NodoA[]} modo="vertical" />
      <SeccionA titulo="Patrimonio" lineas={a.patrimonio as NodoA[]} modo="vertical" />
    </div>
  );
}

/* ---------- Horizontal ---------- */
function VistaHorizontal({ etq }: { etq: string }) {
  const a = esfAnalisis(etq);
  if (!a.py) return <SinComparativo />;
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">Saldos vs. el mismo mes del año anterior.</p>
      <SeccionA titulo="Activo" lineas={a.activo as NodoA[]} modo="horizontal" />
      <SeccionA titulo="Pasivo" lineas={a.pasivo as NodoA[]} modo="horizontal" />
      <SeccionA titulo="Patrimonio" lineas={a.patrimonio as NodoA[]} modo="horizontal" />
    </div>
  );
}

/* ---------- helpers ---------- */
function MiniK({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold tnum mt-1 ${tone === "accent" ? "text-accent2" : "text-fg"}`}>{value}</div>
    </div>
  );
}
function Seccion({ titulo, total, totalLabel, lineas, extra = [], tono }: { titulo: string; total: number; totalLabel: string; lineas: Nodo[]; extra?: { nombre: string; valor: number }[]; tono?: "activo" | "pasivo" | "patrimonio" }) {
  const barra = tono === "activo" ? "bg-royal" : tono === "pasivo" ? "bg-gold" : tono === "patrimonio" ? "bg-pos" : "bg-accent";
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        <span className={`w-1.5 h-5 rounded ${barra}`} />
        <h2 className="font-semibold">{titulo}</h2>
      </div>
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
function SeccionA({ titulo, lineas, modo }: { titulo: string; lineas: NodoA[]; modo: "vertical" | "horizontal" }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">{titulo}</h2></div>
      <AnalisisTree lineas={lineas} modo={modo} />
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
