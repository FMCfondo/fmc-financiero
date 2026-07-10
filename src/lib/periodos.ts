// Lista de períodos segura para componentes de cliente (sin importar la semilla).
const ABREV = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const NOMBRE = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Rango disponible: ABR2023 .. MAY2026
export const PERIODOS: string[] = (() => {
  const out: string[] = [];
  let y = 2023, m = 4;
  while (y < 2026 || (y === 2026 && m <= 5)) {
    out.push(ABREV[m - 1] + y);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
})();

export const PERIODO_DEFAULT = PERIODOS[PERIODOS.length - 1]; // MAY2026

export function etqNombre(etq: string): string {
  const m = ABREV.indexOf(etq.slice(0, 3));
  return m < 0 ? etq : `${NOMBRE[m]} ${etq.slice(3)}`;
}
