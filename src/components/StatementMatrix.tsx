"use client";
import { useState } from "react";
import { fmtCont } from "@/lib/format";
import { useExpand, useExpandCtx, ExpandProvider, ExpandToggle, Concepto } from "@/components/statementShared";

/* Estado financiero multi-mes — el renderizador ANCLA del sistema visual.
   Árbol de cuentas en filas, meses en columnas. Convenciones de informe
   (paréntesis para negativos, regla simple sobre subtotal, doble bajo el total)
   con jerarquía sobria por peso y tinte. Cabecera y 1ª columna fijas; el estado
   expandido se recuerda por vista (localStorage). Ver globals.css → `.stmt`.

   Se presenta como un DOCUMENTO: la tarjeta lleva encima el encabezado del estado
   (entidad, nombre, período, unidad) y la tabla debajo; el mes de corte va
   iluminado (`resaltar`) y el acumulado en su recuadro. */

export type NodoM = {
  codigo: string; nombre: string; depth: number;
  vals: (number | null)[]; acum: number | null; hijos: NodoM[];
};
export type FilaPlano = { nombre: string; vals: (number | null)[]; acum?: number | null; tipo?: "linea" | "sub" | "total" };
type Seccion = { titulo: string; tono?: string; arbol: NodoM[]; extra?: FilaPlano[]; totalLabel: string; totalVals: (number | null)[]; totalAcum?: number | null };

export type Encabezado = { titulo: string; periodo: string; unidad: string; entidad?: string };

/** El encabezado del documento. También lo usan los estados que arman su propia tabla. */
export function EncabezadoEstado({ titulo, periodo, unidad, entidad = "FMC S.A.S. · Fondo Mutuo de Cobertura", derecha }: Encabezado & { derecha?: React.ReactNode }) {
  return (
    <div className="stmt-doc">
      <div>
        <div className="doc-entidad">{entidad}</div>
        <div className="doc-titulo">{titulo}</div>
      </div>
      <div className="doc-derecha">
        <div className="doc-periodo">{periodo}</div>
        <div className="doc-unidad">{unidad}</div>
        {derecha}
      </div>
    </div>
  );
}

/** Sombras de desplazamiento: la columna fija y la cabecera solo proyectan sombra
 *  cuando de verdad hay contenido debajo de ellas. */
export function useSombrasScroll() {
  const [sx, setSx] = useState(false);
  const [sy, setSy] = useState(false);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setSx(el.scrollLeft > 0);
    setSy(el.scrollTop > 0);
  };
  return { onScroll, "data-sx": sx ? "1" : undefined, "data-sy": sy ? "1" : undefined } as const;
}

export default function StatementMatrix({
  labels, secciones, conAcum, filasFinales = [], col1Label = "Cuenta", resaltar, encabezado,
}: {
  labels: string[];
  secciones: Seccion[];
  conAcum: boolean;
  filasFinales?: FilaPlano[];
  col1Label?: string;
  /** Índice de la columna del mes de corte (se ilumina). */
  resaltar?: number;
  encabezado?: Encabezado;
}) {
  const ctx = useExpand(secciones.map((s) => s.arbol));
  const nCols = labels.length + (conAcum ? 1 : 0) + 1;
  const scroll = useSombrasScroll();
  const num = (i: number) => `num${i === resaltar ? " corte" : ""}`;
  return (
    <ExpandProvider ctx={ctx}>
      <div className="space-y-2">
        {!encabezado && <ExpandToggle ctx={ctx} />}
        <div className="card overflow-hidden">
          {encabezado && <EncabezadoEstado {...encabezado} derecha={<div className="mt-1.5"><ExpandToggle ctx={ctx} /></div>} />}
          <div className="stmt" {...scroll}>
            <table>
              <thead>
                <tr>
                  <th className="col1">{col1Label}</th>
                  {labels.map((l, i) => <th key={l} className={num(i)}>{l}</th>)}
                  {conAcum && <th className="num num-acc">Acumulado</th>}
                </tr>
              </thead>
              <tbody>
                {secciones.map((s) => <Seccion key={s.titulo} s={s} conAcum={conAcum} nCols={nCols} num={num} />)}
                {filasFinales.map((f) => <FilaPlana key={f.nombre} f={f} conAcum={conAcum} num={num} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ExpandProvider>
  );
}

type Num = (i: number) => string;

function Seccion({ s, conAcum, nCols, num }: { s: Seccion; conAcum: boolean; nCols: number; num: Num }) {
  return (
    <>
      {/* El rótulo va en la celda fija; el resto de la fila es relleno con la misma banda. */}
      <tr className="section">
        <td className="col1">
          <span className="sec-label">
            {s.tono && <span className={`sec-dot ${s.tono}`} />}
            {s.titulo}
          </span>
        </td>
        <td colSpan={nCols - 1} className="sec-fill" />
      </tr>
      {s.arbol.map((n) => <Fila key={n.codigo} n={n} conAcum={conAcum} num={num} />)}
      {(s.extra ?? []).map((f) => <FilaPlana key={f.nombre} f={f} conAcum={conAcum} num={num} italica />)}
      <FilaPlana f={{ nombre: s.totalLabel, vals: s.totalVals, acum: s.totalAcum, tipo: "sub" }} conAcum={conAcum} num={num} />
    </>
  );
}

function Fila({ n, conAcum, num }: { n: NodoM; conAcum: boolean; num: Num }) {
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
          <td key={i} className={`${num(i)} ${esGrupo ? "text-fg" : "text-fg/85"}`}>{v === null ? "—" : fmtCont(v)}</td>
        ))}
        {conAcum && <td className="num num-acc font-medium">{fmtCont(n.acum ?? 0)}</td>}
      </tr>
      {open && n.hijos.map((h) => <Fila key={h.codigo} n={h} conAcum={conAcum} num={num} />)}
    </>
  );
}

function FilaPlana({ f, conAcum, num, italica }: { f: FilaPlano; conAcum: boolean; num: Num; italica?: boolean }) {
  const total = f.tipo === "total";
  const sub = f.tipo === "sub";
  const cls = total ? "total" : sub ? "subtotal" : "row";
  const rule = total ? "rule-total" : sub ? "rule-sub" : "";
  // Sin valor no hay regla: una raya con doble subrayado se lee como un dato.
  const cell = (v: number | null, acumCol = false) => (
    <span className={v === null ? "" : rule}>{v === null ? "—" : fmtCont(v, total && !acumCol)}</span>
  );
  return (
    <tr className={cls}>
      <td className={`col1 ${italica ? "italic text-muted" : ""}`}>{f.nombre}</td>
      {f.vals.map((v, i) => <td key={i} className={num(i)}>{cell(v)}</td>)}
      {conAcum && <td className="num num-acc">{cell(f.acum ?? null, true)}</td>}
    </tr>
  );
}
