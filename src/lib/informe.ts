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
import { LINEAS_ACTIVO, LINEAS_PASIVO, LINEAS_RESULTADO, type ClaveNota, type LineaBalance } from "./informe-cuentas";
import { detectarAnomalias } from "./anomalias";
import { redactarNotas, type DatosNotas } from "./informe-notas";
import * as C from "./informe-cuentas";
import { mesNombre, mesCorto } from "./format";
import { pptoAcumulado, pptoMes } from "./informe-ppto";
import type { Modo } from "./informe-cuentas";
import { portafolio } from "./inversiones";
import { CTA_BOLD } from "./informe-cuentas";
import { esf, COSTO_COBERTURA, DEP_AMORT } from "./statements";
import type { FilaBalance, FilaInteranual, FilaResultados, Informe, Nota, Portafolio, Tarjeta } from "./informe-tipos";

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
      clave: l.clave,
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
    notas: [] as Nota[], // las pone construirInforme() desde informe-notas.ts
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
      etiqueta: l.etiqueta, nivel: l.nivel, signo: l.signo, esGasto: l.esGasto, clave: l.clave,
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

/* Página 5: el detalle de gastos, con las mismas tres ejecuciones que la página 4 pero
 * en PESOS — aquí caben, porque son dos columnas de ejecutado y no siete.
 *
 * Las filas salen del ÁRBOL del presupuesto (rubros y sus subcuentas), no de una lista
 * escrita en el código: si el analista añade un rubro al presupuesto, aparece solo. Las
 * etiquetas son las del presupuesto, así que renombrar una línea del informe se hace
 * editando el presupuesto, no tocando código.
 *
 * Solo se imprimen las filas con algo que decir: una subcuenta sin real y sin meta no
 * aporta y el certificado tampoco la lista. Las que tienen meta pero no real llevan raya
 * en el real — nunca un cero inventado. */
function seccionGastos(etq: string) {
  const p = D.periodo(etq);
  const meses = D.periodos.filter((q) => q.anio === p.anio && q.mes <= p.mes);
  const pct = (real: number | null, meta: number | null) =>
    real === null || meta === null || meta === 0 ? null : (real / meta) * 100;

  // El bloque de gastos del presupuesto: entre el total de administración y el EBITDA.
  const bloque = D.presupuesto
    .filter((l) => l.anio === p.anio && l.orden > 8 && l.orden < 43 && l.nivel >= 1)
    .sort((a, b) => a.orden - b.orden);

  /* Un rubro puede colgar de otro: «Restaurantes» es 519560, que vive dentro de
     «Diversos» (5195), y el informe los lista por separado. Sin descontarlo, el gasto
     aparece dos veces y el rubro padre queda inflado. Se resta cualquier OTRO rubro del
     mismo nivel cuya cuenta sea descendiente de la propia. */
  const hermanosDentro = (l: D.PptoLinea) =>
    bloque.filter((o) => o.orden !== l.orden && o.nivel === l.nivel
      && o.cuentas.some((c) => l.cuentas.some((padre) => c !== padre && c.startsWith(padre))));

  const suma = (cuentas: string[], modo: Modo) =>
    cuentas.reduce((s, c) => s + (modo === "acum" ? D.ytd(etq, c) : D.fact(etq, c)), 0);

  const real = (l: D.PptoLinea, modo: Modo) => {
    if (!l.cuentas.length) return null;
    const propio = suma(l.cuentas, modo);
    const dentro = hermanosDentro(l).reduce((s, o) => s + suma(o.cuentas, modo), 0);
    return propio - dentro;
  };

  const filas: FilaResultados[] = bloque.map((l) => {
    const mes = real(l, "mes"), acumulado = real(l, "acum");
    const pMes = pptoMes(l, p.mes), pAcum = pptoAcumulado(l, p.mes), pAnual = l.total;
    return {
      etiqueta: l.etiqueta, nivel: "det" as const, esGasto: true,
      sangria: (l.nivel >= 2 ? 1 : 0) as 0 | 1,
      meses: meses.map((m) => (l.cuentas.length
        ? l.cuentas.reduce((s, c) => s + D.fact(m.etiqueta, c), 0)
          - hermanosDentro(l).reduce((s, o) => s + o.cuentas.reduce((t, c) => t + D.fact(m.etiqueta, c), 0), 0)
        : 0)),
      mes: mes ?? 0, acumulado: acumulado ?? 0,
      pptoMes: pMes, pptoAcumulado: pAcum, pptoAnual: pAnual,
      ejecMesPct: pct(mes, pMes),
      ejecAcumuladaPct: pct(acumulado, pAcum),
      ejecAnualPct: pct(acumulado, pAnual),
      // Marca para que la vista imprima raya y no un cero: la línea no está mapeada.
      signo: l.cuentas.length ? undefined : "—",
    };
  /* Los rubros estructuran la página y se quedan aunque estén en cero. Una SUBCUENTA sin
     ejecución no aporta nada: el certificado tampoco la lista. */
  }).filter((f) => (f.sangria ? f.acumulado !== 0 || f.mes !== 0
    : f.mes !== 0 || f.acumulado !== 0 || f.pptoMes !== 0 || f.pptoAcumulado !== 0 || f.pptoAnual !== 0));

  /* RESIDUAL. El presupuesto desglosa algunos rubros en subcuentas, pero no todas tienen
     cuenta PUC mapeada. Sin esta fila, ese gasto se ve en el total del rubro y en ninguna
     línea: dinero real escondido. Se muestra como «Otros» bajo su rubro. */
  const conResidual: FilaResultados[] = [];
  for (const f of filas) {
    conResidual.push(f);
    if (f.sangria) continue;
    const rubro = bloque.find((l) => l.etiqueta === f.etiqueta && l.nivel === 1);
    if (!rubro || !rubro.cuentas.length) continue;
    const hijas = bloque.filter((l) => l.nivel === 2 && l.orden > rubro.orden
      && l.orden < (bloque.find((o) => o.nivel === 1 && o.orden > rubro.orden)?.orden ?? 1e9));
    if (!hijas.length) continue;
    const mapeadas = hijas.filter((l) => l.cuentas.length);
    if (mapeadas.length === hijas.length) continue;   // todo mapeado: no hay residual
    const resMes = f.mes - mapeadas.reduce((s, l) => s + suma(l.cuentas, "mes"), 0);
    const resAcum = f.acumulado - mapeadas.reduce((s, l) => s + suma(l.cuentas, "acum"), 0);
    if (Math.round(resMes) === 0 && Math.round(resAcum) === 0) continue;
    conResidual.push({
      etiqueta: "Otros", nivel: "det", esGasto: true, sangria: 1,
      meses: [], mes: resMes, acumulado: resAcum,
      pptoMes: null, pptoAcumulado: null, pptoAnual: null,
      ejecMesPct: null, ejecAcumuladaPct: null, ejecAnualPct: null,
    });
  }

  return { filas: conResidual, notas: [] as Nota[] };
}

