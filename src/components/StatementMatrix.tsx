"use client";
import { useEffect, useState } from "react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { fmtCont } from "@/lib/format";

/* Estado financiero multi-mes: árbol de cuentas en filas, meses en columnas.
   Sigue las mismas convenciones de informe que StatementTree (paréntesis, raya
   simple sobre subtotal, doble bajo el total, tope de 4 sangrías) y añade:
     · una columna por mes, de izquierda a derecha
     · columna de Acumulado en un recuadro aparte (sólo si `acum`, p. ej. el ER)
     · primera columna fija al hacer scroll horizontal                         */

export type NodoM = {
  codigo: string; nombre: string; depth: number;
  vals: number[]; acum: number | null; hijos: NodoM[];
};

const MAX_SANGRIA = 4;
const CELL = "px-3 py-[7px] text-right tnum tabular-nums whitespace-nowrap";
const ACUM = "border-l-2 border-line bg-card2/70";

export type FilaPlano = { nombre: string; vals: (number | null)[]; acum?: number | null; tipo?: "linea" | "sub" | "total" };

type Senal = { v: number; abierto: boolean };

export default function StatementMatrix({
  labels, secciones, conAcum, filasFinales = [],
}: {
  labels: string[];
  secciones: { titulo: string; tono?: string; arbol: NodoM[]; extra?: FilaPlano[]; totalLabel: string; totalVals: number[]; totalAcum?: number | null }[];
  conAcum: boolean;
  filasFinales?: FilaPlano[];
}) {
  // Expandir/contraer TODOS los grupos de 2 dígitos a la vez (el clic manual
  // por fila sigue funcionando: la señal solo empuja un cambio puntual).
  const [senal, setSenal] = useState<Senal>({ v: 0, abierto: true });
  return (
    <div className="space-y-2">
      <button
        onClick={() => setSenal((s) => ({ v: s.v + 1, abierto: !s.abierto }))}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-muted hover:text-fg hover:bg-card2 transition-colors"
      >
        {senal.abierto ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
        {senal.abierto ? "Contraer grupos" : "Expandir grupos"}
      </button>
    <div className="card overflow-auto">
      <table className="text-sm border-collapse w-max min-w-full">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted">
            <th className="sticky left-0 z-10 bg-card text-left font-normal px-5 py-2.5 border-b border-line min-w-[280px]">Cuenta</th>
            {labels.map((l) => (
              <th key={l} className="text-right font-normal px-3 py-2.5 border-b border-line min-w-[118px]">{l}</th>
            ))}
            {conAcum && <th className={`text-right font-semibold px-4 py-2.5 border-b border-line min-w-[132px] ${ACUM}`}>Acumulado</th>}
          </tr>
        </thead>
        <tbody>
          {secciones.map((s) => (
            <Seccion key={s.titulo} s={s} conAcum={conAcum} nCols={labels.length} senal={senal} />
          ))}
          {filasFinales.map((f) => (
            <FilaPlana key={f.nombre} f={f} conAcum={conAcum} />
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function Seccion({ s, conAcum, nCols, senal }: {
  s: { titulo: string; tono?: string; arbol: NodoM[]; extra?: FilaPlano[]; totalLabel: string; totalVals: number[]; totalAcum?: number | null };
  conAcum: boolean; nCols: number; senal: Senal;
}) {
  return (
    <>
      <tr>
        <td colSpan={nCols + (conAcum ? 2 : 1)} className="px-5 py-2.5 bg-card2 border-y border-line">
          <span className="flex items-center gap-2 font-semibold">
            {s.tono && <span className={`w-1.5 h-4 rounded ${s.tono}`} />}
            {s.titulo}
          </span>
        </td>
      </tr>
      {s.arbol.map((n) => <Fila key={n.codigo} n={n} conAcum={conAcum} senal={senal} />)}
      {(s.extra ?? []).map((f) => <FilaPlana key={f.nombre} f={f} conAcum={conAcum} italica />)}
      <FilaPlana f={{ nombre: s.totalLabel, vals: s.totalVals, acum: s.totalAcum, tipo: "total" }} conAcum={conAcum} />
    </>
  );
}

function Fila({ n, conAcum, senal }: { n: NodoM; conAcum: boolean; senal: Senal }) {
  const [open, setOpen] = useState(n.depth < 1);
  // La señal global solo mueve los grupos de primer nivel (los de 2 dígitos).
  useEffect(() => {
    if (n.depth === 0) setOpen(senal.abierto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senal.v]);
  const has = n.hijos.length > 0;
  const esGrupo = n.depth === 0;
  const sangria = Math.min(n.depth, MAX_SANGRIA) * 14;
  return (
    <>
      <tr className={esGrupo ? "bg-card2/50 font-medium" : "hover:bg-card2/60"}>
        <td className={`sticky left-0 z-10 px-5 py-[7px] border-b border-line-soft ${esGrupo ? "bg-card2" : "bg-card"}`}>
          <button
            onClick={() => has && setOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-left w-full min-w-0 ${has ? "cursor-pointer" : "cursor-default"}`}
            style={{ paddingLeft: `${sangria}px` }}
            aria-expanded={has ? open : undefined}
          >
            {has ? (
              <ChevronRight size={13} className={`text-faint shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
            ) : (
              <span className="w-[13px] shrink-0" />
            )}
            <span className="text-faint/70 tnum text-[10px] w-[72px] shrink-0 tracking-tight">{n.codigo}</span>
            <span className={`truncate ${esGrupo ? "text-fg" : "text-muted"}`}>{n.nombre}</span>
          </button>
        </td>
        {n.vals.map((v, i) => (
          <td key={i} className={`${CELL} border-b border-line-soft ${esGrupo ? "font-medium" : "text-fg/90"}`}>{fmtCont(v)}</td>
        ))}
        {conAcum && <td className={`${CELL} border-b border-line-soft font-medium ${ACUM}`}>{fmtCont(n.acum ?? 0)}</td>}
      </tr>
      {open && has && n.hijos.map((h) => <Fila key={h.codigo} n={h} conAcum={conAcum} senal={senal} />)}
    </>
  );
}

function FilaPlana({ f, conAcum, italica }: { f: FilaPlano; conAcum: boolean; italica?: boolean }) {
  const total = f.tipo === "total";
  const sub = f.tipo === "sub";
  const num = (v: number | null, acumCol = false) => (
    <span className={`inline-block ${total ? "border-t border-b-[3px] border-double border-fg/60 py-0.5" : sub ? "border-t border-fg/30" : ""}`}>
      {v === null ? "—" : fmtCont(v, total && !acumCol)}
    </span>
  );
  return (
    <tr className={total ? "bg-card2 font-semibold" : sub ? "bg-card2/50 font-medium" : ""}>
      <td className={`sticky left-0 z-10 px-5 py-2.5 border-b border-line ${total ? "bg-card2 uppercase text-[13px] tracking-wide" : sub ? "bg-card2/70" : "bg-card"} ${italica ? "italic text-muted" : ""}`}>
        {f.nombre}
      </td>
      {f.vals.map((v, i) => (
        <td key={i} className={`${CELL} border-b border-line`}>{num(v)}</td>
      ))}
      {conAcum && <td className={`${CELL} border-b border-line ${ACUM}`}>{num(f.acum ?? null, true)}</td>}
    </tr>
  );
}
