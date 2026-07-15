// Diagnóstico de la cuenta 2640 (Obligaciones de Garantías):
// estructura completa del subárbol + movimiento mes a mes desde el primer período.
// Sirve para acotar en qué mes aparece una diferencia contra el informe de gestión.
import { readFileSync } from "node:fs";
import pg from "pg";

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  dbUrl = env.match(/DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/)[1].trim();
}
const url = dbUrl.replace("-pooler", "").replace(/&?channel_binding=require/, "");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const ETQ = "MAY2026";
const n = (x) => Number(x || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });

// --- 1. Subárbol completo de 2640 ---
const { rows: arbol } = await client.query(
  `select c.codigo_puc, c.nombre, c.longitud, c.es_hoja,
          abs(coalesce(s.saldo_acumulado,0))::float8 saldo
     from dim_cuenta c
     join dim_periodo p on p.etiqueta = $1
     left join fact_saldo s on s.cuenta_id = c.cuenta_id and s.periodo_id = p.periodo_id
    where c.codigo_puc like '2640%'
    order by c.codigo_puc`,
  [ETQ],
);
console.log(`\n=== SUBÁRBOL DE 2640 · ${ETQ} ===`);
for (const r of arbol) {
  const ind = "  ".repeat(Math.max(0, (r.longitud - 4) / 2));
  console.log(`  ${r.codigo_puc.padEnd(12)} ${ind}${r.nombre.padEnd(44 - ind.length)} ${n(r.saldo).padStart(18)}${r.es_hoja ? "  (hoja)" : ""}`);
}

// --- 2. Movimiento mes a mes de 2640 ---
const { rows: mov } = await client.query(
  `select p.etiqueta, p.anio, p.mes,
          abs(coalesce(s.saldo_acumulado,0))::float8 saldo,
          coalesce(s.movimiento_mes,0)::float8 movim
     from dim_periodo p
     left join dim_cuenta c on c.codigo_puc = '2640'
     left join fact_saldo s on s.cuenta_id = c.cuenta_id and s.periodo_id = p.periodo_id
    order by p.anio, p.mes`,
);
console.log(`\n=== 2640 MES A MES (saldo acumulado y variación) ===`);
let prev = null;
for (const r of mov) {
  const delta = prev === null ? null : r.saldo - prev;
  const d = delta === null ? "" : (delta >= 0 ? "+" : "") + n(delta);
  console.log(`  ${r.etiqueta.padEnd(9)} saldo ${n(r.saldo).padStart(18)}   Δ ${d.padStart(16)}`);
  prev = r.saldo;
}

// --- 3. Contraste contra el informe de gestión ---
const INFORME = 1496354490;
const conta = mov[mov.length - 1]?.saldo ?? 0;
console.log(`\n=== CONTRASTE ===`);
console.log(`  Informe de gestión : ${n(INFORME).padStart(18)}`);
console.log(`  Contabilidad (2640): ${n(conta).padStart(18)}`);
console.log(`  DIFERENCIA         : ${n(INFORME - conta).padStart(18)}`);

await client.end();
