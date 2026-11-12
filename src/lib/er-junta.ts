import "server-only";
import * as D from "./data";
import { LINEAS_RESULTADO, type Detalle, type LineaResultado } from "./informe-cuentas";
import { mesCorto } from "./format";
import type { NodoM } from "./statements";

/* EL ESTADO DE RESULTADOS CON LA ESTRUCTURA DEL INFORME DE JUNTA (pedido del usuario,
   2026-11-12: «la que uso y me gusta es la del informe de junta, incluso es la que uso
   para el presupuesto»). Las líneas, sus signos y sus cifras son las de la página 4 del
   informe (`LINEAS_RESULTADO`): aquí no se define ninguna fórmula. Lo único nuevo es que
   cada línea se despliega en las cuentas del PUC de las que sale (`detalle` en cada
   línea), para no perder el detalle que tenía el árbol de cuentas. */

export type LineaER = {
  /** Clave estable para expandir la línea (no es una cuenta). */
  clave: string;
  etiqueta: string;
  signo: LineaResultado["signo"];
  nivel: LineaResultado["nivel"];
  vals: number[];
  acum: number;
  /** Las cuentas de la línea, ya podadas de lo que pertenece a otras líneas. */
  hijos: NodoM[];
};

/** Una cuenta y su árbol, sin las subcuentas excluidas: se restan del valor de cada
 *  ancestro y no aparecen. Así los subtotales siguen cuadrando con su línea. */
function nodoPodado(codigo: string, etqs: string[], etqAcum: string, depth: number, d: Detalle): NodoM | null {
  const c = D.cuentaByCodigo.get(codigo);
  if (!c) return null;
  const fuera = (d.excluir ?? []).filter((x) => x !== codigo && x.startsWith(codigo));
  const signo = d.signo ?? 1;
  const valor = (f: (e: string, c: string) => number, e: string) =>
    signo * (f(e, codigo) - fuera.reduce((s, x) => s + f(e, x), 0));
  const hijos = D.children(codigo)
    .filter((h) => !(d.excluir ?? []).includes(h.codigo))
    .map((h) => nodoPodado(h.codigo, etqs, etqAcum, depth + 1, d))
    .filter((x): x is NodoM => x !== null);
  const vals = etqs.map((e) => valor(D.fact, e));
  const acum = valor(D.ytd, etqAcum);
  if (vals.every((v) => Math.abs(v) < 0.005) && Math.abs(acum) < 0.005 && hijos.length === 0) return null;
  return { codigo, nombre: c.nombre, depth, vals, acum, hijos };
}

/** Las cuentas de una línea, como hijas de profundidad 1 (la línea es la 0). */
function detalleDe(l: LineaResultado, etqs: string[], etqAcum: string): NodoM[] {
  return (l.detalle ?? []).flatMap((d) => {
    const n = nodoPodado(d.codigo, etqs, etqAcum, d.soloHijos ? 0 : 1, d);
    return !n ? [] : d.soloHijos ? n.hijos : [n];
  });
}

/** El ER del informe para los meses dados: cada mes es el movimiento del mes y `acum`
 *  el acumulado del año al último mes, como en la pantalla anterior. */
export function erJunta(meses: { etiqueta: string; anio: number; mes: number }[]) {
  const etqs = meses.map((m) => m.etiqueta);
  const ultimo = etqs[etqs.length - 1];
  const lineas: LineaER[] = LINEAS_RESULTADO.filter((l) => !l.oculta).map((l, i) => ({
    clave: `linea-${i}`,
    etiqueta: l.etiqueta,
    signo: l.signo,
    nivel: l.nivel,
    vals: etqs.map((e) => l.valor(e, "mes")),
    acum: l.valor(ultimo, "acum"),
    hijos: detalleDe(l, etqs, ultimo),
  }));
  return { labels: meses.map((m) => `${mesCorto[m.mes]} ${String(m.anio).slice(2)}`), lineas };
}
