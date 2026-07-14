import { Suspense } from "react";
import EstadosTabs from "@/components/EstadosTabs";

export default function FinancierosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-11 rounded-xl bg-card2" />}>
        <EstadosTabs />
      </Suspense>
      <div>{children}</div>
    </div>
  );
}
