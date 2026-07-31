// Detección de movimientos fuera de lo habitual — el radar del cierre mensual.
//
// Cada cuenta se compara contra SU PROPIO historial, no contra el presupuesto ni
// contra otra cuenta: una cuenta "se salió" cuando el mes queda fuera del rango
// en que se ha movido durante el último año. Así lo raro se detecta aunque el
// rubro sea pequeño, y no se alarma por rubros grandes que siempre son grandes.
//
// Método (deliberadamente simple y explicable a un no estadístico):
//   · se toman hasta 12 meses previos de la misma cuenta;
//   · se calcula su rango habitual = media ± 2 desviaciones estándar;
//   · el mes entra al radar si queda FUERA de ese rango Y el desvío supera un
//     mínimo absoluto (para no reportar centavos).
// Se reporta también el rango observado (mínimo–máximo), que es lo que de verdad
// se le muestra al usuario: "su rango habitual es 0 – 1,2 M".
import "server-only";
import * as D from "./data";

/** Desvío mínimo para que un movimiento valga la pena mirarse. */
export const UMBRAL_MIN = 1_000_000;
const MESES_HISTORIA = 12;

export type Anomalia = {
  codigo: string; nombre: string; clase: number;
  valor: number;          // el movimiento del mes
  media: number;          // promedio del historial
  min: number; max: number;
  desvio: number;         // valor − media
  veces: number;          // a cuántas desviaciones está (magnitud del rarismo)
  nHistoria: number;
  esNueva: boolean;       // primera vez que la cuenta se mueve
};

function estad(xs: number[]) {
  const n = xs.length || 1;
  const media = xs.reduce((a, b) => a + b, 0) / n;
  const varianza = xs.reduce((a, b) => a + (b - media) ** 2, 0) / n;
  return { media, sd: Math.sqrt(varianza) };
}

/** Cuentas candidatas: las HOJAS de resultado (clases 4 y 5) y los grupos de
 *  balance, que es donde el analista revisa el movimiento del mes. */
function candidatas() {
  return D.cuentas.filter((c) => {
    if (c.clase === 4 || c.clase === 5) return c.es_hoja;
    return c.longitud === 4 && c.clase <= 3; // grupos del balance
  });
}

export function detectarAnomalias(etq: string): Anomalia[] {
  const p = D.periodo(etq);
  const idx = D.periodos.findIndex((q) => q.etiqueta === etq);
  if (idx < 0) return [];
  const historia = D.periodos.slice(Math.max(0, idx - MESES_HISTORIA), idx);
  if (!historia.length) return [];

  const out: Anomalia[] = [];
  for (const c of candidatas()) {
    const valor = D.fact(etq, c.codigo);
    const xs = historia.map((q) => D.fact(q.etiqueta, c.codigo));
    const movidos = xs.filter((v) => v !== 0);
    const { media, sd } = estad(xs);
    const min = Math.min(...xs), max = Math.max(...xs);
    const desvio = valor - media;

    // Cuenta que nunca se había movido y ahora sí: siempre vale mirarla.
    const esNueva = movidos.length === 0 && Math.abs(valor) >= UMBRAL_MIN;
    // Fuera del rango habitual (media ± 2 sd). Si no hay dispersión (sd≈0),
    // basta con que se salga del rango observado.
    const limite = sd > 1 ? 2 * sd : Math.max(Math.abs(media) * 0.25, UMBRAL_MIN);
    const fuera = Math.abs(desvio) > limite && Math.abs(desvio) >= UMBRAL_MIN;

    if (!esNueva && !fuera) continue;
    out.push({
      codigo: c.codigo, nombre: c.nombre, clase: c.clase, valor, media, min, max, desvio,
      veces: sd > 1 ? Math.abs(desvio) / sd : 0, nHistoria: xs.length, esNueva,
    });
  }
  // Lo más raro y más grande primero.
  return out.sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio)).slice(0, 12);
}
export type { Anomalia as AnomaliaTipo };
