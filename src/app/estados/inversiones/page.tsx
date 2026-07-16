import Link from "next/link";
import { portafolio } from "@/lib/inversiones";
import { ensureLoaded, resolverEtq } from "@/lib/data";
import { etqNombre } from "@/lib/periodos";
import PortafolioResumen from "@/components/PortafolioResumen";
import { Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

/* Pestaña Inversiones del módulo financiero: el MISMO resumen del portafolio
   (componente compartido, cero duplicación). Es lo que ve la Junta junto al
   Dashboard y los Estados; el mantenimiento vive en /portafolio. */

export default async function InversionesPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  await ensureLoaded();
  const etq = resolverEtq(p);
  const d = portafolio(etq);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">{etqNombre(etq)} · montos desde el balance · vencimientos contra hoy</p>
        <Link href="/portafolio?v=mantenimiento" className="flex items-center gap-1.5 text-xs text-muted hover:text-fg">
          <Settings2 size={13} /> Mantenimiento (tasas, fechas, cuentas)
        </Link>
      </div>
      {!d.hayDatos ? (
        <div className="card p-6 text-sm text-muted">No hay inversiones registradas.</div>
      ) : (
        <PortafolioResumen d={d} />
      )}
    </div>
  );
}
