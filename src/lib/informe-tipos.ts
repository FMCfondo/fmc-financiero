// =============================================================================
// contrato-informe.ts — La forma exacta de los datos que consume el informe.
// -----------------------------------------------------------------------------
// Este es el contrato entre los motores YA VALIDADOS de la app
// (statements / ejecucion / inversiones / presupuesto) y la vista del informe.
//
// REGLA DE ORO: `construirInforme()` NO calcula nada nuevo. Solo consulta los
// motores existentes y ORGANIZA el resultado. Si una cifra del informe difiere
// de la que muestra el módulo de Estados Financieros, es un bug del ensamblador,
// nunca una fórmula nueva. Los motores no se tocan.
// =============================================================================

/** Una línea impresa de un estado financiero. */
export type FilaEstado = {
  etiqueta: string;
  /** Jerarquía visual. det = detalle · sub = subtotal · sec = sección ·
   *  tot = total (doble regla) · hdr = encabezado sin cifras */
  nivel: "det" | "sub" | "sec" | "tot" | "hdr";
  /** Sangría de subcuenta (0 ó 1). */
  sangria?: 0 | 1;
  /** Signo contable de presentación: "(+)", "(−)", "(=)". Solo en resultados. */
  signo?: string;
  /** Cuentas PUC que componen la línea — para trazabilidad y para el detalle. */
  cuentas?: string[];
};

/** Fila del balance: ventana de meses + comparación interanual. */
export type FilaBalance = FilaEstado & {
  /** Valores de la ventana de meses (los últimos 4, terminando en el período). */
  meses: number[];
  /** Mismo mes del año anterior. */
  interanual: number;
  varIAPesos: number;
  varIAPct: number | null;
};

/** Fila de resultados: serie del año + LAS TRES EJECUCIONES PRESUPUESTALES.
 *
 *  Las tres son distintas y NO deben mezclarse nunca en la misma columna:
 *   · DEL MES      → mes real vs. presupuesto de ESE mes        (ppto.meses[m-1])
 *   · ACUMULADA    → enero..mes real vs. presupuesto del mismo tramo
 *   · DEL AÑO      → enero..mes real vs. presupuesto anual COMPLETO
 *  Cada bloque se imprime con su definición escrita debajo del título.
 */
export type FilaResultados = FilaEstado & {
  /** Serie enero..período (un valor por mes). */
  meses: number[];
  /** Valor del mes del período (= meses[meses.length-1]). */
  mes: number;
  /** Acumulado enero..período. */
  acumulado: number;

  pptoMes: number | null;
  pptoAcumulado: number | null;
  pptoAnual: number | null;

  ejecMesPct: number | null;
  ejecAcumuladaPct: number | null;
  ejecAnualPct: number | null;

  /** true en gastos y provisiones: invierte la lectura del semáforo
   *  (superar la meta es malo). */
  esGasto?: boolean;
};

/** Fila del comparativo contra el mismo mes del año anterior. */
export type FilaInteranual = FilaEstado & {
  anioAnterior: number;
  anioActual: number;
  varPesos: number;
  varPct: number | null;
  esGasto?: boolean;
};

export type PosicionPortafolio = {
  id: string;
  tipo: string;          // se imprime como CDT | FIDUCIA (el bolsillo digital
                         // se integra a FIDUCIA: no lleva etiqueta propia)
  entidad: string;
  monto: number;
  diasPlazo: number | null;   // null ⇒ "a la vista"
  tasaEA: number;             // fracción: 0.12 significa 12 % E.A.
};

export type Portafolio = {
  total: number;
  posiciones: PosicionPortafolio[];
  /** Ordenada de mayor a menor. La barra se escala contra la mayor, no contra
   *  el total: así se comparan entre sí. */
  concentracion: { entidad: string; monto: number; pct: number }[];
  /** Ponderada POR MONTO (no el promedio simple). Ver nota abajo. */
  tasaPonderada: number;
  /** % del activo total que representa el portafolio. */
  pctActivo: number;
  /** Debe ser true: el total tiene que cuadrar con Inversiones líquidas del
   *  balance. Si es false, el informe no debe exportarse. */
  concilia: boolean;
};

