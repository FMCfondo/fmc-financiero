// Crea la tabla `ppto` y la puebla con el Presupuesto 2026 (Estado de Resultados),
// extraído TAL CUAL de la hoja "PPTO 2026" del libro de la Junta. El extractor
// Python (scratchpad/gen_ppto.py) emite el JSON con el mapeo PUC auto-sembrado;
// aquí solo se carga. Dato real → el JSON NO va al repo.
// Idempotente: recrea las filas del año. Uso: node scripts/migrate-ppto.mjs <ruta-json>
import { readFileSync } from "node:fs";
import pg from "pg";

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/);
  if (m) dbUrl = m[1].trim();
}
if (!dbUrl) { console.error("Falta DATABASE_URL"); process.exit(1); }

const jsonPath = process.argv[2];
if (!jsonPath) { console.error("Uso: node scripts/migrate-ppto.mjs <ruta-json>"); process.exit(1); }
const { anio, filas } = JSON.parse(readFileSync(jsonPath, "utf8"));

const url = dbUrl.replace("-pooler", "").replace(/&?channel_binding=require/, "");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  create table if not exists ppto (
    id       bigint generated always as identity primary key,
    anio     int  not null,
    orden    int  not null,
    etiqueta text not null,
    nivel    smallint not null default 0,        -- 0 espina/ingresos, 1 rubro, 2 cuenta de detalle (agrupacion Excel)
    tipo     text not null default 'detalle',   -- 'detalle' | 'total' (subtotal en negrita)
    clase    text not null default 'gasto',      -- 'ingreso' | 'gasto' | 'resultado' (semaforo)
    nota     text,
    meses    numeric(18,2)[] not null,           -- 12 valores ENE..DIC
    total    numeric(18,2) not null,
    cuentas  text[] not null default '{}',       -- codigos PUC mapeados (editable en la app) -> Real
    formula  text,                               -- para los totales computados del ER real
    unique (anio, orden)
  );
`);
// Migracion in-place por si la tabla existia sin la columna nivel.
await client.query(`alter table ppto add column if not exists nivel smallint not null default 0`);

await client.query(`delete from ppto where anio = $1`, [anio]);
for (const f of filas) {
  await client.query(
    `insert into ppto (anio, orden, nivel, etiqueta, tipo, clase, nota, meses, total, cuentas, formula)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [anio, f.orden, f.nivel ?? 0, f.etiqueta, f.tipo, f.clase, f.nota, f.meses, f.total, f.cuentas, f.formula],
  );
}

const { rows } = await client.query(
  `select count(*)::int n, count(*) filter (where cardinality(cuentas)>0)::int mapeadas,
          count(*) filter (where formula is not null)::int formulas from ppto where anio=$1`, [anio]);
console.log(`Presupuesto ${anio} cargado:`, rows[0]);
await client.end();
