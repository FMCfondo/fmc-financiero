// Diagnóstico: lista los grupos (2 dígitos) del PUC con su saldo, para evaluar
// qué indicadores son derivables. Uso: node scripts/inspect-grupos.mjs [ETIQUETA]
import { readFileSync } from "node:fs";
import pg from "pg";

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = env.match(/DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/);
    if (m) dbUrl = m[1].trim();
  } catch {}
}
if (!dbUrl) { console.error("Falta DATABASE_URL"); process.exit(1); }
const url = dbUrl.replace("-pooler", "").replace(/&?channel_binding=require/, "");

const etq = process.argv[2] || "MAY2026";
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(
  `select c.codigo_puc, c.nombre, c.clase, s.saldo_acumulado
     from dim_cuenta c
     join dim_periodo p on p.etiqueta = $1
     left join fact_saldo s on s.cuenta_id = c.cuenta_id and s.periodo_id = p.periodo_id
    where c.longitud = 2
    order by c.codigo_puc`,
  [etq],
);

const CLASES = { "1": "ACTIVO", "2": "PASIVO", "3": "PATRIMONIO", "4": "INGRESOS", "5": "GASTOS", "6": "COSTOS DE VENTA", "7": "COSTOS DE PRODUCCION" };
let clase = null;
for (const r of rows) {
  const c = r.codigo_puc[0];
  if (c !== clase) { clase = c; console.log(`\n=== CLASE ${c} — ${CLASES[c] ?? "?"} ===`); }
  const saldo = r.saldo_acumulado === null ? "(sin saldo)" : Number(r.saldo_acumulado).toLocaleString("es-CO", { maximumFractionDigits: 0 });
  console.log(`  ${r.codigo_puc}  ${r.nombre.padEnd(46)} ${saldo.padStart(18)}`);
}

const { rows: cnt } = await client.query(`select left(codigo_puc,1) clase, count(*) n from dim_cuenta group by 1 order by 1`);
console.log("\n=== cuentas por clase ===");
for (const r of cnt) console.log(`  clase ${r.clase}: ${r.n}`);

await client.end();
