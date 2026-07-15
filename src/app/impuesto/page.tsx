import { provisionRenta } from "@/lib/statements";
import { ensureLoaded, paramNum } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import ImpuestoCalc from "@/components/ImpuestoCalc";

export const dynamic = "force-dynamic";

export default async function ImpuestoPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const r = provisionRenta(etq);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Provisión de Impuesto de Renta</h1>
        <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · los parámetros se guardan y aplican en toda la app</p>
      </div>
      <ImpuestoCalc
        utilidad={r.utilidad}
        gmfAuto={r.gmf}
        defaults={{
          tasaPct: Math.round(r.tasa * 1000) / 10,
          otrosND: paramNum("prov_otros_nd", 0),
          anticipoRet: paramNum("prov_anticipo_ret", 0),
          anticipoSig: paramNum("prov_anticipo_sig", 0),
        }}
      />
    </div>
  );
}
