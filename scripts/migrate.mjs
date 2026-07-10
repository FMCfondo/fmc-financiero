// Migración: crea el esquema y carga la semilla real en Neon.
// Uso: node scripts/migrate.mjs   (lee DATABASE_URL de .env.local)
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import pg from "pg";

// --- DATABASE_URL desde entorno o .env.local ---
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = env.match(/DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/);
    if (m) dbUrl = m[1].trim();
  } catch {}
}
if (!dbUrl) { console.error("Falta DATABASE_URL"); process.exit(1); }

// Para migración: endpoint DIRECTO (sin -pooler) y sin channel_binding (mejor para DDL/carga).
const migUrl = dbUrl.replace("-pooler", "").replace(/&?channel_binding=require/, "");

const client = new pg.Client({ connectionString: migUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("Conectado a Neon.");

// Reset idempotente + esquema
await client.query(`
  drop view if exists v_movimiento_ajustado cascade;
  drop table if exists fact_saldo, fact_ajuste, fact_presupuesto, fact_inversion,
    map_cuenta_linea, linea_estado, estado, dim_periodo, dim_cuenta, ingesta, parametro, perfil, auditoria cascade;
`);
await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("Esquema creado.");

function rows(file) {
  return parse(readFileSync(new URL(`../db/${file}`, import.meta.url), "utf8"), { columns: true, skip_empty_lines: true });
}

async function load(table, file, cols, overriding, nullCols = []) {
  const data = rows(file);
  const CH = 800;
  for (let i = 0; i < data.length; i += CH) {
    const chunk = data.slice(i, i + CH);
    const tuples = [];
    const params = [];
    chunk.forEach((r, ri) => {
      const ph = cols.map((_, ci) => `$${ri * cols.length + ci + 1}`);
      tuples.push(`(${ph.join(",")})`);
      cols.forEach((c) => {
        let v = r[c];
        if (v === undefined) v = null;
        else if (v === "" && nullCols.includes(c)) v = null;
        params.push(v);
      });
    });
    const ov = overriding ? "OVERRIDING SYSTEM VALUE" : "";
    await client.query(`INSERT INTO ${table} (${cols.join(",")}) ${ov} VALUES ${tuples.join(",")}`, params);
  }
  console.log(`  ${table}: ${data.length} filas`);
}

console.log("Cargando semilla…");
await load("dim_cuenta", "dim_cuenta.csv", ["cuenta_id","codigo_puc","nombre","clase","longitud","nivel","codigo_padre","naturaleza","es_hoja"], true, ["codigo_padre"]);
await load("dim_periodo", "dim_periodo.csv", ["periodo_id","anio","mes","fecha_cierre","etiqueta"], true);
await load("estado", "estado.csv", ["estado_id","codigo","nombre"], true);
await load("linea_estado", "linea_estado.csv", ["linea_id","estado_id","orden","etiqueta","nivel_indent","tipo"], true);
await load("map_cuenta_linea", "map_cuenta_linea.csv", ["linea_id","cuenta_id"], false);
await load("fact_saldo", "fact_saldo.csv", ["periodo_id","cuenta_id","saldo_acumulado","movimiento_mes"], false, ["saldo_acumulado"]);

for (const [t, c] of [["dim_cuenta","cuenta_id"],["dim_periodo","periodo_id"],["estado","estado_id"],["linea_estado","linea_id"]]) {
  await client.query(`select setval(pg_get_serial_sequence('${t}','${c}'), (select max(${c}) from ${t}))`);
}

// Verificación
const one = async (sql) => (await client.query(sql)).rows[0];
const c = await one("select (select count(*) from dim_cuenta) cuentas, (select count(*) from dim_periodo) periodos, (select count(*) from fact_saldo) saldos");
console.log("Conteos:", c);
const a = await one(`select fs.movimiento_mes as total_activos_may2026
  from fact_saldo fs
  join dim_cuenta dc on dc.cuenta_id = fs.cuenta_id
  join dim_periodo dp on dp.periodo_id = fs.periodo_id
  where dc.codigo_puc = '1' and dp.etiqueta = 'MAY2026'`);
console.log("Verificación:", a, "(esperado 1664227362.73)");

await client.end();
console.log("Migración completada.");
