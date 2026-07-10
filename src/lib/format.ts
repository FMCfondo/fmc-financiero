// Formato de cifras (Colombia)
const cop0 = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const num0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export const fmtCOP = (n: number) => cop0.format(Math.round(n || 0));
export const fmtNum = (n: number) => num0.format(Math.round(n || 0));
export const fmtPct = (n: number) => `${num2.format((n || 0) * 100)}%`;

// Compacto para tarjetas/gráficos: 1.664 M, 84,8 M, 1,2 B
export function fmtCompact(n: number): string {
  const a = Math.abs(n || 0);
  const s = n < 0 ? "-" : "";
  if (a >= 1e12) return `${s}${num2.format(a / 1e12)} B`;
  if (a >= 1e9) return `${s}${num2.format(a / 1e9)} MM`;
  if (a >= 1e6) return `${s}${num2.format(a / 1e6)} M`;
  if (a >= 1e3) return `${s}${num0.format(a / 1e3)} k`;
  return `${s}${num0.format(a)}`;
}

export const mesNombre = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const mesCorto = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
