"use client";

/* Barra de control del Informe de Junta. Vive FUERA de `.informe` (el reseteo
 * `.informe *` aplastaría las utilidades de Tailwind) y lleva `no-imprimir`,
 * la clase que `informe.css` esconde en @media print: al papel solo van las hojas.
 *
 * El PDF sale del diálogo del navegador, no de un generador aparte: así la
 * pantalla y el papel no pueden divergir. El precio es que el diálogo trae dos
 * ajustes por defecto que estropean la hoja —márgenes y encabezados—, y por eso
 * se enuncian aquí en vez de esperar que el usuario los adivine.
 */
export default function BarraInforme({ periodo }: { periodo: string }) {
  return (
    <div className="no-imprimir mx-auto mb-5 flex max-w-[11in] flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-panel px-5 py-4 shadow-sm">
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
          className="shrink-0 rounded-md bg-royal px-4 py-2 text-sm font-semibold text-white transition hover:bg-royal2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
        >
          Descargar PDF
        </button>
      </div>
    </div>
  );
}
