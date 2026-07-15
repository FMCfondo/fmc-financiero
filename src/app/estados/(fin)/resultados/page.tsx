import Link from "next/link";
import { erMatrizArbol, analisisMatriz } from "@/lib/statements";
import { ensureLoaded, mesesVista } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { fmtCOP, fmtNum } from "@/lib/format";
import StatementMatrix from "@/components/StatementMatrix";
import AnalisisTabs from "@/components/AnalisisTabs";
import MesesSelector from "@/components/MesesSelector";
import AnalisisMatrix from "@/components/AnalisisMatrix";
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
      {current === "vertical" && <VistaAnalisis modo="vertical" etq={etq} nMeses={nMeses} anio={nAnio} />}
      {current === "horizontal" && <VistaAnalisis modo="horizontal" etq={etq} nMeses={nMeses} anio={nAnio} />}
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

/* ---------- Análisis Vertical / Horizontal: misma vista de árbol × meses ---------- */
function VistaAnalisis({ modo, etq, nMeses, anio }: { modo: "vertical" | "horizontal"; etq: string; nMeses: number; anio?: number }) {
  const meses = mesesVista(etq, anio, nMeses);
  if (!meses.length) return <div className="card p-6 text-sm text-muted">No hay datos para ese año.</div>;
  const a = analisisMatriz("er", modo, meses);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        <AnioSelector current={anio} />
        {!anio && <MesesSelector current={nMeses} />}
      </div>
      <AnalisisMatrix labels={a.labels} secciones={a.secciones} colorear={modo === "horizontal"} />
      <p className="text-xs text-muted">
        {modo === "vertical"
          ? `Cada celda es la participación de la cuenta sobre ${a.base}.`
          : `Cada celda es la variación del mes contra ${a.base}; la raya (—) indica que no existe comparativo.`}
      </p>
    </div>
  );
}

function Pendiente() {
  return <div className="card p-6 flex items-start gap-3 border-accent/25"><Info size={18} className="text-accent2 mt-0.5 shrink-0" /><p className="text-sm text-muted">La ejecución presupuestal se activa al migrar el <span className="text-fg">PPTO 2026</span> a la base de datos.</p></div>;
}
