"use client";
import { useMemo } from "react";
import { fmtCont } from "@/lib/format";
import StmtScroll from "@/components/StmtScroll";
import { useExpand, useExpandCtx, ExpandProvider, ExpandToggle, Concepto } from "@/components/statementShared";
import { CabeceraDocumento, Fila, FilaPlana, type Encabezado, type Num } from "@/components/StatementMatrix";
import type { LineaER } from "@/lib/er-junta";

/* El Estado de Resultados con las líneas del Informe de Junta. Las líneas de detalle se
   despliegan en sus cuentas del PUC (con el mismo `Fila` del árbol de cuentas); las de
   subtotal y total no se despliegan, porque son la suma de otras líneas. Abre compacto,
   como todos los estados. */

export default function ResultadosJunta({ labels, lineas, resaltar, encabezado }: {
  labels: string[]; lineas: LineaER[]; resaltar?: number; encabezado: Encabezado;
}) {
  // Cada línea es un grupo para «Expandir todo»; su clave no choca con ninguna cuenta.
  const arboles = useMemo(() => [lineas.map((l) => ({ codigo: l.clave, depth: 0, hijos: l.hijos }))], [lineas]);
  const ctx = useExpand(arboles);
  const num: Num = (i) => `num${i === resaltar ? " corte" : ""}`;
  return (
    <ExpandProvider ctx={ctx}>
      <div className="card overflow-hidden">
        <CabeceraDocumento {...encabezado} derecha={<div className="mt-1.5"><ExpandToggle ctx={ctx} /></div>} />
        <StmtScroll>
          <table>
            <thead>
              <tr>
                <th className="col1">Concepto</th>
                {labels.map((l, i) => <th key={l} className={num(i)}>{l}</th>)}
                <th className="num num-acc">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => <Linea key={l.clave} l={l} num={num} />)}
            </tbody>
          </table>
        </StmtScroll>
      </div>
    </ExpandProvider>
  );
}

function Linea({ l, num }: { l: LineaER; num: Num }) {
  const ctx = useExpandCtx();
  if (l.nivel !== "det") {
    return <FilaPlana f={{ nombre: `${l.signo} ${l.etiqueta}`, vals: l.vals, acum: l.acum, tipo: l.nivel === "tot" ? "total" : "sub" }} conAcum num={num} />;
  }
  const has = l.hijos.length > 0;
  const open = has && ctx.isOpen(l.clave);
  return (
    <>
      <tr className="row group">
        <td className="col1">
          {/* El signo va donde el árbol pone el código, como la columna de signos del informe. */}
          <Concepto codigo={l.signo} nombre={l.etiqueta} depth={0} esGrupo has={has} open={open} onToggle={() => ctx.toggle(l.clave)} />
        </td>
        {l.vals.map((v, i) => <td key={i} className={`${num(i)} text-fg`}>{fmtCont(v)}</td>)}
        <td className="num num-acc font-medium">{fmtCont(l.acum)}</td>
      </tr>
      {open && l.hijos.map((h) => <Fila key={h.codigo} n={h} conAcum num={num} />)}
    </>
  );
}
