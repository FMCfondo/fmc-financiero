"use client";

/* El bloque «Notas del período» al pie de una página del informe — y, en modo
 * Operación, el sitio donde se edita.
 *
 * Dos textos posibles, y manda uno solo:
 *   · el AUTOMÁTICO: lo redacta informe-notas.ts desde las cifras, con la causa
 *     humana cosida dentro de la frase. Se actualiza solo cuando cambian los datos.
 *   · el ESCRITO A MANO: lo que el analista escribió sobre esta misma hoja. Si
 *     existe, reemplaza al automático entero. El precio es que deja de seguir a las
 *     cifras, y la hoja lo advierte mientras se está en Operación; «Volver al
 *     automático» lo borra y el texto vuelve a salir de los datos.
 *
 * Al abrir el editor se carga el texto completo que se está viendo —el automático
 * o el manual—, así que se corrige lo que hay, no se parte de cero. Por qué aquí y
 * no en un panel aparte: el usuario quiso editar cada nota en su sitio (2026-09-08).
 *
 * Todo lo editable lleva `no-imprimir`: al papel van los párrafos y nada más.
 *
 * La marca de «falta la explicación» es SOLO para quien tiene que actuar: se pinta
 * en modo Operación y en ningún otro sitio. Ni en Reuniones ni en el papel — un
 * rótulo rojo dentro del documento de la Junta no se lee como una advertencia al
 * analista, se lee como un defecto del informe. El aviso no se pierde: sigue en la
 * barra (que nunca se imprime) y en Operación › Revisión del cierre, que es donde se
 * escribe la causa. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BloqueNota, Nota } from "@/lib/informe-tipos";
import { EVENTO_MODO, MODO_DEFAULT, leerModo, type ModoApp } from "@/lib/modos";
import { guardarTextoNota } from "./actions";

/** Lo que una página necesita para que su bloque de notas se pueda editar. */
export type EdicionNota = { bloque: BloqueNota; anio: number; mes: number; manual: string };

type Props = { notas: Nota[]; edicion: EdicionNota; titulo?: string };

const enParrafos = (t: string) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export default function BloqueNotas({ notas, edicion, titulo = "Notas del período" }: Props) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoApp>(MODO_DEFAULT);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setModo(leerModo());
    const oir = (e: Event) => setModo((e as CustomEvent<ModoApp>).detail);
    window.addEventListener(EVENTO_MODO, oir);
    return () => window.removeEventListener(EVENTO_MODO, oir);
  }, []);

  const manual = edicion.manual.trim();
  const operacion = modo === "operacion";
  const parrafos = manual ? enParrafos(manual) : notas.map((n) => n.texto);
  const pendiente = (i: number) => operacion && !manual && !!notas[i]?.requiereExplicacion;

  // Sin texto y sin nadie que pueda escribirlo, el bloque no existe.
  if (!parrafos.length && !operacion) return null;

  const abrir = () => {
    setTexto(manual || notas.map((n) => n.texto).join("\n\n"));
    setAviso(null);
    setEditando(true);
  };

  const guardar = async (cuerpo: string) => {
    setGuardando(true);
    setAviso(null);
    const r = await guardarTextoNota({ anio: edicion.anio, mes: edicion.mes, bloque: edicion.bloque, cuerpo });
    setGuardando(false);
    if (!r.ok) { setAviso(r.error ?? "No se pudo guardar."); return; }
    setEditando(false);
    router.refresh();
  };

  return (
    <div className="notas">
      <div className="notas-cab">
        <h2>{titulo}</h2>
        {operacion && !editando && (
          <span className="controles no-imprimir">
            {manual && <span className="manual">escrito a mano · no sigue a las cifras</span>}
            <button type="button" onClick={abrir}>{parrafos.length ? "Editar" : "Escribir notas"}</button>
            {manual && (
              <button type="button" disabled={guardando} onClick={() => guardar("")}>Volver al automático</button>
            )}
          </span>
        )}
      </div>

      {editando ? (
        <div className="editor no-imprimir">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={Math.max(4, texto.split("\n").length + 1)}
            placeholder="Un párrafo por bloque; deja una línea en blanco entre párrafos."
            autoFocus
          />
          <div className="acciones">
            <button type="button" className="guardar" disabled={guardando} onClick={() => guardar(texto)}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="cancelar" disabled={guardando} onClick={() => setEditando(false)}>
              Cancelar
            </button>
            <span className="aviso">
              {aviso ?? "Al guardar, este texto reemplaza al automático y deja de actualizarse con las cifras."}
            </span>
          </div>
        </div>
      ) : (
        <div className="cuerpo">
          {parrafos.map((p, i) => (
            <p key={i} className={pendiente(i) ? "pendiente" : undefined}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}
