"use server";
import { revalidatePath } from "next/cache";
import { ensureLoaded, invalidateDatos } from "@/lib/data";

/*
  Carga de un período del Balance de Prueba a Neon.

  Replica las reglas del proceso original (Excel → RESUMEN):
  · RN0 — normalización de signo: Siigo entrega los saldos de las clases de
    naturaleza crédito (2, 3, 4) en negativo; se multiplican por −1 para que
    el motor trabaje con cifras positivas. Las contra-cuentas (p. ej. 4175
    devoluciones, débito dentro de una clase crédito) quedan negativas — es
    exactamente lo que hace la hoja RESUMEN.
  · RN1 — des-acumulación: el archivo de Siigo trae el ACUMULADO enero→mes.
    Clases 1–3 (y 8–9): el saldo es puntual, se guarda tal cual como
    movimiento. Clases 4–7: movimiento del mes = acumulado − acumulado del
    mes anterior (enero arranca de cero) → exige tener cargado el mes previo.

  Flujo en DOS PASOS: primero validación (no escribe nada, devuelve el
  resumen con la ecuación contable); el usuario confirma y ahí sí se escribe.
  Si el período ya existe, se REEMPLAZA (aviso previo en la validación).
*/

type FilaIn = { codigo: string; nombre: string; saldo: number };

export type ResumenCarga = {
  filas: number;
  cuentasNuevas: string[];
  reemplaza: boolean;
  requierePrev: string | null; // etiqueta del mes anterior si falta
  difEcuacion: number;
  totalActivo: number;
  totalPasivo: number;
  totalPatrim: number;
  utilidadAcum: number;
};

const MESES_ETQ = ["", "ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const etiquetaDe = (anio: number, mes: number) => `${MESES_ETQ[mes]}${anio}`;
const signoDe = (codigo: string) => (["2", "3", "4"].includes(codigo[0]) ? -1 : 1);
const esFlujo = (codigo: string) => ["4", "5", "6", "7"].includes(codigo[0]);
const NIVELES: Record<number, string> = { 1: "Clase", 2: "Grupo", 4: "Cuenta", 6: "Subcuenta", 8: "Auxiliar", 10: "Auxiliar2" };

async function conectar() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL.");
  const { neon } = await import("@neondatabase/serverless");
  return neon(url);
}

