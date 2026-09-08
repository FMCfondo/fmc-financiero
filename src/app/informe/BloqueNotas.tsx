/* El bloque «Notas del período» al pie de una página del informe.
 *
 * El texto llega ya redactado por informe-notas.ts, con la causa humana COSIDA
 * dentro de la frase (así se lee en el informe certificado: "…la cartera se
 * normalizó a X, tras recibirse el pago de la facturación pendiente"). Por eso
 * aquí se imprime `texto` y nada más: añadir `causa` aparte la duplicaría.
 *
 * Una nota pendiente se marca a la vista —y también en el papel, si alguien
 * saltara la barrera de exportación—: es preferible que se vea el hueco a que
 * la Junta lea una explicación que nadie escribió. */
import type { Nota } from "@/lib/informe-tipos";

export default function BloqueNotas({ notas, titulo = "Notas del período" }: {
  notas: Nota[]; titulo?: string;
}) {
  if (!notas.length) return null;
  return (
    <div className="notas">
      <h2>{titulo}</h2>
      <div className="cuerpo">
        {notas.map((n, i) => (
          <p key={i} className={n.requiereExplicacion ? "pendiente" : undefined}>{n.texto}</p>
        ))}
      </div>
    </div>
  );
}
