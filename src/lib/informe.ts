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
import { portafolio } from "./inversiones";
import { CTA_BOLD } from "./informe-cuentas";
import { esf } from "./statements";
import type { FilaBalance, FilaInteranual, FilaResultados, Informe, Nota, Portafolio } from "./informe-tipos";

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

/* Página 6: las mismas líneas del estado de resultados, pero el mes contra el mismo mes
 * del año anterior y en PESOS. Si no hay año anterior cargado, la página se declara no
 * disponible con su motivo — no se inventa una columna vacía. */
function seccionInteranual(etq: string) {
  const prev = D.sameMonthPrevYear(etq);
  if (!prev)
    return { disponible: false, filas: [] as FilaInteranual[],
      motivo: "No hay datos del mismo mes del año anterior." };

  const filas: FilaInteranual[] = LINEAS_RESULTADO.map((l) => {
    const anioAnterior = l.valor(prev.etiqueta, "mes");
    const anioActual = l.valor(etq, "mes");
    const varPesos = anioActual - anioAnterior;
    return {
      etiqueta: l.etiqueta, nivel: l.nivel, signo: l.signo, esGasto: l.esGasto,
      anioAnterior, anioActual, varPesos,
      // La base se mide en pesos enteros, que es lo que el informe imprime.
      varPct: Math.abs(anioAnterior) < 1 ? null : (varPesos / Math.abs(anioAnterior)) * 100,
    };
  });
  return { disponible: true, filas };
}

/* Página 7. Dos decisiones del informe que el motor no toma:
 *   · Bold lleva FILA propia pero se rotula FIDUCIA — lo que se pliega es el TIPO.
 *   · La tasa es la PONDERADA POR MONTO. El Excel rotula "Tasa Prom. Pond." y calcula
 *     el promedio simple; la ponderada real es varios puntos mayor porque las fiducias
 *     pesan más y rinden más. El informe usa la real y así la rotula.
 * Solo se imprimen las posiciones CON saldo: una abierta a mitad de año está en cero
 * hasta su primer mes. */
function seccionPortafolio(etq: string): Portafolio {
  const p = portafolio(etq);
  const activas = p.posiciones.filter((x) => x.monto !== 0);
  const total = activas.reduce((s, x) => s + x.monto, 0);
  const activo = esf(etq).totalActivo;

  const porEntidad = new Map<string, number>();
  for (const x of activas) porEntidad.set(x.entidad, (porEntidad.get(x.entidad) ?? 0) + x.monto);

  return {
    total,
    /* Orden del informe: primero los CDT y luego las fiducias, y dentro de cada tipo
       por identificador. No por monto: la página se lee por clase de activo. */
    posiciones: activas.map((x) => ({
      id: x.id,
      tipo: x.cuentas.includes(CTA_BOLD) || /fiducia/i.test(x.tipo) ? "FIDUCIA" : "CDT",
      entidad: x.entidad,
      monto: x.monto,
      diasPlazo: x.diasPlazo,
      tasaEA: x.tasaEa,
    })).sort((a, b) => (a.tipo === b.tipo ? a.id.localeCompare(b.id) : a.tipo === "CDT" ? -1 : 1)),
    concentracion: [...porEntidad.entries()]
      .map(([entidad, monto]) => ({ entidad, monto, pct: total ? monto / total : 0 }))
      .sort((a, b) => b.monto - a.monto),
    tasaPonderada: total ? activas.reduce((s, x) => s + x.monto * x.tasaEa, 0) / total : 0,
    pctActivo: activo ? total / activo : 0,
    // Barrera: el total del portafolio tiene que ser el de Inversiones líquidas.
    concilia: Math.abs(total - (D.fact(etq, "12") + D.fact(etq, CTA_BOLD))) <= 1,
  };
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
    interanual: seccionInteranual(etq),
    portafolio: seccionPortafolio(etq),

    origen: {
      fuente: `Balance de prueba de ${mesNombre[p.mes]} ${p.anio}, cargado en la aplicación`,
      generado: p.etiqueta,
    },
  };
}
