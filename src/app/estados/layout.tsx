import { Suspense } from "react";
import ModuloTabs from "@/components/ModuloTabs";

export default function EstadosLayout({ children }: { children: React.ReactNode }) {
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
