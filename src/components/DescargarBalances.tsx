"use client";
import { useState } from "react";
import { Download } from "lucide-react";

const MODOS = [
  { id: "mes", label: "Del mes", ayuda: "Ingresos y gastos: lo de cada mes." },
  { id: "acumulado", label: "Acumulado", ayuda: "Ingresos y gastos: acumulado de enero a cada mes." },
] as const;

/** Descarga los balances en Excel: todos los meses en una hoja, un año tras otro. */
export default function DescargarBalances() {
  const [modo, setModo] = useState<(typeof MODOS)[number]["id"]>("mes");
  const elegido = MODOS.find((m) => m.id === modo) ?? MODOS[0];
  return (
    <div className="flex flex-col items-start lg:items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="seg">
          {MODOS.map((m) => (
            <button key={m.id} type="button" onClick={() => setModo(m.id)} className={modo === m.id ? "on" : ""}>
              {m.label}
            </button>
          ))}
        </div>
        <a href={`/api/balances/excel?modo=${modo}`} download
          className="flex items-center gap-2 px-4 py-2 rounded-lg brand-grad text-white text-sm font-medium">
          <Download size={15} /> Descargar Excel
        </a>
      </div>
      <p className="text-xs text-muted">{elegido.ayuda} Activo, pasivo y patrimonio: saldo al cierre.</p>
    </div>
  );
}
