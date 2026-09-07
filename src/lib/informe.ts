/* Ensamblador del Informe de Junta.
 *
 * REGLA DE ORO: aquí NO se calcula nada nuevo. Se consultan los motores ya validados
 * (statements / ejecucion / inversiones / presupuesto) y se ORGANIZA el resultado en la
 * forma que describe informe-tipos.ts. Si una cifra del informe difiere de la que muestra
 * el módulo de Estados Financieros, es un bug de este archivo — nunca una fórmula nueva.
 *
 * Las composiciones de línea viven en informe-cuentas.ts, que es el único sitio donde se
 * define de qué cuentas PUC está hecha cada línea. Este archivo solo las ordena.
 *
 * La ruta /api/conciliacion verifica estas mismas líneas contra el Excel certificado.
 */
import "server-only";
import * as D from "./data";
import { LINEAS_ACTIVO, LINEAS_PASIVO, LINEAS_RESULTADO, type LineaBalance } from "./informe-cuentas";
import { mesNombre, mesCorto } from "./format";
import { filaPpto, pptoAcumulado, pptoMes } from "./informe-ppto";
import type { FilaBalance, FilaResultados, Informe, Nota } from "./informe-tipos";

/** Ventana del balance: el período y los tres meses anteriores. En el Excel esto se hacía
 *  ocultando columnas a mano. */
const VENTANA = 4;

function seccionBalance(
  etq: string,
  contrato: LineaBalance[],
): { etiquetasMeses: string[]; filas: FilaBalance[]; notas: Nota[] } {
  const meses = D.ultimosPeriodos(etq, VENTANA);
  const anterior = D.sameMonthPrevYear(etq);

  const filas: FilaBalance[] = contrato.map((l) => {
    const valores = meses.map((m) => l.valor(m.etiqueta));
    const actual = valores[valores.length - 1] ?? 0;
    const interanual = anterior ? l.valor(anterior.etiqueta) : 0;
    const varIAPesos = actual - interanual;
    return {
      etiqueta: l.etiqueta,
      nivel: l.nivel,
      meses: valores,
      interanual,
      varIAPesos,
      /* Sin base no hay porcentaje: null, no cero. Y la base se mide en la unidad que
         el informe IMPRIME —pesos enteros—, no en el float: la cuenta 1395 arrastra
         catorce centavos que se imprimen como raya, y contra esa base salía un
         "+600%" que no significa nada. */
      varIAPct: Math.abs(interanual) < 1 ? null : (varIAPesos / Math.abs(interanual)) * 100,
    };
  });

  return {
    etiquetasMeses: meses.map((m) => mesNombre[m.mes]),
    filas,
    notas: [], // fase 3: las escribe informe-notas.ts
  };
}

/* Página 4: la serie del año más LAS TRES EJECUCIONES.
 * Son tres medidas distintas y NUNCA se mezclan en la misma columna:
 *   · del mes    → el mes contra el presupuesto de ESE mes
 *   · acumulada  → enero..mes contra el presupuesto del mismo tramo
 *   · del año    → enero..mes contra el presupuesto anual completo
 * Una línea sin fila de presupuesto no lleva metas: se imprime raya, nunca un cero. */
function seccionResultados(etq: string) {
  const p = D.periodo(etq);
  const meses = D.periodos.filter((q) => q.anio === p.anio && q.mes <= p.mes);
  const ultimo = meses[meses.length - 1];
  const pct = (real: number, meta: number | null) =>
    meta === null || meta === 0 ? null : (real / meta) * 100;

  const filas: FilaResultados[] = LINEAS_RESULTADO.map((l) => {
    const serie = meses.map((m) => l.valor(m.etiqueta, "mes"));
    const mes = l.valor(ultimo.etiqueta, "mes");
    const acumulado = l.valor(ultimo.etiqueta, "acum");
    const ppto = l.pptoOrden
      ? D.presupuesto.find((x) => x.anio === p.anio && x.orden === l.pptoOrden) ?? null
      : null;
    const pMes = ppto ? pptoMes(ppto, p.mes) : null;
    const pAcum = ppto ? pptoAcumulado(ppto, p.mes) : null;
    const pAnual = ppto ? ppto.total : null;
    return {
      etiqueta: l.etiqueta, nivel: l.nivel, signo: l.signo, esGasto: l.esGasto,
      meses: serie, mes, acumulado,
      pptoMes: pMes, pptoAcumulado: pAcum, pptoAnual: pAnual,
      ejecMesPct: pct(mes, pMes),
      ejecAcumuladaPct: pct(acumulado, pAcum),
      ejecAnualPct: pct(acumulado, pAnual),
    };
  });

  return { etiquetasMeses: meses.map((m) => mesCorto[m.mes]), filas, notas: [] as Nota[] };
}

export async function construirInforme(etq: string): Promise<Informe> {
  await D.ensureLoaded();
  const p = D.periodo(etq);

  return {
    periodo: {
      anio: p.anio,
      mes: p.mes,
      etiqueta: p.etiqueta,
      corte: `${mesNombre[p.mes]} de ${p.anio}`,
    },

    // --- páginas 2 y 3, conciliadas al peso contra el informe certificado ---
    balanceActivos: seccionBalance(etq, LINEAS_ACTIVO),
    balancePasivos: seccionBalance(etq, LINEAS_PASIVO),

    // --- pendientes de las siguientes tandas de la fase 1 ---
    resumen: { tarjetas: [], evolucion: [], notas: [] },
    resultados: seccionResultados(etq),
    gastos: { filas: [], notas: [] },
    interanual: { disponible: false, motivo: "Pendiente de construir.", filas: [] },
    portafolio: {
      total: 0, posiciones: [], concentracion: [],
      tasaPonderada: 0, pctActivo: 0, concilia: false,
    },

    origen: {
      fuente: `Balance de prueba de ${mesNombre[p.mes]} ${p.anio}, cargado en la aplicación`,
      generado: p.etiqueta,
    },
  };
}
