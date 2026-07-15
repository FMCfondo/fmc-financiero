import Link from "next/link";
import { portafolio } from "@/lib/inversiones";
import { ensureLoaded, inversiones, paramNum } from "@/lib/data";
import { PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import PortafolioResumen from "@/components/PortafolioResumen";
import InversionesMantenimiento from "@/components/InversionesMantenimiento";
import { Settings2, LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortafolioPage({ searchParams }: { searchParams: Promise<{ p?: string; v?: string }> }) {
  const { p, v } = await searchParams;
  const etq = p || PERIODO_DEFAULT;
  await ensureLoaded();
  const d = portafolio(etq);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Portafolio de Inversiones</h1>
          <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · montos desde el balance · vencimientos contra hoy</p>
        </div>
        <div className="flex gap-1.5">
          <Tab href={`/portafolio${p ? `?p=${p}` : ""}`} active={v !== "mantenimiento"} icon={<LayoutDashboard size={14} />}>Portafolio</Tab>
          <Tab href={`/portafolio?${p ? `p=${p}&` : ""}v=mantenimiento`} active={v === "mantenimiento"} icon={<Settings2 size={14} />}>Mantenimiento</Tab>
        </div>
      </div>

      {!d.hayDatos ? (
        <div className="card p-6 text-sm text-muted">No hay inversiones registradas. Ejecuta <code>node scripts/migrate-inversiones.mjs</code> o créalas en Mantenimiento.</div>
      ) : v === "mantenimiento" ? (
        <InversionesMantenimiento
          inversiones={inversiones}
          benchPct={+(paramNum("bench_cdt180", 0) * 100).toFixed(2)}
          ipcPct={+(paramNum("ipc_12m", 0) * 100).toFixed(2)}
        />
      ) : (
        <PortafolioResumen d={d} />
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
