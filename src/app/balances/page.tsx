import * as D from "@/lib/data";
import { mesCorto } from "@/lib/format";
import BalancesMatrix from "@/components/BalancesMatrix";

export const dynamic = "force-dynamic";

export default async function BalancesPage() {
  await D.ensureLoaded();
  const periodos = D.periodos.map((p) => ({
    etiqueta: p.etiqueta, anio: p.anio, label: `${mesCorto[p.mes]} ${String(p.anio).slice(2)}`,
  }));
  const rows = D.cuentas.map((c) => ({
    codigo: c.codigo, nombre: c.nombre, longitud: c.longitud, clase: c.clase, esHoja: c.es_hoja,
    vals: D.periodos.map((p) => D.fact(p.etiqueta, c.codigo)),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Balances / Resumen</h1>
        <p className="text-sm text-muted mt-0.5">Matriz de cuentas × meses — como tu hoja RESUMEN, para revisar movimientos y detectar faltantes.</p>
      </div>
      <BalancesMatrix periodos={periodos} rows={rows} />
    </div>
  );
}
