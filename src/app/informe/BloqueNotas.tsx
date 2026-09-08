/* El bloque «Notas del período» al pie de una página del informe.
 *
 * El texto llega ya redactado por informe-notas.ts, con la causa humana COSIDA
 * dentro de la frase (así se lee en el informe certificado: "…la cartera se
 * normalizó a X, tras recibirse el pago de la facturación pendiente"). Por eso
 * aquí se imprime `texto` y nada más: añadir `causa` aparte la duplicaría.
 *
 * Una nota pendiente se marca a la vista —y también en el papel, si alguien
 * saltara la barrera de exportación—: es preferible que se vea el hueco a que
 * la Junta lea una explicación que nadie escribió.
 *
 * El `comentario` es lo que el analista escribió a mano para esta página, y va al
 * final: primero lo que se deduce de las cifras, después lo que solo sabe una
 * persona. Hay páginas que solo tienen comentario -gastos, interanual, portafolio-
 * porque ninguna plantilla redacta sobre ellas. */
import type { Nota } from "@/lib/informe-tipos";

export default function BloqueNotas({ notas, comentario, titulo = "Notas del período" }: {
  notas: Nota[]; comentario?: string; titulo?: string;
}) {
  const propio = comentario?.trim();
  if (!notas.length && !propio) return null;
  return (
    <div className="notas">
      <h2>{titulo}</h2>
      <div className="cuerpo">
        {notas.map((n, i) => (
          <p key={i} className={n.requiereExplicacion ? "pendiente" : undefined}>{n.texto}</p>
        ))}
        {propio && <p>{propio}</p>}
      </div>
    </div>
  );
}
