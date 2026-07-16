// Lista de períodos segura para componentes de cliente (sin importar la semilla).
const ABREV = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const NOMBRE = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Rango de RESPALDO: ABR2023 .. mes actual. La lista real viene de dim_periodo
// (el layout la pasa al PeriodSelector); esta solo cubre componentes de cliente
// sin acceso a datos, así que se genera hasta hoy en vez de caparse a una fecha
// fija — el tope MAY2026 escondía junio tras la primera ingesta de 2026-06.
export const PERIODOS: string[] = (() => {
  const hoy = new Date();
  const yFin = hoy.getFullYear(), mFin = hoy.getMonth() + 1;
  const out: string[] = [];
  let y = 2023, m = 4;
  while (y < yFin || (y === yFin && m <= mFin)) {
    out.push(ABREV[m - 1] + y);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
})();

export const PERIODO_DEFAULT = PERIODOS[PERIODOS.length - 1]; // mes actual

export function etqNombre(etq: string): string {
  const m = ABREV.indexOf(etq.slice(0, 3));
  return m < 0 ? etq : `${NOMBRE[m]} ${etq.slice(3)}`;
}