/* Página 1: nueve cifras y cuatro series mensuales.
 * Las cuatro primeras tarjetas miran el BALANCE contra el año anterior; las cuatro
 * siguientes, el RESULTADO contra el presupuesto. Ojo con la base: ingresos y gastos se
 * comparan contra la meta ACUMULADA a la fecha, y EBITDA y utilidad contra la ANUAL —
 * así lo hace el informe certificado, y mezclarlas daría lecturas incomparables. */
function seccionResumen(etq: string, res: { filas: FilaResultados[] }, port: Portafolio) {
  const e = esf(etq);
  const prev = D.sameMonthPrevYear(etq);
  const fila = (n: string) => res.filas.find((f) => f.etiqueta === n);
  const respaldo = C.disponible(etq) + C.inversionesLiquidas(etq);

  const varIA = (actual: number, calcPrev: (p: string) => number) => {
    if (!prev) return null;
    const antes = calcPrev(prev.etiqueta);
    return Math.abs(antes) < 1 ? null : ((actual - antes) / Math.abs(antes)) * 100;
  };
  const pctTxt = (v: number | null, signo = false) =>
    v === null ? "—" : `${signo && v > 0 ? "+" : ""}${Math.round(v).toLocaleString("es-CO")}%`;
  const pct1 = (v: number | null) =>
    v === null ? "—" : `${v.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  const vActivo = varIA(e.totalActivo, (p) => esf(p).totalActivo);
  const vPatrim = varIA(e.totalPatrim, (p) => esf(p).totalPatrim);
  const meta = (n: string, anual: boolean) => {
    const f = fila(n);
    if (!f) return null;
    const base = anual ? f.pptoAnual : f.pptoAcumulado;
    return base ? (f.acumulado / base) * 100 : null;
  };

  const tarjetas: Tarjeta[] = [
    { etiqueta: "Activo total", valor: e.totalActivo,
      destacado: pctTxt(vActivo, true), contexto: prev ? `frente a ${mesNombre[prev.mes].toLowerCase()} ${prev.anio}` : "sin comparativo",
      tono: vActivo === null ? null : vActivo >= 0 ? "pos" : "neg" },
    { etiqueta: "Respaldo líquido", valor: respaldo,
      contexto: `${pct1(e.totalActivo ? (respaldo / e.totalActivo) * 100 : null)} del activo total`, tono: null },
    { etiqueta: "Reservas técnicas", valor: C.pasivosEstimados(etq),
      contexto: `${pct1(e.totalPasivo ? (C.pasivosEstimados(etq) / e.totalPasivo) * 100 : null)} del pasivo`, tono: null },
    { etiqueta: "Patrimonio", valor: e.totalPatrim,
      destacado: pctTxt(vPatrim, true), contexto: "interanual",
      tono: vPatrim === null ? null : vPatrim >= 0 ? "pos" : "neg" },
    { etiqueta: "Ingresos acumulados", valor: fila("INGRESOS DE OPERACIÓN")?.acumulado ?? 0,
      destacado: pctTxt(meta("INGRESOS DE OPERACIÓN", false)), contexto: `de la meta a ${mesNombre[D.periodo(etq).mes].toLowerCase()}`,
      tono: (meta("INGRESOS DE OPERACIÓN", false) ?? 0) >= 100 ? "pos" : "neg" },
    { etiqueta: "Gastos acumulados", valor: fila("Gastos de Administración")?.acumulado ?? 0,
      destacado: pctTxt(meta("Gastos de Administración", false)), contexto: `de la meta a ${mesNombre[D.periodo(etq).mes].toLowerCase()}`,
      // En gastos la lectura se invierte: pasarse de la meta no es una buena noticia.
      tono: (meta("Gastos de Administración", false) ?? 0) <= 100 ? "pos" : "neg" },
    { etiqueta: "EBITDA acumulado", valor: fila("EBITDA")?.acumulado ?? 0,
      destacado: pct1(meta("EBITDA", true)), contexto: "de la meta anual",
      tono: (meta("EBITDA", true) ?? 0) >= 100 ? "pos" : null },
    { etiqueta: "Utilidad neta acumulada", valor: fila("UTILIDAD NETA")?.acumulado ?? 0,
      destacado: pct1(meta("UTILIDAD NETA", true)), contexto: "de la meta anual",
      tono: (meta("UTILIDAD NETA", true) ?? 0) >= 100 ? "pos" : null },
    { etiqueta: "Portafolio de inversiones", valor: port.total,
      contexto: `${port.posiciones.length} posiciones · ${port.concilia ? "concilia con el balance" : "NO concilia con el balance"}`,
      tono: port.concilia ? null : "neg" },
  ];

  const serie = (n: string) => fila(n)?.meses ?? [];
  const etiquetas = res.filas[0]?.meses.map((_, i) =>
    mesCorto[D.periodos.filter((q) => q.anio === D.periodo(etq).anio && q.mes <= D.periodo(etq).mes)[i]?.mes ?? 1]) ?? [];

  return {
    tarjetas,
    evolucion: [
      { titulo: "Ingresos de operación", valores: serie("INGRESOS DE OPERACIÓN"), etiquetas },
      { titulo: "Gastos de administración", valores: serie("Gastos de Administración"), etiquetas },
      { titulo: "EBITDA", valores: serie("EBITDA"), etiquetas },
      { titulo: "Utilidad neta", valores: serie("UTILIDAD NETA"), etiquetas },
    ],
    notas: [] as Nota[],
  };
}

/* ------------------------------------------------------------------ notas ---
 * Las notas del período NO las escribe una IA. informe-notas.ts las redacta con
 * plantillas deterministas sobre las cifras que estas mismas secciones ya
 * conciliaron; la CAUSA de una variación atípica la escribe una persona en
 * Operación › Revisión del cierre, y se guarda en `nota_periodo` contra una
 * cuenta PUC. Aquí solo se juntan las dos mitades.
 *
 * Una partida queda PENDIENTE cuando el detector de anomalías marcó alguna de sus
 * cuentas y nadie ha escrito la explicación. Con una sola pendiente el informe no
 * debe exportarse: eso lo decide `puedeExportar()`.
 */
const CUENTAS_DE_LA_CAUSA: Record<string, (codigo: string) => boolean> = {
  clientes: (c) => c.startsWith("13"),          // la cartera del informe cuelga del 13
  impuestosPorPagar: (c) => c.startsWith("24"),
  /* Gastos de administración = grupo 51 SIN el costo de cobertura ni dep/amort,
     que cuelgan del mismo grupo pero llevan fila propia en el informe. Sin esta
     resta, un movimiento del costo de cobertura bloqueaba el informe pidiendo
     explicar unos gastos administrativos que no se habían movido. */
  gastosAdmin: (c) =>
    c.startsWith("51") && !c.startsWith(COSTO_COBERTURA)
    && !DEP_AMORT.some((d) => c.startsWith(d)),
};

async function notasDelInforme(
  etq: string,
  activos: FilaBalance[],
  pasivos: FilaBalance[],
  resultados: FilaResultados[],
) {
  const p = D.periodo(etq);
  const escritas = await D.leerNotas(p.anio, p.mes);
  const anomalias = detectarAnomalias(etq);

  const causas: Record<string, string> = {};
  const pendientes: string[] = [];
  for (const [clave, esDeLaPartida] of Object.entries(CUENTAS_DE_LA_CAUSA)) {
    const texto = escritas
      .filter((n) => n.codigo && esDeLaPartida(n.codigo) && n.cuerpo.trim())
      .map((n) => n.cuerpo.trim())
      .join(" ");
    if (texto) causas[clave] = texto;
    else if (anomalias.some((a) => esDeLaPartida(a.codigo))) pendientes.push(clave);
  }

  /* Si una clave no aparece es que alguien tocó las líneas sin actualizar el
     contrato. Se rompe aquí a propósito: una nota que imprima cero a la Junta es
     peor que una página que no carga. */
  const falta = (clave: ClaveNota): never => {
    throw new Error(`El informe no encuentra la partida «${clave}». Revisar la clave en informe-cuentas.ts.`);
  };

  const partida = (filas: FilaBalance[], clave: ClaveNota) => {
    const f = filas.find((x) => x.clave === clave) ?? falta(clave);
    const actual = f.meses[f.meses.length - 1] ?? 0;
    const anterior = f.meses[f.meses.length - 2] ?? 0;
    return { actual, anterior, interanual: f.interanual,
             varMesPesos: actual - anterior, varIAPesos: f.varIAPesos, varIAPct: f.varIAPct };
  };

  const linea = (clave: ClaveNota) => {
    const f = resultados.find((x) => x.clave === clave) ?? falta(clave);
    return { mes: f.mes, acumulado: f.acumulado, pptoAcumulado: f.pptoAcumulado,
             pptoAnual: f.pptoAnual, cumplAcumPct: f.ejecAcumuladaPct, ejecAnualPct: f.ejecAnualPct };
  };

  const balance = {
    activoTotal: partida(activos, "activoTotal"),
    inversionesLiquidas: partida(activos, "inversionesLiquidas"),
    disponible: partida(activos, "disponible"),
    totalDisponibleInversiones: partida(activos, "totalDisponibleInversiones"),
    clientes: partida(activos, "clientes"),
    anticipoImpuestos: partida(activos, "anticipoImpuestos"),
    ppeNeto: partida(activos, "ppeNeto"),
    activosDiferidos: partida(activos, "activosDiferidos"),
    pasivoTotal: partida(pasivos, "pasivoTotal"),
    pasivosEstimados: partida(pasivos, "pasivosEstimados"),
    impuestosPorPagar: partida(pasivos, "impuestosPorPagar"),
    patrimonioTotal: partida(pasivos, "patrimonioTotal"),
    utilidadNetaBalance: partida(pasivos, "utilidadNetaBalance"),
  };

  // Los mismos dos porcentajes que imprimen las tarjetas de la página 1.
  const sobre = (parte: number, todo: number) => (Math.abs(todo) < 1 ? 0 : (parte / todo) * 100);

  const datos: DatosNotas = {
    mes: p.mes,
    anio: p.anio,
    balance,
    resultados: {
      ingresosOperacion: linea("ingresosOperacion"),
      gastosAdmin: linea("gastosAdmin"),
      utilidadNeta: linea("utilidadNeta"),
      ebitda: linea("ebitda"),
    },
    indicadores: {
      pctRespaldoSobreActivo: sobre(balance.totalDisponibleInversiones.actual, balance.activoTotal.actual),
      pctReservasSobrePasivo: sobre(balance.pasivosEstimados.actual, balance.pasivoTotal.actual),
    },
    causas,
    pendientes,
  };

  return redactarNotas(datos);
}

export async function construirInforme(etq: string): Promise<Informe> {
  await D.ensureLoaded();
  const p = D.periodo(etq);
  const resultados = seccionResultados(etq);
  const portafolioInf = seccionPortafolio(etq);
  const balanceActivos = seccionBalance(etq, LINEAS_ACTIVO);
  const balancePasivos = seccionBalance(etq, LINEAS_PASIVO);
  const resumen = seccionResumen(etq, resultados, portafolioInf);

  const notas = await notasDelInforme(etq, balanceActivos.filas, balancePasivos.filas, resultados.filas);
  resumen.notas = notas.situacion;
  balanceActivos.notas = notas.activos;
  balancePasivos.notas = notas.pasivos;
  resultados.notas = notas.resultados;

  return {
    periodo: {
      anio: p.anio,
      mes: p.mes,
      etiqueta: p.etiqueta,
      corte: `${mesNombre[p.mes]} de ${p.anio}`,
    },

    // --- páginas 2 y 3, conciliadas al peso contra el informe certificado ---
    balanceActivos,
    balancePasivos,

    resumen,
    resultados,
    gastos: seccionGastos(etq),
    interanual: seccionInteranual(etq),
    portafolio: portafolioInf,

    origen: {
      fuente: `Balance de prueba de ${mesNombre[p.mes]} ${p.anio}, cargado en la aplicación`,
      generado: p.etiqueta,
    },
  };
}
