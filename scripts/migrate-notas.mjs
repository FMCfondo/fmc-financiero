// Crea la tabla `nota_periodo`: las explicaciones que el analista escribe al
// cerrar el mes sobre los movimientos que se salieron de lo habitual.
// Idempotente. Uso: node scripts/migrate-notas.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/);
  if (m) dbUrl = m[1].trim();
}
if (!dbUrl) { console.error("Falta DATABASE_URL"); process.exit(1); }
const url = dbUrl.replace("-pooler", "").replace(/&?channel_binding=require/, "");
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query(`
  create table if not exists nota_periodo (
    id         bigint generated always as identity primary key,
    anio       int  not null,
    mes        int  not null,
    codigo_puc text,
    titulo     text not null,
    cifra      text,
    cuerpo     text not null,
    creado_en  timestamptz not null default now(),
    unique (anio, mes, codigo_puc)
  );
`);
await c.query(`create index if not exists ix_nota_periodo on nota_periodo (anio, mes)`);
const { rows } = await c.query(`select count(*)::int n from nota_periodo`);
console.log("tabla nota_periodo lista. filas:", rows[0].n);
await c.end();
