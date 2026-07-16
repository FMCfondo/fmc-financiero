"use client";
import { useExpand, useExpandCtx, ExpandProvider, ExpandToggle, Concepto } from "@/components/statementShared";

/* Análisis vertical / horizontal — misma piel que el Estado (sistema `.stmt`).
   Vertical   → participación sobre la base del período (número sobrio).
   Horizontal → variación contra el comparativo, con indicador discreto
                (▲/▼ + número tenue), nunca colores chillones. */

export type NodoPct = { codigo: string; nombre: string; depth: number; vals: (number | null)[]; hijos: NodoPct[] };
export type FilaFinalPct = { nombre: string; vals: (number | null)[]; tipo?: "sub" | "total" };
type Seccion = { titulo: string; arbol: NodoPct[]; totalVals: (number | null)[] };

function fmt(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = a.toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: a < 10 ? 1 : 0 });
  return v < 0 ? `(${s})%` : `${s}%`;
}

/* Celda de valor: en horizontal, indicador discreto; en vertical, texto plano. */
function Val({ v, colorear }: { v: number | null; colorear?: boolean }) {
  if (!colorear || v === null || !Number.isFinite(v)) return <span className="text-fg/85">{fmt(v)}</span>;
  const dir = v > 0.05 ? "pos" : v < -0.05 ? "neg" : "flat";
  const tri = dir === "pos" ? "▲" : dir === "neg" ? "▼" : "▪";
  return (
    <span className={`delta delta-${dir} justify-end`}>
      <span className="tri">{tri}</span>{fmt(v)}
    </span>
  );
}

export default function AnalisisMatrix({
  labels, secciones, colorear, filasFinales = [], persistKey,
}: {
  labels: string[];
  secciones: Seccion[];
  colorear?: boolean;
  filasFinales?: FilaFinalPct[];
  persistKey?: string;
}) {
  const ctx = useExpand(secciones.map((s) => s.arbol), persistKey);
  const nCols = labels.length + 1;
  return (
    <ExpandProvider ctx={ctx}>
      <div className="space-y-2">
        <ExpandToggle ctx={ctx} />
        <div className="stmt card">
          <table>
            <thead>
              <tr>
                <th className="col1">Cuenta</th>
                {labels.map((l) => <th key={l} className="num">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {secciones.map((s) => <Seccion key={s.titulo} s={s} nCols={nCols} colorear={colorear} />)}
              {filasFinales.map((f) => <FilaFinal key={f.nombre} f={f} colorear={colorear} />)}
            </tbody>
          </table>
        </div>
      </div>
    </ExpandProvider>
  );
}

function Seccion({ s, nCols, colorear }: { s: Seccion; nCols: number; colorear?: boolean }) {
  return (
    <>
      <tr className="section">
        <td colSpan={nCols} className="col1"><span className="sec-label">{s.titulo}</span></td>
      </tr>
      {s.arbol.map((n) => <Fila key={n.codigo} n={n} colorear={colorear} />)}
      <tr className="subtotal">
        <td className="col1">Total {s.titulo.toLowerCase()}</td>
        {s.totalVals.map((v, i) => <td key={i} className="num"><span className="border-t border-fg/25 inline-block"><Val v={v} colorear={colorear} /></span></td>)}
      </tr>
    </>
  );
}

function Fila({ n, colorear }: { n: NodoPct; colorear?: boolean }) {
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
        {n.vals.map((v, i) => <td key={i} className="num"><Val v={v} colorear={colorear} /></td>)}
      </tr>
      {open && n.hijos.map((h) => <Fila key={h.codigo} n={h} colorear={colorear} />)}
    </>
  );
}

function FilaFinal({ f, colorear }: { f: FilaFinalPct; colorear?: boolean }) {
  const total = f.tipo === "total";
  const sub = f.tipo === "sub";
  const cls = total ? "total" : sub ? "subtotal" : "row";
  const rule = total ? "border-t border-fg/45 border-b-[3px] border-double border-fg/45 py-0.5" : sub ? "border-t border-fg/25" : "";
  return (
    <tr className={cls}>
      <td className="col1">{f.nombre}</td>
      {f.vals.map((v, i) => <td key={i} className="num"><span className={`inline-block ${rule}`}><Val v={v} colorear={colorear} /></span></td>)}
    </tr>
  );
}
