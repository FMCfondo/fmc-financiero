"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/* EL CONTENEDOR DE TODA TABLA `.stmt`: el desplazamiento con sus sombras y el AJUSTE DE
   COLUMNAS arrastrando el borde de la cabecera, como en Excel (pedido del usuario,
   2026-09-16). Doble clic en el borde devuelve la columna a su ancho de fábrica.

   · La columna de concepto se ajusta por la variable `--stmt-col1` del contenedor, que
     es la que fija el ancho de TODAS sus celdas; el texto del concepto pasa a dos líneas
     cuando no cabe (`.etq`, ver globals.css) y la fila apenas crece.
   · Las columnas de cifras solo se ensanchan: un número no se parte.
   · Los anchos se recuerdan en el navegador por pantalla y por tabla, para que el ajuste
     no haya que repetirlo cada vez.

   Las asas se añaden al DOM por fuera de React (React no toca hijos que no creó), y un
   observador las repone cuando la tabla se vuelve a dibujar con otras columnas. */

const MIN_COL1 = 160;
const MIN_NUM = 72;

type Anchos = { col1?: number; cols?: Record<string, number> };

function claveDe(el: HTMLElement): string {
  const indice = Array.from(document.querySelectorAll(".stmt")).indexOf(el);
  const vista = new URLSearchParams(location.search).get("vista") ?? "";
  return `stmt:anchos:${location.pathname}?${vista}#${indice}`;
}
const leer = (k: string): Anchos => { try { return JSON.parse(localStorage.getItem(k) ?? "{}") as Anchos; } catch { return {}; } };
const guardar = (k: string, a: Anchos) => { try { localStorage.setItem(k, JSON.stringify(a)); } catch { /* noop */ } };

/** Identidad estable de una cabecera de cifras: fila y posición dentro de la fila. */
const idDe = (th: HTMLTableCellElement) => `${(th.parentElement as HTMLTableRowElement).rowIndex}:${th.cellIndex}`;

function instalar(el: HTMLElement): () => void {
  const clave = claveDe(el);
  const limpiezas: (() => void)[] = [];

  const aplicar = (th: HTMLTableCellElement, ancho: number | null) => {
    if (th.classList.contains("col1")) {
      if (ancho === null) el.style.removeProperty("--stmt-col1");
      else el.style.setProperty("--stmt-col1", `${ancho}px`);
    } else if (ancho === null) {
      th.style.removeProperty("width"); th.style.removeProperty("min-width");
    } else {
      th.style.width = th.style.minWidth = `${ancho}px`;
    }
  };

  const equipar = () => {
    const guardados = leer(clave);
    el.querySelectorAll<HTMLTableCellElement>("thead th").forEach((th) => {
      if (th.colSpan > 1 || th.querySelector(":scope > .ajuste")) return;
      const esCol1 = th.classList.contains("col1");
      const previo = esCol1 ? guardados.col1 : guardados.cols?.[idDe(th)];
      if (previo) aplicar(th, previo);

      const asa = document.createElement("span");
      asa.className = "ajuste";
      asa.title = "Arrastra para cambiar el ancho · doble clic para restablecer";
      th.appendChild(asa);

      let inicioX = 0, inicioW = 0, ultimoToque = 0;
      const restablecer = () => {
        aplicar(th, null);
        const a = leer(clave);
        if (esCol1) delete a.col1; else if (a.cols) delete a.cols[idDe(th)];
        guardar(clave, a);
      };
      const mover = (e: PointerEvent) => {
        const w = Math.max(esCol1 ? MIN_COL1 : MIN_NUM, Math.round(inicioW + (e.clientX - inicioX)));
        aplicar(th, w);
      };
      const soltar = (e: PointerEvent) => {
        asa.releasePointerCapture(e.pointerId);
        asa.removeEventListener("pointermove", mover);
        asa.classList.remove("activo");
        el.classList.remove("ajustando");
        const a = leer(clave);
        const w = Math.round(th.getBoundingClientRect().width);
        if (esCol1) a.col1 = w; else a.cols = { ...(a.cols ?? {}), [idDe(th)]: w };
        guardar(clave, a);
      };
      asa.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        /* Doble toque = restablecer. Se detecta aquí, con los propios eventos de puntero:
           al cancelar el pointerdown, los eventos de ratón derivados no son de fiar. */
        const ahora = performance.now();
        if (ahora - ultimoToque < 400) { ultimoToque = 0; restablecer(); return; }
        ultimoToque = ahora;
        inicioX = e.clientX; inicioW = th.getBoundingClientRect().width;
        asa.setPointerCapture(e.pointerId);
        asa.classList.add("activo");
        el.classList.add("ajustando");
        asa.addEventListener("pointermove", mover);
        asa.addEventListener("pointerup", soltar, { once: true });
        asa.addEventListener("pointercancel", soltar, { once: true });
      });
      asa.addEventListener("dblclick", (e) => { e.preventDefault(); e.stopPropagation(); });
      asa.addEventListener("click", (e) => e.stopPropagation());
    });
  };

  equipar();
  const vigia = new MutationObserver(() => equipar());
  vigia.observe(el, { childList: true, subtree: true });
  limpiezas.push(() => vigia.disconnect());
  return () => limpiezas.forEach((f) => f());
}

export default function StmtScroll({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sx, setSx] = useState(false);
  const [sy, setSy] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return instalar(el);
  }, []);

  return (
    <div
      ref={ref}
      className={`stmt ${className}`.trim()}
      style={style}
      data-sx={sx ? "1" : undefined}
      data-sy={sy ? "1" : undefined}
      onScroll={(e) => { setSx(e.currentTarget.scrollLeft > 0); setSy(e.currentTarget.scrollTop > 0); }}
    >
      {children}
    </div>
  );
}

