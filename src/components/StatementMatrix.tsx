"use client";
import { fmtCont } from "@/lib/format";
import { useExpand, useExpandCtx, ExpandProvider, ExpandToggle, Concepto } from "@/components/statementShared";

/* Estado financiero multi-mes — el renderizador ANCLA del sistema visual.
   Árbol de cuentas en filas, meses en columnas. Convenciones de informe
   (paréntesis para negativos, regla simple sobre subtotal, doble bajo el total)
   con jerarquía sobria por peso y tinte. Cabecera y 1ª columna fijas; el estado
   expandido se recuerda por vista (localStorage). Ver globals.css → `.stmt`. */

export type NodoM = {
  codigo: string; nombre: string; depth: number;
  vals: (number | null)[]; acum: number | null; hijos: NodoM[];
};
export type FilaPlano = { nombre: string; vals: (number | null)[]; acum?: number | null; tipo?: "linea" | "sub" | "total" };
type Seccion = { titulo: string; tono?: string; arbol: NodoM[]; extra?: FilaPlano[]; totalLabel: string; totalVals: (number | null)[]; totalAcum?: number | null };

export default function StatementMatrix({
  labels, secciones, conAcum, filasFinales = [], persistKey, col1Label = "Cuenta",
}: {
  labels: string[];
  secciones: Seccion[];
  conAcum: boolean;
  filasFinales?: FilaPlano[];
  persistKey?: string;
  col1Label?: string;
}) {
  const ctx = useExpand(secciones.map((s) => s.arbol), persistKey);
  const nCols = labels.length + (conAcum ? 1 : 0) + 1;
  return (
    <ExpandProvider ctx={ctx}>
      <div className="space-y-2">
        <ExpandToggle ctx={ctx} />
        <div className="stmt card">
          <table>
            <thead>
              <tr>
                <th className="col1">{col1Label}</th>
                {labels.map((l) => <th key={l} className="num">{l}</th>)}
                {conAcum && <th className="num num-acc">Acumulado</th>}
              </tr>
            </thead>
            <tbody>
              {secciones.map((s) => <Seccion key={s.titulo} s={s} conAcum={conAcum} nCols={nCols} />)}
              {filasFinales.map((f) => <FilaPlana key={f.nombre} f={f} conAcum={conAcum} />)}
            </tbody>
          </table>
        </div>
      </div>
    </ExpandProvider>
  );
}

function Seccion({ s, conAcum, nCols }: { s: Seccion; conAcum: boolean; nCols: number }) {
  return (
    <>
      <tr className="section">
        <td colSpan={nCols} className="col1">
          <span className="sec-label">
            {s.tono && <span className={`sec-dot ${s.tono}`} />}
            {s.titulo}
          </span>
        </td>
      </tr>
      {s.arbol.map((n) => <Fila key={n.codigo} n={n} conAcum={conAcum} />)}
      {(s.extra ?? []).map((f) => <FilaPlana key={f.nombre} f={f} conAcum={conAcum} italica />)}
      <FilaPlana f={{ nombre: s.totalLabel, vals: s.totalVals, acum: s.totalAcum, tipo: "sub" }} conAcum={conAcum} />
    </>
  );
}

function Fila({ n, conAcum }: { n: NodoM; conAcum: boolean }) {
  const ctx = useExpandCtx();
  const has = n.hijos.length > 0;
  const open = has && ctx.isOpen(n.codigo);
  const esGrupo = n.depth === 0;
  return (
    <>
      <tr className={`row ${esGrupo ? "group" : ""}`}>
        <td className="col1">
          <Concepto codigo={n.codigo} nombre={n.nombre} depth={n.depth} esGrupo={esGrupo} has={has} open={open} onToggle={() => ctx.toggle(n.codigo)} />
        </td>
        {n.vals.map((v, i) => (
          <td key={i} className={`num ${esGrupo ? "text-fg font-medium" : "text-fg/90"}`}>{v === null ? "—" : fmtCont(v)}</td>
        ))}
        {conAcum && <td className="num num-acc font-medium">{fmtCont(n.acum ?? 0)}</td>}
      </tr>
      {open && n.hijos.map((h) => <Fila key={h.codigo} n={h} conAcum={conAcum} />)}
    </>
  );
}

function FilaPlana({ f, conAcum, italica }: { f: FilaPlano; conAcum: boolean; italica?: boolean }) {
  const total = f.tipo === "total";
  const sub = f.tipo === "sub";
  const cls = total ? "total" : sub ? "subtotal" : "row";
  const rule = total ? "border-t border-fg/45 border-b-[3px] border-double border-fg/45 py-0.5" : sub ? "border-t border-fg/25" : "";
  const cell = (v: number | null, acumCol = false) => (
    <span className={`inline-block ${rule}`}>{v === null ? "—" : fmtCont(v, total && !acumCol)}</span>
  );
  return (
    <tr className={cls}>
      <td className={`col1 ${italica ? "italic text-muted" : ""}`}>{f.nombre}</td>
      {f.vals.map((v, i) => <td key={i} className="num">{cell(v)}</td>)}
      {conAcum && <td className="num num-acc">{cell(f.acum ?? null, true)}</td>}
    </tr>
  );
}
