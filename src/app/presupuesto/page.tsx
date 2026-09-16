import { soloAdmin } from "@/lib/permisos";
import Link from "next/link";
import { ensureLoaded, presupuesto, periodos } from "@/lib/data";
import { presupuestoArbol, lineasMapeo } from "@/lib/presupuesto";
import { fmtCOP, fmtM } from "@/lib/format";
import PresupuestoCarga from "@/components/PresupuestoCarga";
import PresupuestoMatrix from "@/components/PresupuestoMatrix";
import MapeoEditor from "@/components/MapeoEditor";
import { CalendarRange, Table2, Link2, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

/* PRESUPUESTO — el plan anual de la Junta, completo, en su propio módulo (Operación).
   Tres pestañas:
   · Plan anual: la hoja del presupuesto tal cual, por meses, expandible.
   · Mapeo de cuentas: a qué cuentas contables corresponde cada rubro (es lo que llena el
     «real» de la ejecución y del informe).
   · Cargar: el estado de cada año y la carga de uno nuevo desde la hoja «PPTO <año>».
   Hasta el 2026-09-16 el plan y el mapeo vivían como vistas del Estado de Resultados;
   el usuario los quiso aquí («para eso integramos el módulo de presupuesto»). La
   ejecución contra el plan sigue en Estados Financieros › Resultados. */

type Vista = "plan" | "mapeo" | "cargar";
const VISTAS: { id: Vista; label: string; Icon: typeof Table2 }[] = [
  { id: "plan", label: "Plan anual", Icon: Table2 },
  { id: "mapeo", label: "Mapeo de cuentas", Icon: Link2 },
  { id: "cargar", label: "Cargar", Icon: Upload },
];

export default async function PresupuestoPage({ searchParams }: { searchParams: Promise<{ v?: string; anio?: string }> }) {
  await soloAdmin();
  const { v, anio } = await searchParams;
  await ensureLoaded();
  const anios = [...new Set(presupuesto.map((l) => l.anio))].sort((a, b) => b - a);
  const anioSel = anios.includes(Number(anio)) ? Number(anio) : (anios[0] ?? new Date().getFullYear());
  const vista: Vista = v === "mapeo" || v === "cargar" ? v : anios.length ? "plan" : "cargar";
  const href = (id: Vista, a = anioSel) => `/presupuesto?v=${id}&anio=${a}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Presupuesto</h1>
        <p className="text-sm text-muted mt-0.5">
          El plan anual contra el que se miden la ejecución y el Informe de Junta. Se carga desde la hoja «PPTO &lt;año&gt;»
          del libro; la estructura y el mapeo de cuentas se heredan del año anterior.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 p-1.5 rounded-xl brand-grad overflow-x-auto shadow-sm w-fit">
          {VISTAS.map(({ id, label, Icon }) => (
            <Link key={id} href={href(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap rounded-lg transition-colors ${
                vista === id ? "bg-white text-royal font-semibold shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
              <Icon size={14} />{label}
            </Link>
          ))}
        </div>
        {vista !== "cargar" && anios.length > 1 && (
          <div className="flex items-center">
            <span className="seg-label">Año</span>
            <div className="seg">
              {anios.map((a) => <Link key={a} href={href(vista, a)} className={a === anioSel ? "on" : ""}>{a}</Link>)}
            </div>
          </div>
        )}
      </div>

      {vista === "plan" && <Plan anio={anioSel} />}
      {vista === "mapeo" && <Mapeo anio={anioSel} />}
      {vista === "cargar" && <Cargar anios={anios} />}
    </div>
  );
}

/* ---------- Plan anual: la plantilla completa, expandible ---------- */
function Plan({ anio }: { anio: number }) {
  const p = presupuestoArbol(anio);
  if (!p.hay) return <div className="card p-6 text-sm text-muted">El presupuesto de {anio} aún no está cargado.</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MiniKpi label="Ingresos de operación" valor={p.resumen.ingOperacion} />
        <MiniKpi label="Gastos de administración" valor={p.resumen.gastosAdmin} />
        <MiniKpi label="EBITDA presupuestado" valor={p.resumen.ebitda} />
        <MiniKpi label="Utilidad neta presupuestada" valor={p.resumen.utilNeta} />
      </div>
      <PresupuestoMatrix
        labels={p.labels}
        roots={p.roots}
        encabezado={{ titulo: `Presupuesto ${anio}`, periodo: `Enero – Diciembre ${anio}`, unidad: "Estructura EBITDA, el mismo orden del Estado de Resultados · pesos colombianos" }}
      />
    </div>
  );
}

/* ---------- Mapeo de cuentas: qué cuenta contable llena cada rubro ---------- */
function Mapeo({ anio }: { anio: number }) {
  if (!presupuesto.some((l) => l.anio === anio)) {
    return <div className="card p-6 text-sm text-muted">El presupuesto de {anio} aún no está cargado.</div>;
  }
  // El «real» que acompaña al editor se corta en el último mes cargado de ese año.
  const mesHasta = Math.max(0, ...periodos.filter((q) => q.anio === anio).map((q) => q.mes)) || 12;
  const lineas = lineasMapeo(anio, mesHasta, "acum");
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Mapeo de cuentas del presupuesto {anio}. Es lo que llena el real de la ejecución presupuestal y del Informe de Junta.</p>
      <MapeoEditor anio={anio} lineas={lineas} />
    </div>
  );
}

/* ---------- Cargar: el estado de cada año y la carga de uno nuevo ---------- */
function Cargar({ anios }: { anios: number[] }) {
  const resumen = anios.map((anio) => {
    const filas = presupuesto.filter((l) => l.anio === anio);
    const detalle = filas.filter((l) => l.tipo === "detalle" && !l.formula);
    return {
      anio,
      filas: filas.length,
      detalle: detalle.length,
      mapeadas: detalle.filter((l) => l.cuentas.length > 0).length,
      formulas: filas.filter((l) => l.formula).length,
      conMeses: filas.some((l) => l.meses.some((v) => v !== 0)),
    };
  });
  const ultimo = anios[0] ?? new Date().getFullYear();
  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resumen.length === 0 && (
          <div className="card p-5 text-sm text-muted">No hay ningún presupuesto cargado.</div>
        )}
        {resumen.map((r) => (
          <div key={r.anio} className="card p-5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium"><CalendarRange size={16} className="text-accent2" /> Presupuesto {r.anio}</div>
              <span className="text-xs text-muted">{r.filas} renglones · {r.formulas} totales estructurales</span>
            </div>
            <div className="text-sm">
              <b className="tnum">{r.mapeadas}</b> de <b className="tnum">{r.detalle}</b> rubros de detalle con cuentas PUC
              {r.mapeadas < r.detalle && <span className="text-muted"> · {r.detalle - r.mapeadas} muestran solo el presupuesto</span>}
            </div>
            {!r.conMeses && <p className="text-xs text-[#8A6A1D]">Cargado solo con el total anual: la ejecución mensual no puede calcularse.</p>}
            <div className="flex items-center gap-4">
              <Link href={`/presupuesto?v=plan&anio=${r.anio}`} className="inline-flex items-center gap-1.5 text-xs text-accent2 hover:underline">
                <Table2 size={13} /> Ver el plan de {r.anio}
              </Link>
              <Link href={`/presupuesto?v=mapeo&anio=${r.anio}`} className="inline-flex items-center gap-1.5 text-xs text-accent2 hover:underline">
                <Link2 size={13} /> Editar el mapeo de cuentas
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-medium mb-3">Cargar un presupuesto</h2>
        <PresupuestoCarga aniosCargados={anios} anioSugerido={ultimo + 1} />
      </div>
    </div>
  );
}

function MiniKpi({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted leading-snug">{label}</div>
      <div className="text-lg font-semibold tnum mt-1" title={fmtCOP(valor)}>{fmtM(valor)}</div>
    </div>
  );
}
