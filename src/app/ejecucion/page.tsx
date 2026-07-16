import { er } from "@/lib/statements";
import { ensureLoaded, resolverEtq } from "@/lib/data";
import { etqNombre } from "@/lib/periodos";
import { fmtCOP } from "@/lib/format";
import { Info } from "lucide-react";

export default async function EjecucionPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  await ensureLoaded();
  const etq = resolverEtq(p);
  const s = er(etq);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ejecución Presupuestal</h1>
        <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · ejecutado acumulado del año</p>
      </div>

      <div className="card p-4 flex items-start gap-3 border-accent/25">
        <Info size={18} className="text-accent2 mt-0.5 shrink-0" />
        <p className="text-sm text-muted">
          Mostramos lo <span className="text-fg">ejecutado</span>. La comparación contra presupuesto se activa al cargar
          el <span className="text-fg">PPTO 2026</span> en el siguiente paso (ya está en el modelo: tabla <code className="text-accent2">fact_presupuesto</code>).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Ingresos ejecutados" value={fmtCOP(s.ingYTD)} />
        <Card label="Gastos ejecutados" value={fmtCOP(s.gasYTD)} />
        <Card label="Resultado ejecutado" value={fmtCOP(s.resYTD)} tone={s.resYTD >= 0 ? "pos" : "neg"} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-faint border-b border-line flex">
          <span className="flex-1">Concepto</span>
          <span className="w-40 text-right">Ejecutado</span>
          <span className="w-40 text-right">Presupuesto</span>
          <span className="w-28 text-right">Cumpl.</span>
        </div>
        {[
          { c: "Ingresos", v: s.ingYTD },
          { c: "Gastos", v: s.gasYTD },
          { c: "Resultado", v: s.resYTD },
        ].map((r) => (
          <div key={r.c} className="flex items-center px-4 py-2.5 border-b border-line-soft text-sm">
            <span className="flex-1">{r.c}</span>
            <span className="w-40 text-right tnum">{fmtCOP(r.v)}</span>
            <span className="w-40 text-right tnum text-faint">—</span>
            <span className="w-28 text-right tnum text-faint">—</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-xl font-semibold tnum mt-1 ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : ""}`}>{value}</div>
    </div>
  );
}
