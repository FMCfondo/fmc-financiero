"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { fmtCont } from "@/lib/format";

export type Nodo = {
  codigo: string; nombre: string; nivel: number; depth: number;
  valor: number; valorYtd?: number; hijos: Nodo[];
};

/* Presentación de estado financiero, no de hoja de cálculo.

   Convenciones que sigue (SAP/NetSuite/Dynamics y la práctica contable):
     · sangría por nivel del plan de cuentas, tope 4 niveles visibles
     · un nivel con hijos es un encabezado; su cifra es el subtotal del grupo
     · raya simple sobre el subtotal de cada grupo de primer nivel
     · negativos entre paréntesis; cero como raya; símbolo sólo en la 1ª línea
     · números a la derecha con cifras tabulares; texto a la izquierda
     · la raya DOBLE bajo el total general la pone la sección, no este árbol   */

/** Tope de niveles con sangría. SAP corta en 4 y agrupa lo demás bajo su padre;
 *  el plan de FMC tiene 6, y desplegar los 6 hace ilegible el informe. */
const MAX_SANGRIA = 4;

export default function StatementTree({
  lineas, showYtd = false, expandDepth = 1,
}: { lineas: Nodo[]; showYtd?: boolean; expandDepth?: number }) {
  return (
    <div className="text-sm">
      <div className="flex items-end px-5 py-2.5 text-[11px] uppercase tracking-wider text-faint border-b border-line">
        <div className="flex-1">Cuenta</div>
        {showYtd && <div className="w-36 text-right">Acumulado</div>}
        <div className="w-36 text-right">{showYtd ? "Del mes" : "Saldo"}</div>
      </div>
      {lineas.map((l, i) => (
        <Row key={l.codigo} n={l} showYtd={showYtd} expandDepth={expandDepth} primera={i === 0} />
      ))}
    </div>
  );
}

function Row({
  n, showYtd, expandDepth, primera = false,
}: { n: Nodo; showYtd: boolean; expandDepth: number; primera?: boolean }) {
  const [open, setOpen] = useState(n.depth < expandDepth);
  const has = n.hijos.length > 0;
  const esGrupo = n.depth === 0;
  const sangria = Math.min(n.depth, MAX_SANGRIA) * 16;

  return (
    <>
      <div
        className={`flex items-center px-5 transition-colors ${
          esGrupo
            ? "py-2.5 bg-card2/60 border-y border-line font-semibold text-fg"
            : "py-[7px] hover:bg-card2/70 border-b border-line-soft"
        }`}
      >
        <button
          onClick={() => has && setOpen((v) => !v)}
          className={`flex-1 flex items-center gap-2 text-left min-w-0 ${has ? "cursor-pointer" : "cursor-default"}`}
          style={{ paddingLeft: `${sangria}px` }}
          aria-expanded={has ? open : undefined}
        >
          {has ? (
            <ChevronRight size={13} className={`text-faint shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          ) : (
            <span className="w-[13px] shrink-0" />
          )}
          <span className="text-faint/70 tnum text-[10px] w-[76px] shrink-0 tracking-tight">{n.codigo}</span>
          <span className={`truncate ${esGrupo ? "" : "text-muted"}`}>{n.nombre}</span>
        </button>
        {showYtd && <Cifra v={n.valorYtd ?? 0} simbolo={primera} fuerte={esGrupo} sub={esGrupo} />}
        <Cifra v={n.valor} simbolo={primera} fuerte={esGrupo} sub={esGrupo} />
      </div>
      {open && has && n.hijos.map((h) => <Row key={h.codigo} n={h} showYtd={showYtd} expandDepth={expandDepth} />)}
    </>
  );
}

/** Fila de total de un estado. `doble` dibuja la raya doble bajo el total general:
 *  es la marca universal de "aquí termina el estado" y sólo va al pie de la columna. */
export function TotalRow({
  label, valores, doble = false, tono,
}: { label: string; valores: number[]; doble?: boolean; tono?: "pos" | "neg" }) {
  const color = tono === "pos" ? "text-pos" : tono === "neg" ? "text-neg" : "text-fg";
  return (
    <div className="flex items-center px-5 py-3 bg-card2">
      <span className="flex-1 font-semibold text-[13px] uppercase tracking-wide text-fg">{label}</span>
      {valores.map((v, i) => (
        <span
          key={i}
          className={`w-36 text-right tnum tabular-nums font-semibold ${color} ${
            doble ? "border-t border-b-[3px] border-double border-fg/60 py-0.5" : "border-t border-fg/40"
          }`}
        >
          {fmtCont(v, true)}
        </span>
      ))}
    </div>
  );
}

/** `sub` dibuja la raya simple sobre el subtotal, como en un informe impreso. */
function Cifra({ v, simbolo, fuerte, sub }: { v: number; simbolo: boolean; fuerte: boolean; sub: boolean }) {
  return (
    <div
      className={`w-36 text-right tnum tabular-nums ${fuerte ? "font-semibold text-fg" : "text-fg/90"} ${
        sub ? "border-t border-fg/25" : ""
      }`}
    >
      {fmtCont(v, simbolo)}
    </div>
  );
}
