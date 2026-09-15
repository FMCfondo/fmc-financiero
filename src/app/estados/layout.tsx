import { Suspense } from "react";
import ModuloTabs from "@/components/ModuloTabs";
import { accesoA } from "@/lib/permisos";

export default async function EstadosLayout({ children }: { children: React.ReactNode }) {
  await accesoA("/estados/resultados"); // el módulo entero: la ruta vale para todas sus pestañas
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Estados Financieros</h1>
      <Suspense fallback={<div className="h-11 border-b border-line" />}>
        <ModuloTabs />
      </Suspense>
      <div>{children}</div>
    </div>
  );
}
