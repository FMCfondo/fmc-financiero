"use client";
import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/* PANTALLA COMPLETA (para presentar desde la app en la reunión).
 *
 * Una clase `presentacion` en <html> esconde la barra lateral y la cabecera y deja
 * que el contenido ocupe toda la pantalla (globals.css); además se pide al navegador
 * el modo de pantalla completa de verdad. Si no lo concede (un iframe, un navegador
 * antiguo), queda el modo dentro de la ventana, que ya gana todo el espacio. Se sale
 * con el botón flotante o con Esc; si el navegador sale solo (Esc en pantalla
 * completa real), aquí nos enteramos por `fullscreenchange` y recogemos.
 *
 * El gancho lo comparten el Informe de Junta (que además pasa de hoja con las
 * flechas y ajusta el aumento) y los Estados Financieros (solo el botón). */
export function usePantallaCompleta() {
  const [presentando, setPresentando] = useState(false);

  const salir = useCallback(() => {
    setPresentando(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  const entrar = useCallback(() => {
    setPresentando(true);
    document.documentElement.requestFullscreen?.().catch(() => { /* queda el modo dentro de la ventana */ });
  }, []);

  useEffect(() => {
    if (!presentando) return;
    document.documentElement.classList.add("presentacion");
    const alCambiar = () => { if (!document.fullscreenElement) salir(); };
    const teclas = (e: KeyboardEvent) => { if (e.key === "Escape") salir(); };
    document.addEventListener("fullscreenchange", alCambiar);
    window.addEventListener("keydown", teclas);
    return () => {
      document.documentElement.classList.remove("presentacion");
      document.removeEventListener("fullscreenchange", alCambiar);
      window.removeEventListener("keydown", teclas);
    };
  }, [presentando, salir]);

  return { presentando, entrar, salir };
}

/** El botón de entrar y, en presentación, el flotante de salir. Va donde tenga
 *  sentido en cada módulo; no necesita nada más. */
export default function BotonPantallaCompleta({ titulo = "Ver a toda pantalla, para presentar desde aquí" }: { titulo?: string }) {
  const { presentando, entrar, salir } = usePantallaCompleta();
  if (presentando) {
    return (
      <div className="no-imprimir fixed right-4 top-4 z-50 opacity-40 transition hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={salir}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs font-medium text-fg shadow-lg backdrop-blur transition hover:bg-card2"
        >
          <Minimize2 size={13} /> Salir de pantalla completa
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={entrar}
      title={titulo}
      className="no-imprimir flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-fg transition hover:bg-card2"
    >
      <Maximize2 size={14} /> Pantalla completa
    </button>
  );
}
