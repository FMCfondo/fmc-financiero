"use client";
import type { ItemComp } from "@/lib/cockpit";

/* BALANCE VISUAL — dos columnas enfrentadas, a la misma altura.
   De un vistazo se ve (1) que el activo iguala al pasivo más el patrimonio,
   (2) de qué está hecho cada lado y (3) qué pesa. Una lista de cifras con
   porcentajes no comunica eso; esto sí. */

const mm = (v: number) => v.toLocaleString("es-CO", {
  minimumFractionDigits: Math.abs(v) >= 100 ? 0 : 1,
  maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1,
});

/** Azules para el activo · grises para el pasivo · verdes para el patrimonio.
 *  El color separa los tres bloques de la ecuación contable de un vistazo. */
const AZUL = ["#13286E", "#2B4FC4", "#5C7FE0", "#93AAEC", "#C3D0F5"];
const GRIS = ["#5E718D", "#8A94A6", "#AAB3C2", "#C7CDD8", "#DDE2EA"];
const VERDE = ["#1B7A3D", "#2F9A56", "#63BC85", "#A3D8B8"];

export default function BalanceVisual({ activo, pasivo, patrimonio }: {
  activo: { total: number; items: ItemComp[] };
  pasivo: { total: number; items: ItemComp[] };
  patrimonio: { total: number; items: ItemComp[] };
}) {
  const totalDer = pasivo.total + patrimonio.total;
  const escala = Math.max(activo.total, totalDer) || 1;

  return (
    <div>
      <div className="grid grid-cols-2 gap-5 items-end">
        <Columna
          titulo="Activo" subtitulo="lo que el fondo tiene"
          total={activo.total} escala={escala}
          bloques={[{ items: activo.items, colores: AZUL }]}
        />
        <Columna
          titulo="Pasivo y patrimonio" subtitulo="con qué está financiado"
          total={totalDer} escala={escala}
          bloques={[
            { items: pasivo.items, colores: GRIS, etiqueta: "Pasivo" },
            { items: patrimonio.items, colores: VERDE, etiqueta: "Patrimonio" },
          ]}
        />
      </div>
      <p className="text-[11.5px] text-faint mt-3 text-center">
        Las dos columnas miden lo mismo: el activo siempre iguala al pasivo más el patrimonio.
      </p>
    </div>
  );
}

function Columna({ titulo, subtitulo, total, escala, bloques }: {
  titulo: string; subtitulo: string; total: number; escala: number;
  bloques: { items: ItemComp[]; colores: string[]; etiqueta?: string }[];
}) {
  const ALTO = 300;
  const alto = (total / escala) * ALTO;
  const todos = bloques.flatMap((b, bi) =>
    b.items.map((it, i) => ({ ...it, color: b.colores[i % b.colores.length], grupo: b.etiqueta, bi })),
  );
  return (
    <div>
      <div className="mb-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{titulo}</div>
        <div className="text-[26px] font-bold tnum tracking-tight leading-tight">
          {mm(total)}<span className="text-[13px] font-semibold text-faint ml-1">Mill.</span>
        </div>
        <div className="text-[11.5px] text-faint">{subtitulo}</div>
      </div>
      <div className="rounded-xl overflow-hidden flex flex-col" style={{ height: alto, minHeight: 120 }}>
        {todos.map((it, i) => {
          const h = (it.valor / total) * 100;
          const grande = h > 11, medio = h > 6;
          return (
            <div
              key={`${it.nombre}-${i}`}
              className="relative flex items-center px-3 text-white overflow-hidden"
              style={{ height: `${Math.max(h, 1.4)}%`, background: it.color, minHeight: 3 }}
              title={`${it.nombre}: ${mm(it.valor)} Mill. (${(it.pct * 100).toFixed(0)}%)`}
            >
              {grande && (
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold leading-tight truncate">{it.nombre}</div>
                  <div className="text-[15px] font-bold tnum leading-tight">
                    {mm(it.valor)} <span className="text-[11px] font-medium opacity-80">· {(it.pct * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
              {!grande && medio && (
                <div className="text-[11px] font-semibold truncate">
                  {it.nombre} <span className="tnum opacity-90">{mm(it.valor)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* las porciones muy delgadas no caben rotuladas: van en una leyenda */}
      <div className="mt-2.5 space-y-1">
        {todos.filter((it) => (it.valor / total) * 100 <= 6).map((it, i) => (
          <div key={i} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: it.color }} />
            <span className="text-muted flex-1 truncate">{it.nombre}</span>
            <span className="tnum font-semibold">{mm(it.valor)}</span>
            <span className="text-faint tnum w-8 text-right">{(it.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
