import Link from "next/link";
import { erAnalisis, erMatrizArbol } from "@/lib/statements";
import { ensureLoaded, mesesVista } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import StatementMatrix from "@/components/StatementMatrix";
import AnalisisTabs from "@/components/AnalisisTabs";
import AnalisisTree, { type NodoA } from "@/components/AnalisisTree";
import MesesSelector from "@/components/MesesSelector";
import AnioSelector from "@/components/AnioSelector";
import { Info } from "lucide-react";

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; meses?: string; anio?: string }> }) {
  const { p, vista, meses, anio } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  const current = vista || "estado";
  const nMeses = Math.min(Math.max(parseInt(meses || "4") || 4, 1), 24);
  const nAnio = anio ? parseInt(anio) : undefined;
  await ensureLoaded();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">{etqNombre(etq)} · pesos colombianos</p>
        <AnalisisTabs current={current} />
      </div>
      {current === "estado" && <VistaEstado etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "vertical" && <VistaVertical etq={etq} />}
      {current === "horizontal" && <VistaHorizontal etq={etq} />}
      {(current === "ejec-acum" || current === "ejec-mes") && <Pendiente />}
    </div>
  );
}

/* ---------- Estado: árbol completo, meses de izquierda a derecha + Acumulado ---------- */
function VistaEstado({ etq, nMeses, anio }: { etq: string; nMeses: number; anio?: number }) {
  const meses = mesesVista(etq, anio, nMeses);
  if (!meses.length) return <div className="card p-6 text-sm text-muted">No hay datos para ese año.</div>;
  const m = erMatrizArbol(meses);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        <AnioSelector current={anio} />
        {!anio && <MesesSelector current={nMeses} />}
      </div>
      <StatementMatrix
        labels={m.labels}
        conAcum
        secciones={[
          { titulo: "Ingresos", tono: "bg-pos", arbol: m.ingresos, totalLabel: "Total ingresos", totalVals: m.totalIng.vals, totalAcum: m.totalIng.acum },
          { titulo: "Gastos", tono: "bg-gold", arbol: m.gastos, totalLabel: "Total gastos", totalVals: m.totalGas.vals, totalAcum: m.totalGas.acum },
        ]}
        filasFinales={[
          { nombre: "Utilidad antes de impuestos", vals: m.utilAntes.vals, acum: m.utilAntes.acum, tipo: "sub" },
          { nombre: `(−) Impuesto de renta estimado (${fmtNum(m.tasa * 100)}%)`, vals: m.impuesto.vals, acum: m.impuesto.acum },
          { nombre: "(=) Utilidad neta", vals: m.utilNeta.vals, acum: m.utilNeta.acum, tipo: "total" },
        ]}
      />
      <p className="text-xs text-faint">
        Cada columna es el movimiento del mes; el <b>Acumulado</b> del año va en el recuadro final. El impuesto acumulado usa la
        provisión completa de <Link href={`/impuesto?p=${etq}`} className="text-accent2 hover:underline">Provisión de Impuesto</Link>.
      </p>
    </div>
  );
}

/* ---------- Vertical / Horizontal ---------- */
function VistaVertical({ etq }: { etq: string }) {
  const a = erAnalisis(etq);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Cada línea como <b>% de los ingresos totales</b> (base = {fmtCOP(a.ingYTD)}), acumulado del año.</p>
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
      <p className="text-xs text-muted">Acumulado del año vs. el mismo período del año anterior.</p>
      <div className="card overflow-hidden"><div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Ingresos</h2></div><AnalisisTree lineas={a.ingresos as NodoA[]} modo="horizontal" /></div>
      <div className="card overflow-hidden"><div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">Gastos</h2></div><AnalisisTree lineas={a.gastos as NodoA[]} modo="horizontal" /></div>
    </div>
  );
}

function Pendiente() {
  return <div className="card p-6 flex items-start gap-3 border-accent/25"><Info size={18} className="text-accent2 mt-0.5 shrink-0" /><p className="text-sm text-muted">La ejecución presupuestal se activa al migrar el <span className="text-fg">PPTO 2026</span> a la base de datos.</p></div>;
}
