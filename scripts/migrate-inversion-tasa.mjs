// Crea la tabla `inversion_tasa`: la tasa E.A. de cada mes para las posiciones A LA
// VISTA (fiducias y bolsillos), cuya rentabilidad cambia mes a mes. Un solo campo por
// inversion nunca podia estar bien: el informe de agosto consultado en octubre
// mostraba las tasas de octubre. Los CDT no la necesitan -pactan tasa fija por todo
// el plazo- y siguen en `inversion.tasa_ea`.
//
// Siembra el ULTIMO periodo cargado con la tasa que hoy tiene cada posicion a la
// vista, porque esa es la que el analista acaba de corregir para ese cierre. Los
// meses anteriores quedan sin tasa: el informe imprime raya y avisa, que es la
// verdad. Idempotente. Uso: node scripts/migrate-inversion-tasa.mjs
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
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  create table if not exists inversion_tasa (
    inversion_id text     not null references inversion(id) on delete cascade,
    anio         smallint not null,
    mes          smallint not null,               -- 1..12
    tasa_ea      numeric(9,6) not null,           -- fraccion: 0.1267 = 12,67 % E.A.
    capturada_en timestamptz not null default now(),
    primary key (inversion_id, anio, mes)
  );
`);

const { rows: [ult] } = await client.query(`select anio, mes, etiqueta from dim_periodo order by anio desc, mes desc limit 1`);
const { rows: vista } = await client.query(`select id, entidad, tasa_ea from inversion where activa and fecha_vencimiento is null order by id`);

for (const inv of vista) {
  await client.query(
    `insert into inversion_tasa (inversion_id, anio, mes, tasa_ea) values ($1, $2, $3, $4)
     on conflict (inversion_id, anio, mes) do nothing`,
    [inv.id, ult.anio, ult.mes, inv.tasa_ea],
  );
}

const { rows: [n] } = await client.query(`select count(*)::int as n from inversion_tasa`);
console.log(`OK: tabla inversion_tasa lista. ${vista.length} posiciones a la vista sembradas para ${ult.etiqueta}; ${n.n} filas en total.`);
await client.end();
