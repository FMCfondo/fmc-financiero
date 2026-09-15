import Link from "next/link";
import { portafolio } from "@/lib/inversiones";
import { ensureLoaded, inversiones, paramNum, resolverEtq, periodo, esALaVista, tasaDe } from "@/lib/data";
import { etqNombre } from "@/lib/periodos";
import { obtenerSesion } from "@/lib/auth";
import { soloAdmin } from "@/lib/permisos";
import PortafolioResumen from "@/components/PortafolioResumen";
import InversionesMantenimiento from "@/components/InversionesMantenimiento";
import { Settings2, LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortafolioPage({ searchParams }: { searchParams: Promise<{ p?: string; v?: string }> }) {
  const { p, v } = await searchParams;
  // Mantenimiento (tasas, fechas, mapeo de auxiliares) es de administrador; la Junta
  // vuelve al resumen. La pestaña tampoco se le muestra, pero esconder no es proteger.
  const esAdmin = (await obtenerSesion())?.usuario.rol === "admin";
  if (v === "mantenimiento" && !esAdmin) await soloAdmin(`/portafolio${p ? `?p=${p}` : ""}`);
  await ensureLoaded();
  const etq = resolverEtq(p);
  const d = portafolio(etq);

  /* Las tasas del mes seleccionado para las posiciones a la vista, con la del mes
     anterior al lado como referencia. Los CDT no entran: su tasa es fija. */
  const per = periodo(etq);
  const [anioAnt, mesAnt] = per.mes === 1 ? [per.anio - 1, 12] : [per.anio, per.mes - 1];
  const tasasMes = inversiones
    .filter((i) => i.activa && esALaVista(i))
    .map((i) => ({
      id: i.id, entidad: i.entidad, tipo: i.tipo,
      actual: tasaDe(i, per.anio, per.mes),
      anterior: tasaDe(i, anioAnt, mesAnt),
    }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Portafolio de Inversiones</h1>
          <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · montos desde el balance · vencimientos contra hoy</p>
        </div>
        <div className="flex gap-1.5">
          <Tab href={`/portafolio${p ? `?p=${p}` : ""}`} active={v !== "mantenimiento"} icon={<LayoutDashboard size={14} />}>Portafolio</Tab>
          {esAdmin && (
            <Tab href={`/portafolio?${p ? `p=${p}&` : ""}v=mantenimiento`} active={v === "mantenimiento"} icon={<Settings2 size={14} />}>Mantenimiento</Tab>
          )}
        </div>
      </div>

      {!d.hayDatos ? (
        <div className="card p-6 text-sm text-muted">No hay inversiones registradas para este período.</div>
      ) : v === "mantenimiento" ? (
        <InversionesMantenimiento
          inversiones={inversiones}
          benchPct={+(paramNum("bench_cdt180", 0) * 100).toFixed(2)}
          ipcPct={+(paramNum("ipc_12m", 0) * 100).toFixed(2)}
          periodo={{ anio: per.anio, mes: per.mes, nombre: etqNombre(etq) }}
          tasasMes={tasasMes}
        />
      ) : (
        <PortafolioResumen d={d} esAdmin={esAdmin} />
      )}
    </div>
  );
}

function Tab({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm border transition-colors ${
      active ? "brand-grad text-white border-transparent font-medium" : "border-line text-muted hover:text-fg hover:bg-card2"
    }`}>
      {icon}{children}
    </Link>
  );
}