/** Una nota del informe. `causa` es lo ÚNICO que escribe una persona. */
export type Nota = {
  /** A qué bloque del informe pertenece. */
  bloque: "activos" | "pasivos" | "resultados" | "gastos" | "situacion";
  /** Texto generado por el redactor determinístico (sin IA). */
  texto: string;
  /** Explicación humana de una variación atípica, si aplica. */
  causa?: string;
  /** true cuando el detector de anomalías marcó la partida y aún no hay causa.
   *  Con al menos una en true, el PDF NO debe generarse. */
  requiereExplicacion?: boolean;
  /** Cuenta PUC que motivó la nota (para enlazarla con nota_periodo). */
  codigoPuc?: string | null;
};

/** Cifra de la franja del resumen ejecutivo. */
export type Tarjeta = {
  etiqueta: string;
  valor: number;
  /** Contexto corto: "98,3 % del activo total", "136 % de la meta a julio". */
  contexto: string;
  /** La cifra del contexto que va destacada, si la hay: "+82 %", "136 %". El diseño la
   *  imprime en negrita y con el tinte de `tono`; el resto del contexto queda en gris. */
  destacado?: string;
  /** Tinte del contexto. Verde/rojo SOLO cuando el signo tiene lectura. */
  tono?: "pos" | "neg" | null;
};

/** El informe completo: lo que consume la vista y, sin cambios, la impresión. */
export type Informe = {
  periodo: { anio: number; mes: number; etiqueta: string; corte: string };

  resumen: {
    tarjetas: Tarjeta[];
    /** Cuatro series mensuales para los gráficos de barras. */
    evolucion: { titulo: string; valores: number[]; etiquetas: string[] }[];
    notas: Nota[];
  };

  balanceActivos: { etiquetasMeses: string[]; filas: FilaBalance[]; notas: Nota[] };
  balancePasivos: { etiquetasMeses: string[]; filas: FilaBalance[]; notas: Nota[] };

  resultados: { etiquetasMeses: string[]; filas: FilaResultados[]; notas: Nota[] };
  gastos: { filas: FilaResultados[]; notas: Nota[] };

  interanual: { disponible: boolean; motivo?: string; filas: FilaInteranual[] };

  portafolio: Portafolio;

  /** Trazabilidad: de dónde salió cada cosa. Se imprime en el pie. */
  origen: { fuente: string; generado: string };
};

/** Proyección del año — pieza SEPARADA, nunca dentro del informe pre-junta.
 *  Real y plan jamás se mezclan en la misma columna. */
export type Proyeccion = {
  periodo: { anio: number; mes: number; etiqueta: string };
  filas: {
    etiqueta: string;
    nivel: "det" | "sub" | "tot";
    real: number;        // ejecutado enero..mes
    plan: number;        // presupuesto del resto del año
    proyeccion: number;  // real + plan
    pptoAnual: number;
    cumplimientoPct: number | null;
    esGasto?: boolean;
  }[];
  /** Desglose mensual en DOS bloques separados visualmente. */
  mensualReal: { meses: number[]; etiquetas: string[] };
  mensualPlan: { meses: number[]; etiquetas: string[] };
};

// -----------------------------------------------------------------------------
// NOTAS DE IMPLEMENTACIÓN (aprendidas construyendo el PDF actual)
// -----------------------------------------------------------------------------
// 1. TASA DEL PORTAFOLIO. El Excel rotula "Tasa Prom. Pond." pero calcula el
//    PROMEDIO SIMPLE de las tasas. La ponderada real por monto da varios puntos
//    más, porque las fiducias (la mayor parte del portafolio) tienen las tasas
//    más altas. El informe usa la PONDERADA REAL y así la rotula.
//
// 2. UNIDADES. Balance y detalle de gastos en PESOS; el estado de resultados en
//    MILLONES (con 7 meses + 6 columnas de ejecución no caben los pesos). Cada
//    página declara su unidad en la cabecera.
//
// 3. VENTANA DEL BALANCE. Cuatro meses (período y los tres anteriores). El
//    Excel lo hacía ocultando columnas a mano; aquí es un slice.
//
// 4. EL PRESUPUESTO DEL MES no existe como columna en el Excel: se deriva de
//    ppto.meses[mes-1]. En la app ya está disponible directo en la tabla `ppto`.
//
// 5. BARRERAS ANTES DE EXPORTAR: portafolio.concilia === true, balance cuadrado
//    (activo = pasivo + patrimonio) y cero notas con requiereExplicacion.
