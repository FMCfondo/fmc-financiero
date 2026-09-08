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
 * aviso. Nada de lo que hay aquí inhabilita el botón: el usuario decidió que el PDF
 * sale aunque falte una explicación (2026-09-08). La barra dice qué falta; decidir
 * si se envía así es de quien lo envía.
 */
import { useCallback, useEffect, useState } from "react";

/** Ancho de una hoja carta apaisada, en px de CSS. */
const ANCHO_HOJA = 1056;
const CLAVE_ZOOM = "fmc:informe:zoom";
type Zoom = "ajustar" | number;
const NIVELES: { id: Zoom; label: string }[] = [
  { id: "ajustar", label: "Ajustar" },
  { id: 1, label: "100%" },
  { id: 1.25, label: "125%" },
  { id: 1.5, label: "150%" },
];

type Props = {
  periodo: string;
  /** Partidas que el detector marcó y nadie ha explicado todavía. */
  pendientes: string[];
  /** El portafolio cuadra contra las inversiones líquidas del balance. */
  portafolioConcilia: boolean;
};

export default function BarraInforme({ periodo, pendientes, portafolioConcilia }: Props) {
  const [cortadas, setCortadas] = useState<number[]>([]);

  /* El informe se dibuja a tamano de papel, que en pantalla se lee pequeno. El
     aumento es una preferencia de quien mira -se recuerda en su navegador- y no
     toca el documento: `informe.css` solo lo aplica en @media screen, asi que el
     PDF sale siempre a tamano real. */
  const [zoom, setZoom] = useState<Zoom>("ajustar");
  const [factor, setFactor] = useState(1);

  useEffect(() => {
    try {
      const g = localStorage.getItem(CLAVE_ZOOM);
      if (g === "ajustar") setZoom("ajustar");
      else if (g && Number(g) > 0) setZoom(Number(g));
    } catch { /* noop */ }
  }, []);

  const elegir = (z: Zoom) => {
    setZoom(z);
    try { localStorage.setItem(CLAVE_ZOOM, String(z)); } catch { /* noop */ }
  };

  const aplicar = useCallback(() => {
    const hoja = document.querySelector<HTMLElement>(".informe");
    const madre = hoja?.parentElement;
    if (!hoja || !madre) return;
    let z = typeof zoom === "number" ? zoom : 1;
    if (zoom === "ajustar") {
      const cs = getComputedStyle(madre);
      const util = madre.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // Nunca por debajo de 1: encoger el papel lo haria ilegible, mejor que se corte.
      z = Math.min(1.8, Math.max(1, Math.floor((util / ANCHO_HOJA) * 100) / 100));
    }
    hoja.style.setProperty("--zoom-informe", String(z));
    setFactor(z);
  }, [zoom]);

  useEffect(() => {
    aplicar();
    window.addEventListener("resize", aplicar);
    return () => window.removeEventListener("resize", aplicar);
  }, [aplicar]);

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
        /* offsetWidth, NO getBoundingClientRect(): con el aumento de pantalla (zoom)
           el rectángulo viene ampliado y clientWidth no, y comparar los dos marcaba
           como cortada toda página con tabla. Las dos medidas de aquí van sin zoom. */
        if (t.offsetWidth > util + 1) {
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

    /* Y se vuelve a medir cuando cambia el contenido: al guardar una explicación,
       el servidor redibuja las hojas y hay que saber en el acto si la nueva línea
       cabe. Sin esto, el aviso se quedaría con la medida de la carga inicial. */
    const hoja = document.querySelector(".informe");
    const vigia = hoja ? new MutationObserver(() => medir()) : null;
    vigia?.observe(hoja!, { childList: true, subtree: true, characterData: true });

    return () => {
      window.removeEventListener("resize", medir);
      vigia?.disconnect();
    };
  }, []);

  const bloqueos = [
    ...pendientes.map((p) => `falta la explicación de ${p}`),
    ...(portafolioConcilia ? [] : ["el portafolio no cuadra contra el balance"]),
  ];
  const avisar = bloqueos.length > 0;

  return (
    <div
      className="no-imprimir mx-auto mb-5 rounded-lg border border-line bg-panel shadow-sm"
      style={{ maxWidth: `${ANCHO_HOJA * factor}px` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-fg">Informe de Junta · {periodo}</p>
          <p className="mt-0.5 text-xs text-muted">
            Carta horizontal. El PDF sale idéntico a lo que ves aquí.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-faint">Tamaño</span>
            <div className="flex overflow-hidden rounded-md border border-line">
              {NIVELES.map((n) => (
                <button
                  key={String(n.id)}
                  type="button"
                  onClick={() => elegir(n.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium transition ${
                    zoom === n.id ? "bg-accentdim text-royal" : "text-muted hover:bg-card2"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          <p className="max-w-[19rem] text-xs leading-snug text-muted">
            En el diálogo elige <b className="font-semibold text-fg">Guardar como PDF</b>, márgenes{" "}
            <b className="font-semibold text-fg">Ninguno</b> y desactiva{" "}
            <b className="font-semibold text-fg">Encabezados y pies de página</b>.
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            className="shrink-0 rounded-md bg-royal px-4 py-2 text-sm font-semibold text-white transition hover:bg-royal2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
          >
            Descargar PDF
          </button>
        </div>
      </div>

      {avisar && (
        <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-neg">
          <b className="font-semibold">Antes de enviarlo:</b> {bloqueos.join(" · ")}.
          {/* Solo ahí. Escribir el texto sobre la hoja NO apaga el pendiente: el editor
              guarda con clave «informe:<bloque>» y la partida solo se da por explicada
              con una nota contra su cuenta PUC. Decir lo contrario hacía creer al
              analista que ya había explicado algo que seguía sin explicar. */}
          {pendientes.length > 0 && (
            <> La causa se escribe en <b className="font-semibold">Operación › Revisión del cierre</b>,
            contra la cuenta que la motivó.</>
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
