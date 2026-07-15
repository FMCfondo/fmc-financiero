// Formato de cifras (Colombia)
const cop0 = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const num0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export const fmtCOP = (n: number) => cop0.format(Math.round(n || 0));
export const fmtNum = (n: number) => num0.format(Math.round(n || 0));
export const fmtPct = (n: number) => `${num2.format((n || 0) * 100)}%`;

/* Cifra redondeada a millones: "$ 1.496 millones".
   Se usa SOLO para las cifras de reservas del Resumen del Dashboard, mientras se
   concilia la contabilidad con el informe de gestión: redondeado, ambos dicen lo
   mismo y no se abre la pregunta por una diferencia que está en revisión. */
export function fmtMillones(n: number): string {
  const m = Math.round((n || 0) / 1e6);
  return `$ ${num0.format(m)} millones`;
}

/* Formato CONTABLE, sólo para los estados financieros (no para tarjetas ni gráficos).
   Convención de informe financiero (GAAP/IFRS, y lo que hace NetSuite en pantalla):
     · negativos entre PARÉNTESIS, no con signo menos — el menos mide dos píxeles,
       va a la izquierda donde el ojo no está, y se pierde al escanear una columna
     · el símbolo va FUERA del paréntesis: $(123), nunca ($123)
     · el cero se imprime como raya, no como 0
     · el $ sólo en la primera línea de la columna y en los totales                    */
export function fmtCont(n: number, simbolo = false): string {
  const v = Math.round(n || 0);
  if (v === 0) return "—";
  const abs = num0.format(Math.abs(v));
  const cuerpo = v < 0 ? `(${abs})` : abs;
  return simbolo ? `$ ${cuerpo}` : cuerpo;
}

/** Porcentaje en formato contable: (1,2)% — el símbolo fuera del paréntesis. */
export function fmtPctCont(n: number): string {
  const v = (n || 0) * 100;
  if (Math.abs(v) < 0.05) return "—";
  return v < 0 ? `(${num2.format(Math.abs(v))})%` : `${num2.format(v)}%`;
}

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
