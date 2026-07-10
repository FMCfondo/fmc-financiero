import { cuentas, ensureLoaded } from "@/lib/data";
import CuentasExplorer from "@/components/CuentasExplorer";

export const dynamic = "force-dynamic";

export default async function CuentasPage() {
  await ensureLoaded();
  const data = cuentas.map((c) => ({
    codigo: c.codigo, nombre: c.nombre, clase: c.clase, longitud: c.longitud, naturaleza: c.naturaleza,
  }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Plan de Cuentas</h1>
        <p className="text-sm text-muted mt-0.5">Maestro de cuentas PUC · {data.length} cuentas · base del mapeo a estados</p>
      </div>
      <CuentasExplorer cuentas={data} />
    </div>
  );
}
