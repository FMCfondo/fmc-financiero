// Diagnóstico: hijos directos de un grupo. Uso: node scripts/inspect-hijos.mjs 12 26 41 51
import { readFileSync } from "node:fs";
import pg from "pg";

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/);
  if (m) dbUrl = m[1].trim();
}
const url = dbUrl.replace("-pooler", "").replace(/&?channel_binding=require/, "");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const etq = "MAY2026";
const grupos = process.argv.slice(2);
const fmt = (n) => (n === null ? "(sin saldo)" : Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 }));

for (const g of grupos) {
  const { rows } = await client.query(
    `select c.codigo_puc, c.nombre, s.saldo_acumulado
       from dim_cuenta c
       join dim_periodo p on p.etiqueta = $2
       left join fact_saldo s on s.cuenta_id = c.cuenta_id and s.periodo_id = p.periodo_id
      where c.codigo_puc like $1 || '%' and c.longitud = 4
      order by c.codigo_puc`,
    [g, etq],
  );
  console.log(`\n=== HIJOS DE ${g} ===`);
  for (const r of rows) console.log(`  ${r.codigo_puc}  ${r.nombre.padEnd(50)} ${fmt(r.saldo_acumulado).padStart(18)}`);
}
await client.end();
