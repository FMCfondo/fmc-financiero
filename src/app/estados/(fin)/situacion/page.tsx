import Link from "next/link";
import { esfAnalisis, esfMatrizArbol } from "@/lib/statements";
import { ensureLoaded, mesesVista } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import StatementMatrix from "@/components/StatementMatrix";
import AnalisisTabs from "@/components/AnalisisTabs";
import AnalisisTree, { type NodoA } from "@/components/AnalisisTree";
import MesesSelector from "@/components/MesesSelector";
import AnioSelector from "@/components/AnioSelector";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

export default async function SituacionPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; meses?: string; anio?: string }> }) {
  const { p, vista, meses, anio } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = vista || "estado";
  const nMeses = Math.min(Math.max(parseInt(meses || "4") || 4, 1), 24);
  const nAnio = anio ? parseInt(anio) : undefined;
  await ensureLoaded();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">{etqNombre(etq)} · cifras en pesos colombianos</p>
        <AnalisisTabs current={current} />
      </div>
      {current === "estado" && <VistaEstado etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "vertical" && <VistaVertical etq={etq} />}
      {current === "horizontal" && <VistaHorizontal etq={etq} />}
      {(current === "ejec-acum" || current === "ejec-mes") && <Pendiente />}
    </div>
  );
}

/* ---------- Estado: saldos por mes, de izquierda a derecha ----------
   Sin columna de acumulado: cada saldo del balance YA es acumulado por naturaleza. */
function VistaEstado({ etq, nMeses, anio }: { etq: string; nMeses: number; anio?: number }) {
  const meses = mesesVista(etq, anio, nMeses);
  if (!meses.length) return <div className="card p-6 text-sm text-muted">No hay datos para ese año.</div>;
  const m = esfMatrizArbol(meses);
  const ult = m.labels.length - 1;
  const cuadra = Math.abs(m.descuadre[ult]) < 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        <AnioSelector current={anio} />
        {!anio && <MesesSelector current={nMeses} />}
        <span className={`flex items-center gap-1.5 text-xs ${cuadra ? "text-pos" : "text-neg"}`}>
          {cuadra ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {cuadra ? "Ecuación contable: cuadra (A = P + K) en todos los meses" : `Descuadre: ${fmtNum(m.descuadre[ult])}`}
        </span>
      </div>
      <StatementMatrix
        labels={m.labels}
        conAcum={false}
        secciones={[
          { titulo: "Activo", tono: "bg-royal", arbol: m.activo, totalLabel: "Total activos", totalVals: m.totalActivo },
          {
            titulo: "Pasivo", tono: "bg-gold", arbol: m.pasivo,
            extra: [{ nombre: "Provisión impuesto de renta (estimada)", vals: m.provision }],
            totalLabel: "Total pasivos", totalVals: m.totalPasivo,
          },
          {
            titulo: "Patrimonio", tono: "bg-pos", arbol: m.patrimonio,
            extra: [{ nombre: "Utilidad del ejercicio (estimada)", vals: m.utilidad }],
            totalLabel: "Total patrimonio", totalVals: m.totalPatrim,
          },
        ]}
      />
      <p className="text-xs text-faint">
        Cada columna es el saldo al cierre de ese mes (ya acumulado por naturaleza). La provisión se ajusta en{" "}
        <Link href={`/impuesto?p=${etq}`} className="text-accent2 hover:underline">Provisión de Impuesto</Link>.
      </p>
    </div>
  );
}

/* ---------- Vertical / Horizontal ---------- */
function VistaVertical({ etq }: { etq: string }) {
  const a = esfAnalisis(etq);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Cada línea como <b>% del total de activos</b> (base = {fmtCOP(a.totalActivo)}).</p>
      <SeccionA titulo="Activo" lineas={a.activo as NodoA[]} modo="vertical" />
      <SeccionA titulo="Pasivo" lineas={a.pasivo as NodoA[]} modo="vertical" />
      <SeccionA titulo="Patrimonio" lineas={a.patrimonio as NodoA[]} modo="vertical" />
    </div>
  );
}
function VistaHorizontal({ etq }: { etq: string }) {
  const a = esfAnalisis(etq);
  if (!a.py) return <div className="card p-6 text-sm text-muted">No hay período del año anterior para comparar en este corte.</div>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Saldos vs. el mismo mes del año anterior.</p>
      <SeccionA titulo="Activo" lineas={a.activo as NodoA[]} modo="horizontal" />
      <SeccionA titulo="Pasivo" lineas={a.pasivo as NodoA[]} modo="horizontal" />
      <SeccionA titulo="Patrimonio" lineas={a.patrimonio as NodoA[]} modo="horizontal" />
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
      <p className="text-sm text-muted">La ejecución presupuestal se activa al migrar el <span className="text-fg">PPTO 2026</span> a la base de datos. La estructura ya está lista.</p>
    </div>
  );
}
