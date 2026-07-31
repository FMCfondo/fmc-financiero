import Link from "next/link";
import { ensureLoaded, resolverEtq, periodo, leerNotas } from "@/lib/data";
import { detectarAnomalias } from "@/lib/anomalias";
import { etqNombre } from "@/lib/periodos";
import RevisionNotas, { type ItemRevision } from "@/components/RevisionNotas";
import { ArrowRight, Info } from "lucide-react";

/* REVISIÓN DEL CIERRE — el paso que sigue a cargar el balance.
   La app señala lo que se salió de lo habitual y pide la explicación; lo que se
   escribe aquí es lo que la Junta lee en el Cockpit. Vive en Operación. */

export default async function RevisionPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  await ensureLoaded();
  const etq = resolverEtq(p);
  const per = periodo(etq);
  const anomalias = detectarAnomalias(etq);
  const notas = await leerNotas(per.anio, per.mes);
  const byCod = new Map(notas.map((n) => [n.codigo, n.cuerpo]));

  const items: ItemRevision[] = anomalias.map((a) => ({
    codigo: a.codigo, nombre: a.nombre, valor: a.valor, media: a.media,
    min: a.min, max: a.max, desvio: a.desvio, esNueva: a.esNueva,
    notaPrevia: byCod.get(a.codigo) ?? "",
  }));
  const conNota = items.filter((i) => i.notaPrevia.trim()).length;

  return (
    <div className="space-y-5 max-w-[1000px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Revisión del cierre</h1>
          <p className="text-sm text-muted mt-0.5">{etqNombre(etq)} · movimientos fuera de lo habitual</p>
        </div>
        <Link href={`/cockpit${p ? `?p=${p}` : ""}`} className="text-xs text-accent2 hover:underline inline-flex items-center gap-1">
          Ver el Cockpit <ArrowRight size={12} />
        </Link>
      </div>

      <div className="card p-4 flex items-start gap-3 border-accent/20">
        <Info size={16} className="text-accent2 mt-0.5 shrink-0" />
        <p className="text-xs text-muted leading-relaxed">
          Cada cuenta se compara contra <b className="text-fg">su propio historial</b> de los últimos doce meses —no contra el
          presupuesto ni contra otras cuentas—, así que un rubro pequeño que se dispara se detecta igual que uno grande.
          Entran al radar los movimientos que se salen de su rango habitual por más de un millón de pesos.
          {items.length > 0 && <> Este mes hay <b className="text-fg">{items.length}</b> para revisar y ya explicaste <b className="text-fg">{conNota}</b>.</>}
        </p>
      </div>

      <RevisionNotas anio={per.anio} mes={per.mes} items={items} />
    </div>
  );
}
