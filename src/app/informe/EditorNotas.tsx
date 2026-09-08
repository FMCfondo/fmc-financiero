"use client";

/* Editor de las explicaciones del informe. Solo aparece en modo OPERACIÓN: en
 * Reuniones el informe es un documento que se lee, no que se edita.
 *
 * Qué se escribe aquí y qué no: la CAUSA de un movimiento fuera de lo habitual se
 * escribe en Operación › Revisión del cierre, contra la cuenta que lo motivó, y de
 * ahí la recoge la nota que corresponda. Aquí va lo demás — lo que el analista
 * quiere contarle a la Junta sobre una página y ninguna plantilla puede deducir.
 * Un sitio para cada cosa.
 *
 * Vive en la barra, fuera de las hojas: la hoja se queda igual a lo que se imprime.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENTO_MODO, MODO_DEFAULT, leerModo, type ModoApp } from "@/lib/modos";
import type { BloqueNota } from "@/lib/informe-tipos";
import { guardarComentario } from "./actions";

const BLOQUES: { id: BloqueNota; label: string }[] = [
  { id: "situacion", label: "Página 1 · Resumen ejecutivo" },
  { id: "activos", label: "Página 2 · Activos" },
  { id: "pasivos", label: "Página 3 · Pasivos y patrimonio" },
  { id: "resultados", label: "Página 5 · Ejecución presupuestal" },
  { id: "gastos", label: "Página 7 · Detalle de gastos" },
  { id: "interanual", label: "Página 8 · Comparativo interanual" },
  { id: "portafolio", label: "Página 9 · Portafolio" },
];

type Props = { anio: number; mes: number; comentarios: Record<BloqueNota, string> };

export default function EditorNotas({ anio, mes, comentarios }: Props) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoApp>(MODO_DEFAULT);
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(comentarios);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setModo(leerModo());
    const oir = (e: Event) => setModo((e as CustomEvent<ModoApp>).detail);
    window.addEventListener(EVENTO_MODO, oir);
    return () => window.removeEventListener(EVENTO_MODO, oir);
  }, []);

  // Al cambiar de período, el servidor manda otros comentarios: se descarta el borrador.
  useEffect(() => { setBorrador(comentarios); }, [comentarios]);

  if (modo !== "operacion") return null;

  const cambiados = BLOQUES.filter((b) => (borrador[b.id] ?? "") !== (comentarios[b.id] ?? ""));
  const escritos = BLOQUES.filter((b) => (comentarios[b.id] ?? "").trim()).length;

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    try {
      for (const b of cambiados) {
        const r = await guardarComentario({ anio, mes, bloque: b.id, cuerpo: borrador[b.id] ?? "" });
        if (!r.ok) { setAviso(r.error ?? "No se pudo guardar."); setGuardando(false); return; }
      }
      router.refresh();
      setAviso(`Guardado en ${cambiados.length === 1 ? "una página" : `${cambiados.length} páginas`}.`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-xs text-muted transition hover:bg-card2"
      >
        <span>
          <b className="font-semibold text-fg">Explicaciones del informe</b>
          {escritos > 0 && <> · {escritos} {escritos === 1 ? "página escrita" : "páginas escritas"}</>}
          {cambiados.length > 0 && <span className="text-neg"> · sin guardar</span>}
        </span>
        <span className="text-faint">{abierto ? "Cerrar" : "Abrir"}</span>
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-line px-5 py-4">
          <p className="text-xs leading-relaxed text-muted">
            Lo que escribas aquí se imprime como último párrafo de las notas de esa página.
            La <b className="font-semibold text-fg">causa</b> de un movimiento fuera de lo habitual
            no va aquí: se escribe en <b className="font-semibold text-fg">Revisión del cierre</b>,
            contra la cuenta que lo motivó, y la nota la recoge sola.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {BLOQUES.map((b) => (
              <label key={b.id} className="block">
                <span className="mb-1 block text-xs font-medium text-fg">{b.label}</span>
                <textarea
                  rows={3}
                  value={borrador[b.id] ?? ""}
                  onChange={(e) => setBorrador((s) => ({ ...s, [b.id]: e.target.value }))}
                  placeholder="Sin explicación adicional"
                  className="w-full resize-y rounded-md border border-line bg-card px-3 py-2 text-xs leading-relaxed text-fg placeholder:text-faint focus:border-accent focus:outline-none"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || cambiados.length === 0}
              className="rounded-md bg-royal px-4 py-2 text-sm font-semibold text-white transition hover:bg-royal2 disabled:cursor-not-allowed disabled:bg-faint"
            >
              {guardando ? "Guardando…" : "Guardar explicaciones"}
            </button>
            {aviso && <span className="text-xs text-muted">{aviso}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
