import { impuesto } from "@/lib/statements";
import { tasaImpuesto, ensureLoaded } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import ImpuestoCalc from "@/components/ImpuestoCalc";

export default async function ImpuestoPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const r = impuesto(etq, tasaImpuesto);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Provisión de Impuesto de Renta</h1>
        <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · estimación configurable</p>
      </div>
      <ImpuestoCalc ingYTD={r.ingYTD} gasYTD={r.gasYTD} defaultTasa={tasaImpuesto} />
    </div>
  );
}