export async function cargarPeriodo(input: {
  anio: number; mes: number; archivo: string; filas: FilaIn[]; confirmar: boolean;
}): Promise<{ ok: boolean; error?: string; resumen?: ResumenCarga; cargado?: boolean }> {
  const { anio, mes, archivo, confirmar } = input;
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { ok: false, error: "Período inválido." };
  }

  // Saneo de filas: solo códigos PUC, sin duplicados (un duplicado casi siempre
  // es un archivo mal exportado — mejor frenar que sumar en silencio).
  const filas: FilaIn[] = [];
  const vistos = new Set<string>();
  for (const f of input.filas) {
    const codigo = String(f.codigo ?? "").trim();
    if (!/^\d{1,10}$/.test(codigo)) continue;
    if (vistos.has(codigo)) return { ok: false, error: `El código ${codigo} viene duplicado en el archivo.` };
    vistos.add(codigo);
    filas.push({ codigo, nombre: String(f.nombre ?? "").trim() || codigo, saldo: Number(f.saldo) || 0 });
  }
  if (filas.length < 5) return { ok: false, error: "El archivo no trae cuentas válidas (se esperan códigos PUC)." };

  const sql = await conectar();
  const etq = etiquetaDe(anio, mes);

  // --- contexto de la base ---
  const [existentes, periodoExistente, prevRows] = await Promise.all([
    sql`select codigo_puc, cuenta_id, es_hoja from dim_cuenta`,
    sql`select periodo_id from dim_periodo where anio = ${anio} and mes = ${mes}`,
    mes > 1
      ? sql`select dc.codigo_puc, fs.saldo_acumulado
              from fact_saldo fs
              join dim_periodo dp on dp.periodo_id = fs.periodo_id
              join dim_cuenta dc on dc.cuenta_id = fs.cuenta_id
             where dp.anio = ${anio} and dp.mes = ${mes - 1}`
      : Promise.resolve([] as unknown[]),
  ]);
  const idPorCodigo = new Map((existentes as any[]).map((r) => [String(r.codigo_puc), Number(r.cuenta_id)]));
  const prevRaw = new Map((prevRows as any[]).map((r) => [String(r.codigo_puc), Number(r.saldo_acumulado)]));
  const reemplaza = (periodoExistente as any[]).length > 0;
  const requierePrev = mes > 1 && (prevRows as any[]).length === 0 ? etiquetaDe(anio, mes - 1) : null;

  // --- RN0 + ecuación contable ---
  const norm = new Map(filas.map((f) => [f.codigo, f.saldo * signoDe(f.codigo)]));
  const clase = (c: string) => norm.get(c) ?? filas.filter((f) => f.codigo.length > 1 && f.codigo[0] === c).reduce((s, f) => s + (norm.get(f.codigo) ?? 0), 0);
  const totalActivo = clase("1"), totalPasivo = clase("2"), totalPatrim = clase("3");
  const utilidadAcum = clase("4") - clase("5") - clase("6") - clase("7");
  const difEcuacion = totalActivo - totalPasivo - totalPatrim - utilidadAcum;

  const cuentasNuevas = filas.filter((f) => !idPorCodigo.has(f.codigo)).map((f) => f.codigo).sort();

  const resumen: ResumenCarga = {
    filas: filas.length, cuentasNuevas, reemplaza, requierePrev,
    difEcuacion, totalActivo, totalPasivo, totalPatrim, utilidadAcum,
  };

  if (requierePrev) {
    return { ok: false, resumen, error: `Falta el mes anterior (${requierePrev}): la des-acumulación de ingresos y gastos lo necesita. Cárgalo primero.` };
  }
  if (!confirmar) return { ok: true, resumen };

  // ============ ESCRITURA ============
  // 1) Cuentas nuevas (de la más corta a la más larga: los padres primero).
  const codigosTodos = new Set([...idPorCodigo.keys(), ...filas.map((f) => f.codigo)]);
  const padreDe = (codigo: string): string | null => {
    for (let L = codigo.length - 1; L >= 1; L--) {
      const pref = codigo.slice(0, L);
      if (codigosTodos.has(pref)) return pref;
    }
    return null;
  };
  const nuevas = filas.filter((f) => !idPorCodigo.has(f.codigo)).sort((a, b) => a.codigo.length - b.codigo.length);
  for (const f of nuevas) {
    const c = f.codigo;
    const ins = await sql`
      insert into dim_cuenta (codigo_puc, nombre, clase, longitud, nivel, codigo_padre, naturaleza, es_hoja)
      values (${c}, ${f.nombre}, ${Number(c[0])}, ${c.length}, ${NIVELES[c.length] ?? "Auxiliar"},
              ${padreDe(c)}, ${["2", "3", "4"].includes(c[0]) ? "credito" : "debito"}, true)
      on conflict (codigo_puc) do update set nombre = excluded.nombre
      returning cuenta_id`;
    idPorCodigo.set(c, Number((ins as any[])[0].cuenta_id));
  }
  if (nuevas.length) {
    // Un padre con hijas deja de ser hoja.
    const padres = [...new Set(nuevas.map((f) => padreDe(f.codigo)).filter(Boolean))] as string[];
    if (padres.length) await sql`update dim_cuenta set es_hoja = false where codigo_puc = any(${padres})`;
  }

  // 2) Período (upsert) e ingesta (trazabilidad).
  const fechaCierre = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10); // último día del mes
  const per = await sql`
    insert into dim_periodo (anio, mes, fecha_cierre, etiqueta) values (${anio}, ${mes}, ${fechaCierre}, ${etq})
    on conflict (anio, mes) do update set etiqueta = excluded.etiqueta
    returning periodo_id`;
  const periodoId = Number((per as any[])[0].periodo_id);

  const ing = await sql`
    insert into ingesta (periodo_id, archivo_nombre, filas_leidas, estado_valid)
    values (${periodoId}, ${archivo}, ${filas.length}, ${Math.abs(difEcuacion) < 1 ? "ok" : "con_advertencias"})
    returning ingesta_id`;
  const ingestaId = Number((ing as any[])[0].ingesta_id);

  // 3) RN1 + hechos (reemplazo limpio del período).
  await sql`delete from fact_saldo where periodo_id = ${periodoId}`;
  const cuentaIds: number[] = [], acums: number[] = [], movs: number[] = [];
  for (const f of filas) {
    const n = norm.get(f.codigo) as number;
    const movimiento = esFlujo(f.codigo)
      ? (mes === 1 ? n : n - (prevRaw.get(f.codigo) ?? 0) * signoDe(f.codigo))
      : n;
    cuentaIds.push(idPorCodigo.get(f.codigo) as number);
    acums.push(f.saldo);        // acumulado CRUDO, como viene de Siigo
    movs.push(movimiento);      // movimiento normalizado (lo que lee el motor)
  }
  await sql`
    insert into fact_saldo (periodo_id, cuenta_id, saldo_acumulado, movimiento_mes, ingesta_id)
    select ${periodoId}, c, a, m, ${ingestaId}
      from unnest(${cuentaIds}::bigint[], ${acums}::numeric[], ${movs}::numeric[]) as t(c, a, m)`;

  // 4) Refrescar la app entera.
  invalidateDatos();
  await ensureLoaded();
  revalidatePath("/", "layout");
  return { ok: true, resumen, cargado: true };
}
