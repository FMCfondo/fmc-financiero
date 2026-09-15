import { soloAdmin } from "@/lib/permisos";
import Link from "next/link";
import { ensureLoaded, presupuesto } from "@/lib/data";
import PresupuestoCarga from "@/components/PresupuestoCarga";
import { CalendarRange, Link2 } from "lucide-react";

export const dynamic = "force-dynamic";

/* PRESUPUESTO — cargar el plan de un año y saber en qué estado está cada uno.
   Vive en Operación. El mapeo de cuentas se edita donde siempre (Estados
   Financieros › Resultados › mapeo); desde aquí solo se llega. */

export default async function PresupuestoPage() {
  await soloAdmin();
  await ensureLoaded();
  const anios = [...new Set(presupuesto.map((l) => l.anio))].sort((a, b) => b - a);
  const resumen = anios.map((anio) => {
    const filas = presupuesto.filter((l) => l.anio === anio);
    const detalle = filas.filter((l) => l.tipo === "detalle" && !l.formula);
    return {
      anio,
      filas: filas.length,
      detalle: detalle.length,
      mapeadas: detalle.filter((l) => l.cuentas.length > 0).length,
      formulas: filas.filter((l) => l.formula).length,
      conMeses: filas.some((l) => l.meses.some((v) => v !== 0)),
    };
  });
  const ultimo = anios[0] ?? new Date().getFullYear();

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Presupuesto</h1>
        <p className="text-sm text-muted mt-0.5">
          El plan anual contra el que se mide la ejecución y el informe de Junta. Se carga desde la hoja «PPTO &lt;año&gt;»
          del libro; la estructura y el mapeo de cuentas se heredan del año anterior.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resumen.length === 0 && (
          <div className="card p-5 text-sm text-muted">No hay ningún presupuesto cargado.</div>
        )}
        {resumen.map((r) => (
          <div key={r.anio} className="card p-5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium"><CalendarRange size={16} className="text-accent2" /> Presupuesto {r.anio}</div>
              <span className="text-xs text-muted">{r.filas} renglones · {r.formulas} totales estructurales</span>
            </div>
            <div className="text-sm">
              <b className="tnum">{r.mapeadas}</b> de <b className="tnum">{r.detalle}</b> rubros de detalle con cuentas PUC
              {r.mapeadas < r.detalle && <span className="text-muted"> · {r.detalle - r.mapeadas} muestran solo el presupuesto</span>}
            </div>
            {!r.conMeses && <p className="text-xs text-[#8A6A1D]">Cargado solo con el total anual: la ejecución mensual no puede calcularse.</p>}
            <Link href={`/estados/resultados?vista=mapeo&anio=${r.anio}`} className="inline-flex items-center gap-1.5 text-xs text-accent2 hover:underline">
              <Link2 size={13} /> Editar el mapeo de cuentas de {r.anio}
            </Link>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-medium mb-3">Cargar un presupuesto</h2>
        <PresupuestoCarga aniosCargados={anios} anioSugerido={ultimo + 1} />
      </div>
    </div>
  );
}
