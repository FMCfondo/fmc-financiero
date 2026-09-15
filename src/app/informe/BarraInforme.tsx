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
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, ChevronLeft, ChevronRight } from "lucide-react";

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

/** El selector de aumento, el mismo en la barra y en la presentación. */
function Niveles({ valor, alElegir }: { valor: Zoom; alElegir: (z: Zoom) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-line">
      {NIVELES.map((n) => (
        <button
          key={String(n.id)}
          type="button"
          onClick={() => alElegir(n.id)}
          className={`px-2.5 py-1.5 text-xs font-medium transition ${
            valor === n.id ? "bg-accentdim text-royal" : "text-muted hover:bg-card2"
          }`}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

type Props = {
  periodo: string;
  /** Partidas que el detector marcó y nadie ha explicado todavía. */
  pendientes: string[];
  /** El portafolio cuadra contra las inversiones líquidas del balance. */
  portafolioConcilia: boolean;
  /** Posiciones a la vista sin la tasa de ESTE mes: la página 9 las imprime con raya. */
  tasasFaltantes: string[];
  /** Los avisos (explicaciones que faltan, tasas, hojas cortadas) son recados para
   *  quien puede arreglarlos. A la Junta se le muestra el documento y su descarga. */
  mostrarAvisos: boolean;
};

export default function BarraInforme({ periodo, pendientes, portafolioConcilia, tasasFaltantes, mostrarAvisos }: Props) {
  const [cortadas, setCortadas] = useState<number[]>([]);

  /* El informe se dibuja a tamano de papel, que en pantalla se lee pequeno. El
     aumento es una preferencia de quien mira -se recuerda en su navegador- y no
     toca el documento: `informe.css` solo lo aplica en @media screen, asi que el
     PDF sale siempre a tamano real. */
  const [zoom, setZoom] = useState<Zoom>("ajustar");
  const [factor, setFactor] = useState(1);

  /* PANTALLA COMPLETA (para presentar el informe desde la app). Se esconden la barra
     lateral y la cabecera (clase `presentacion` en <html>, ver informe.css), la hoja
     se ajusta al ancho de la pantalla y se pide al navegador el modo de pantalla
     completa de verdad; si no lo concede (un iframe, un navegador antiguo), queda el
     modo dentro de la ventana, que ya gana todo el espacio. Se sale con el botón o
     con Esc, y las flechas pasan de hoja. El aumento de presentación no se guarda:
     es de ese momento, no una preferencia. */
  const [presentando, setPresentando] = useState(false);
  const [zoomPres, setZoomPres] = useState<Zoom>("ajustar");
  const [hoja, setHoja] = useState({ actual: 1, total: 0 });
  const hojaActual = useRef(1);

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
    const modo = presentando ? zoomPres : zoom;
    let z = typeof modo === "number" ? modo : 1;
    if (modo === "ajustar") {
      const cs = getComputedStyle(madre);
      const util = madre.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // Nunca por debajo de 1: encoger el papel lo haria ilegible, mejor que se corte.
      z = Math.min(1.8, Math.max(1, Math.floor((util / ANCHO_HOJA) * 100) / 100));
    }
    hoja.style.setProperty("--zoom-informe", String(z));
    setFactor(z);
  }, [zoom, zoomPres, presentando]);

  const irAHoja = useCallback((n: number) => {
    const hojas = document.querySelectorAll<HTMLElement>(".informe .page");
    const i = Math.min(hojas.length, Math.max(1, n));
    hojas[i - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const salirPresentacion = useCallback(() => {
    setPresentando(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  const entrarPresentacion = () => {
    setZoomPres("ajustar");
    setPresentando(true);
    document.documentElement.requestFullscreen?.().catch(() => { /* queda el modo dentro de la ventana */ });
  };

  useEffect(() => {
    if (!presentando) return;
    document.documentElement.classList.add("presentacion");
    requestAnimationFrame(aplicar); // sin barra lateral el ancho útil es otro

    const alCambiarPantalla = () => { if (!document.fullscreenElement) salirPresentacion(); };
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") salirPresentacion();
      else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); irAHoja(hojaActual.current + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); irAHoja(hojaActual.current - 1); }
    };
    /* Qué hoja se está viendo: la más cercana al centro de la pantalla. */
    let marco = 0;
    const situar = () => {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => {
        const hojas = Array.from(document.querySelectorAll<HTMLElement>(".informe .page"));
        const centro = window.innerHeight / 2;
        let idx = 0, mejor = Infinity;
        hojas.forEach((p, i) => {
          const r = p.getBoundingClientRect();
          const d = Math.abs((r.top + r.bottom) / 2 - centro);
          if (d < mejor) { mejor = d; idx = i; }
        });
        hojaActual.current = idx + 1;
        setHoja({ actual: idx + 1, total: hojas.length });
      });
    };
    situar();
    document.addEventListener("fullscreenchange", alCambiarPantalla);
    window.addEventListener("keydown", teclas);
    window.addEventListener("scroll", situar, { passive: true });
    window.addEventListener("resize", situar);
    return () => {
      document.documentElement.classList.remove("presentacion");
      document.removeEventListener("fullscreenchange", alCambiarPantalla);
      window.removeEventListener("keydown", teclas);
      window.removeEventListener("scroll", situar);
      window.removeEventListener("resize", situar);
      cancelAnimationFrame(marco);
      requestAnimationFrame(aplicar); // vuelve el ancho de siempre
    };
  }, [presentando, aplicar, irAHoja, salirPresentacion]);

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
    ...(tasasFaltantes.length
      ? [`falta la tasa de ${periodo.toLowerCase()} de ${tasasFaltantes.join(", ")} (Portafolio › Mantenimiento › Tasas del mes)`]
      : []),
  ];
  const avisar = mostrarAvisos && bloqueos.length > 0;

  if (presentando) {
    return (
      <div className="no-imprimir fixed right-4 top-4 z-50 flex items-center gap-3 rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs shadow-lg backdrop-blur opacity-40 transition hover:opacity-100 focus-within:opacity-100">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => irAHoja(hoja.actual - 1)} className="rounded p-1 text-muted hover:bg-card2 hover:text-fg" title="Hoja anterior (←)" aria-label="Hoja anterior">
            <ChevronLeft size={14} />
          </button>
          <span className="tnum text-muted">Hoja {hoja.actual} de {hoja.total}</span>
          <button type="button" onClick={() => irAHoja(hoja.actual + 1)} className="rounded p-1 text-muted hover:bg-card2 hover:text-fg" title="Hoja siguiente (→)" aria-label="Hoja siguiente">
            <ChevronRight size={14} />
          </button>
        </div>
        <Niveles valor={zoomPres} alElegir={setZoomPres} />
        <button
          type="button"
          onClick={salirPresentacion}
          className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 font-medium text-fg transition hover:bg-card2"
        >
          <Minimize2 size={13} /> Salir de pantalla completa
        </button>
      </div>
    );
  }

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
            <Niveles valor={zoom} alElegir={elegir} />
          </div>

          <p className="max-w-[19rem] text-xs leading-snug text-muted">
            En el diálogo elige <b className="font-semibold text-fg">Guardar como PDF</b>, márgenes{" "}
            <b className="font-semibold text-fg">Ninguno</b> y desactiva{" "}
            <b className="font-semibold text-fg">Encabezados y pies de página</b>.
          </p>
          <button
            type="button"
            onClick={entrarPresentacion}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium text-fg transition hover:bg-card2"
            title="Ver el informe a toda pantalla, para presentarlo desde aquí"
          >
            <Maximize2 size={14} /> Pantalla completa
          </button>
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

      {mostrarAvisos && cortadas.length > 0 && (
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
