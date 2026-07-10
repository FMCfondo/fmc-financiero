"use client";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";

type C = { codigo: string; nombre: string; clase: number; longitud: number; naturaleza: string };
const CLASES: Record<number, string> = { 1: "Activo", 2: "Pasivo", 3: "Patrimonio", 4: "Ingresos", 5: "Gastos" };
const nivelIdx = (l: number) => ({ 1: 0, 2: 1, 4: 2, 6: 3, 8: 4, 10: 5 }[l] ?? 0);

export default function CuentasExplorer({ cuentas }: { cuentas: C[] }) {
  const [q, setQ] = useState("");
  const [clase, setClase] = useState(0);

  const filt = useMemo(
    () =>
      cuentas.filter(
        (c) =>
          (clase === 0 || c.clase === clase) &&
          (q === "" || c.codigo.startsWith(q.trim()) || c.nombre.toLowerCase().includes(q.toLowerCase())),
      ),
    [q, clase, cuentas],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código o nombre…"
            className="w-full bg-card2 border border-line rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <button key={c} onClick={() => setClase(c)}
              className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                clase === c ? "bg-accentdim border-accent/40 text-white" : "border-line text-muted hover:text-fg"
              }`}>
              {c === 0 ? "Todas" : CLASES[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-faint border-b border-line flex">
          <span className="w-[110px]">Código</span>
          <span className="flex-1">Nombre</span>
          <span className="w-24 text-right">Naturaleza</span>
        </div>
        <div className="max-h-[62vh] overflow-y-auto">
          {filt.slice(0, 500).map((c) => (
            <div key={c.codigo} className="flex items-center px-4 py-1.5 border-b border-line-soft text-sm hover:bg-white/[0.02]">
              <span className="w-[110px] tnum text-faint">{c.codigo}</span>
              <span className="flex-1 truncate" style={{ paddingLeft: nivelIdx(c.longitud) * 14 }}>
                <span className={c.longitud <= 2 ? "font-medium" : "text-muted"}>{c.nombre}</span>
              </span>
              <span className="w-24 text-right text-xs text-faint capitalize">{c.naturaleza}</span>
            </div>
          ))}
          {filt.length === 0 && <div className="px-4 py-6 text-sm text-faint text-center">Sin resultados.</div>}
        </div>
      </div>
      <p className="text-xs text-faint">{filt.length} cuentas · {cuentas.length} en el plan</p>
    </div>
  );
}
