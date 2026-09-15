import { Suspense } from "react";
import ModuloTabs from "@/components/ModuloTabs";
import { accesoAlModulo, vistasDe, VISTAS_JUNTA } from "@/lib/permisos";
import BotonPantallaCompleta from "@/components/PantallaCompleta";

export default async function EstadosLayout({ children }: { children: React.ReactNode }) {
  const yo = await accesoAlModulo("/estados/resultados"); // el módulo; la pestaña la mira cada página
  const visibles = vistasDe(yo);
  // La primera de las cuatro pestañas de estados que este usuario puede ver ("" si ninguna).
  const entradaFin = VISTAS_JUNTA.filter((v) => v.href !== "/estados/dashboard").map((v) => v.href).find((h) => visibles.includes(h)) ?? "";
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight">Estados Financieros</h1>
        <BotonPantallaCompleta titulo="Ver los estados a toda pantalla, para presentarlos desde aquí" />
      </div>
      <Suspense fallback={<div className="h-11 border-b border-line" />}>
        <ModuloTabs visibles={visibles} entradaFin={entradaFin} />
      </Suspense>
      <div>{children}</div>
    </div>
  );
}
