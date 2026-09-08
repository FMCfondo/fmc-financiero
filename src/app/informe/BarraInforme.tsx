"use client";

/* Barra de control del Informe de Junta: descarga, barrera de calidad y vigilancia
 * de las hojas. Vive FUERA de `.informe` (el reseteo de ese contenedor aplastaría
 * las utilidades de Tailwind) y lleva `no-imprimir`, la clase que informe.css ya
 * escondía en @media print: al papel solo van las siete hojas.
 *
 * El PDF sale del diálogo del navegador sobre la misma marcación de la pantalla,
 * no de un generador aparte: así el papel y la pantalla no pueden divergir. El
 * precio es que el diálogo trae dos ajustes por defecto que estropean la hoja
 * -márgenes y encabezados-, y por eso se enuncian aquí.
 *
 * LA VIGILANCIA DE HOJAS existe por un defecto real: cada `.page` tiene alto fijo
 * y `overflow: hidden`, así que cuando el contenido no cabe se RECORTA EN SILENCIO.
 * Así se perdieron la fila de utilidad neta de la página 4 y la última fila de la
 * página 5, sin que nada lo dijera. Medir aquí convierte ese fallo mudo en un
 * aviso. No inhabilita el botón: una medición puede equivocarse y dejar a alguien
 * sin poder imprimir; lo que sí bloquea es una nota sin explicar, que es un hecho,
 * no una medida.
 */
import { useEffect, useState } from "react";

type Props = {
  periodo: string;
  /** Partidas que el detector marcó y nadie ha explicado todavía. */
  pendientes: string[];
  /** El portafolio cuadra contra las inversiones líquidas del balance. */
  portafolioConcilia: boolean;
};

export default function BarraInforme({ periodo, pendientes, portafolioConcilia }: Props) {
  const [cortadas, setCortadas] = useState<number[]>([]);

  useEffect(() => {
    const medir = () => {
      const hojas = Array.from(document.querySelectorAll<HTMLElement>(".informe .page"));
      const malas = new Set<number>();

      hojas.forEach((p, i) => {
        if (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth) malas.add(i + 1);
      });

      /* Una tabla puede desbordar SU COLUMNA sin desbordar la hoja: en la página del
         portafolio se salía de su mitad y se pintaba encima del bloque vecino, y la
         medición de arriba no la veía. Se compara cada tabla con el ancho útil de
         quien la contiene. */
      document.querySelectorAll<HTMLElement>(".informe .page table").forEach((t) => {
        const madre = t.parentElement;
        if (!madre) return;
        const cs = getComputedStyle(madre);
        const util = madre.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (t.getBoundingClientRect().width > util + 1) {
          const hoja = hojas.indexOf(t.closest<HTMLElement>(".page")!);
          if (hoja >= 0) malas.add(hoja + 1);
        }
      });

      setCortadas([...malas].sort((a, b) => a - b));
    };
    medir();
    // Las tipografías cambian el alto cuando terminan de cargar.
    document.fonts?.ready.then(medir).catch(() => {});
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const bloqueos = [
    ...pendientes.map((p) => `falta la explicación de ${p}`),
    ...(portafolioConcilia ? [] : ["el portafolio no cuadra contra el balance"]),
  ];
  const bloqueado = bloqueos.length > 0;

  return (
    <div className="no-imprimir mx-auto mb-5 max-w-[11in] rounded-lg border border-line bg-panel shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-fg">Informe de Junta · {periodo}</p>
          <p className="mt-0.5 text-xs text-muted">
            Siete páginas en carta horizontal. El PDF sale idéntico a lo que ves aquí.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <p className="max-w-[19rem] text-xs leading-snug text-muted">
            En el diálogo elige <b className="font-semibold text-fg">Guardar como PDF</b>, márgenes{" "}
            <b className="font-semibold text-fg">Ninguno</b> y desactiva{" "}
            <b className="font-semibold text-fg">Encabezados y pies de página</b>.
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={bloqueado}
            className="shrink-0 rounded-md bg-royal px-4 py-2 text-sm font-semibold text-white transition hover:bg-royal2 disabled:cursor-not-allowed disabled:bg-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
          >
            Descargar PDF
          </button>
        </div>
      </div>

      {bloqueado && (
        <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-neg">
          <b className="font-semibold">El informe todavía no se puede enviar:</b> {bloqueos.join(" · ")}.
          {pendientes.length > 0 && (
            <> La explicación se escribe en <b className="font-semibold">Operación › Revisión del cierre</b>.</>
          )}
        </p>
      )}

      {cortadas.length > 0 && (
        <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-neg">
          <b className="font-semibold">
            {cortadas.length === 1 ? `La página ${cortadas[0]} se está cortando` : `Se están cortando las páginas ${cortadas.join(", ")}`}:
          </b>{" "}
          hay contenido que no cabe en la hoja y no se imprimirá. Revísalo antes de enviar el informe.
        </p>
      )}
    </div>
  );
}
