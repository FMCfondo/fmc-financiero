import { Suspense } from "react";
import EstadosTabs from "@/components/EstadosTabs";
import { obtenerSesion } from "@/lib/auth";
import { vistasDe } from "@/lib/permisos";

export default async function FinancierosLayout({ children }: { children: React.ReactNode }) {
  const s = await obtenerSesion(); // el layout de arriba ya exigió la sesión
  const visibles = s ? vistasDe(s.usuario) : [];
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-11 rounded-xl bg-card2" />}>
        <EstadosTabs visibles={visibles} />
      </Suspense>
      <div>{children}</div>
    </div>
  );
}
