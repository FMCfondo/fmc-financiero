"use client";
import { fmtCont } from "@/lib/format";
import type { FilaResultados } from "@/lib/informe-tipos";
import { CabeceraDocumento, useSombrasScroll } from "@/components/StatementMatrix";

/* EJECUCIÓN PRESUPUESTAL en pantalla: la MISMA hoja que imprime el Informe de Junta
   (páginas 5 a 7), con la piel de los estados financieros. Las filas llegan del
   ensamblador del informe (`ejecucionPresupuestal` en informe.ts): aquí no se calcula
   nada, se presenta.

   Columnas: lo EJECUTADO (el mes y el acumulado) y LAS TRES EJECUCIONES, que son medidas
   distintas y nunca se mezclan en la misma columna:
     · del mes     → el mes contra el presupuesto de ESE mes
     · acumulada   → enero..mes contra el presupuesto del mismo tramo
     · del año     → enero..mes contra el presupuesto anual completo
   Cada bloque lleva su título y su definición escrita en la cabecera, y una columna
   estrecha lo separa del siguiente. El semáforo del porcentaje se invierte en gastos y
   provisiones: superar la meta ahí es malo. */

type Props = {
  titulo: string;
  periodo: string;
  unidad: string;
  mesNombre: string;
  filas: FilaResultados[];
  /** Fila de total que encabeza la tabla (el detalle de gastos arranca con su total). */
  encabezaCon?: FilaResultados | null;
  nota?: string;
};

type Bloque = {
  k: string; clase: string; titulo: string; def: string;
  ppto: (f: FilaResultados) => number | null;
  ej: (f: FilaResultados) => number | null;
};

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v).toLocaleString("es-CO")}%`);
const tono = (v: number | null, esGasto?: boolean) => {
  if (v === null) return "";
  const bien = esGasto ? v <= 100 : v >= 100;
  return bien ? " pos" : " neg";
};

export default function EjecucionInforme({ titulo, periodo, unidad, mesNombre, filas, encabezaCon, nota }: Props) {
  const scroll = useSombrasScroll();
  const mes = mesNombre.toLowerCase();
  const bloques: Bloque[] = [
    { k: "mes", clase: "b-mes", titulo: "Ejecución del mes", def: `${mes} vs. presupuesto de ${mes}`, ppto: (f) => f.pptoMes, ej: (f) => f.ejecMesPct },
    { k: "acum", clase: "b-acum", titulo: "Ejecución acumulada", def: `enero–${mes} vs. presupuesto del mismo período`, ppto: (f) => f.pptoAcumulado, ej: (f) => f.ejecAcumuladaPct },
    { k: "anio", clase: "b-anio", titulo: "Ejecución del año", def: `enero–${mes} vs. presupuesto anual completo`, ppto: (f) => f.pptoAnual, ej: (f) => f.ejecAnualPct },
  ];

  return (
    <div className="space-y-2">
      <div className="card overflow-hidden">
        <CabeceraDocumento titulo={titulo} periodo={periodo} unidad={unidad} />
        <div className="stmt dos-filas" {...scroll}>
          <table>
            <thead>
              <tr className="grupos">
                <th className="col1" rowSpan={2}>Concepto</th>
                <th colSpan={2} className="ejecutado">Ejecutado</th>
                {bloques.map((b) => (
                  <Separado key={b.k} th>
                    <th colSpan={2} className={b.clase}>
                      <span className="g-titulo">{b.titulo}</span>
                      <span className="g-def">{b.def}</span>
                    </th>
                  </Separado>
                ))}
              </tr>
              <tr>
                <th className="num ejecutado corte">{mesNombre}</th>
                <th className="num ejecutado">Acumulado</th>
                {bloques.map((b) => (
                  <Separado key={b.k} th>
                    <th className={`num ${b.clase}`}>Presupuesto</th>
                    <th className={`num ${b.clase}`}>% ejec.</th>
                  </Separado>
                ))}
              </tr>
            </thead>
            <tbody>
              {encabezaCon && <FilaEjec f={{ ...encabezaCon, nivel: "tot", signo: undefined }} bloques={bloques} />}
              {filas.map((f, i) => <FilaEjec key={`${f.etiqueta}-${i}`} f={f} bloques={bloques} />)}
            </tbody>
          </table>
        </div>
      </div>
      <p className="stmt-nota">
        Los tres porcentajes miden cosas distintas y no se comparan entre sí: {bloques.map((b) => `${b.titulo.replace("Ejecución ", "")}: ${b.def}`).join(" · ")}.
        {nota ? ` ${nota}` : ""}
      </p>
    </div>
  );
}

function FilaEjec({ f, bloques }: { f: FilaResultados; bloques: Bloque[] }) {
  if (f.nivel === "hdr") {
    return (
      <tr className="section">
        <td className="col1"><span className="sec-label">{f.etiqueta}</span></td>
        <td colSpan={2 + bloques.length * 3} className="sec-fill" />
      </tr>
    );
  }
  const clase = f.nivel === "tot" ? "total" : f.nivel === "sub" || f.nivel === "sec" ? "subtotal" : "row";
  const regla = f.nivel === "tot" ? "rule-total" : f.nivel === "sub" || f.nivel === "sec" ? "rule-sub" : "";
  const sinReal = f.signo === "—"; // subcuenta sin cuenta PUC: raya, nunca cero
  const val = (v: number | null, conSimbolo = false) => (
    <span className={v === null ? "" : regla}>{v === null ? "—" : fmtCont(v, conSimbolo)}</span>
  );
  return (
    <tr className={clase}>
      <td className={`col1${f.sangria ? " sangria" : ""}`}>
        {f.signo && !sinReal && <span className="signo">{f.signo}</span>}
        {f.etiqueta}
      </td>
      <td className="num ejecutado corte">{sinReal ? "—" : val(f.mes, f.nivel === "tot")}</td>
      <td className="num ejecutado">{sinReal ? "—" : val(f.acumulado, f.nivel === "tot")}</td>
      {bloques.map((b) => {
        const meta = b.ppto(f);
        const e = sinReal ? null : b.ej(f);
        return (
          <Separado key={b.k}>
            <td className={`num ${b.clase}`}>{meta === null ? "—" : val(meta)}</td>
            <td className={`num pct ${b.clase}${tono(e, f.esGasto)}`}>{pct(e)}</td>
          </Separado>
        );
      })}
    </tr>
  );
}

/** Una columna estrecha delante de cada bloque, que lo separa del anterior. */
function Separado({ children, th }: { children: React.ReactNode; th?: boolean }) {
  return (
    <>
      {th ? <th className="gap" /> : <td className="gap" />}
      {children}
    </>
  );
}
