import { accesoA } from "@/lib/permisos";
import { cambiosPatrimonio } from "@/lib/statements";
import { ensureLoaded, periodos, periodo, resolverEtq } from "@/lib/data";
import { etqNombre } from "@/lib/periodos";
import { fmtNum } from "@/lib/format";
import AnioSelector from "@/components/AnioSelector";
import { EncabezadoEstado } from "@/components/StatementMatrix";

export default async function PatrimonioPage({ searchParams }: { searchParams: Promise<{ p?: string; anio?: string }> }) {
  await accesoA("/estados/patrimonio");
  const { p, anio } = await searchParams;
  await ensureLoaded();
  const etqBase = resolverEtq(p);
  const nAnio = anio === "ultimos" ? undefined : (parseInt(anio || "") || periodo(etqBase).anio);
  // Con año seleccionado, el estado corre hasta el último mes disponible de ese año.
  const delAnio = nAnio ? periodos.filter((q) => q.anio === nAnio) : [];
  const etq = delAnio.length ? delAnio[delAnio.length - 1].etiqueta : etqBase;
  const c = cambiosPatrimonio(etq);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5 flex-wrap">
        <p className="text-sm text-muted">
          {etqNombre(etq)} · acumulado del año{c.ini ? ` (desde ${etqNombre(c.ini)})` : ""} · pesos colombianos
        </p>
        <AnioSelector current={nAnio} />
      </div>

      <div className="card overflow-hidden">
        <EncabezadoEstado
          titulo="Estado de Cambios en el Patrimonio"
          periodo={`${c.ini ? `${etqNombre(c.ini)} – ` : ""}${etqNombre(etq)}`}
          unidad="Acumulado del año · pesos colombianos"
        />
        <div className="stmt" style={{ ["--stmt-col1" as string]: "300px" }}>
        <table>
          <thead>
            <tr>
              <th className="col1">Concepto</th>
              {c.comps.map((comp) => <th key={comp.codigo} className="num">{comp.nombre}</th>)}
              <th className="num num-acc">Total</th>
            </tr>
          </thead>
          <tbody>
            <MRow label="Saldo inicial" vals={c.comps.map((x) => x.inicial)} total={c.totalInicial} />
            <MRow label="Movimientos del patrimonio (aportes, reservas…)" vals={c.comps.map((x) => x.movimiento)} total={c.totalFinalBase - c.totalInicial} />
            <MRow label="Saldo final del patrimonio contable" vals={c.comps.map((x) => x.final)} total={c.totalFinalBase} tipo="subtotal" />
            <MRow label="(+) Utilidad del ejercicio" vals={c.comps.map(() => null)} total={c.resultado} />
            <MRow label="Patrimonio total (incluye utilidad)" vals={c.comps.map(() => null)} total={c.totalFinal} tipo="total" />
          </tbody>
        </table>
        </div>
      </div>

      <p className="stmt-nota">
        La utilidad del ejercicio ({fmtNum(c.resultado)}) aún no está cerrada en las cuentas de patrimonio; se muestra por separado y se suma al patrimonio total.
      </p>
    </div>
  );
}

function MRow({ label, vals, total, tipo }: { label: string; vals: (number | null)[]; total: number; tipo?: "subtotal" | "total" }) {
  const isTotal = tipo === "total";
  const rule = isTotal ? "rule-total" : tipo === "subtotal" ? "rule-sub" : "";
  return (
    <tr className={tipo === "total" ? "total" : tipo === "subtotal" ? "subtotal" : "row"}>
      <td className="col1">{label}</td>
      {vals.map((v, i) => (
        <td key={i} className={`num ${v !== null && v < 0 ? "text-neg" : ""}`}>
          <span className={v === null ? "" : rule}>{v === null ? "—" : fmtNum(v)}</span>
        </td>
      ))}
      <td className="num num-acc"><span className={`font-semibold ${rule}`}>{fmtNum(total)}</span></td>
    </tr>
  );
}
