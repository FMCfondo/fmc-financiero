// Crea la tabla `inversion` y la puebla con el portafolio actual (11 posiciones),
// extraído de la hoja PORTAFOLIO del Excel y verificado contra los auxiliares en Neon.
// Idempotente: usa ON CONFLICT DO UPDATE. Uso: node scripts/migrate-inversiones.mjs
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
  create table if not exists inversion (
    id                text primary key,          -- INV-001
    tipo              text not null,             -- CDT | Fiducia | Bolsillo
    entidad           text not null,
    cuentas           text[] not null,           -- auxiliares PUC (capital + intereses)
    tasa_ea           numeric(9,6) not null default 0,
    fecha_apertura    date,
    fecha_vencimiento date,                      -- null = a la vista (sin vencimiento)
    calificacion      text,
    renovar           text,
    observaciones     text,
    activa            boolean not null default true
  );
`);

// Portafolio actual (hoja PORTAFOLIO, corte MAY2026). El MONTO no se guarda:
// se calcula siempre desde los auxiliares al mes seleccionado.
const SEED = [
  ["INV-001", "CDT", "Banco de Bogotá", ["1225050301", "1225050401"], 0.094, "2026-03-25", "2026-09-21", null, "S/N", null],
  ["INV-002", "CDT", "Banco de Bogotá", ["1225050302", "1225050402"], 0.110, "2026-05-25", "2026-11-21", null, "S/N", null],
  ["INV-003", "CDT", "Banco de Bogotá", ["1225050303", "1225050403"], 0.094, "2026-04-27", "2026-10-24", null, "S/N", null],
  ["INV-004", "CDT", "Coopcentral", ["12250507", "12250508"], 0.091, "2026-05-25", "2026-11-21", null, "S/N", null],
  ["INV-005", "CDT", "Bancamía", ["1225050901", "1225051001"], 0.118, "2026-05-11", "2026-11-07", null, "Sí", null],
  ["INV-006", "CDT", "Bancamía", ["1225050902", "1225051002"], 0.095, "2025-12-13", "2026-06-11", null, "Sí", null],
  ["INV-007", "CDT", "Confiar", ["12250511", "12250512"], 0.096, "2026-04-30", "2026-10-27", null, "Sí", null],
  ["INV-008", "Bolsillo", "Bold", ["1110050104"], 0.090, null, null, null, null, "Bolsillo de ahorro (cuenta 11, no cuenta 12)"],
  ["INV-009", "Fiducia", "Fiduciaria Bancolombia", ["12450501", "12450502"], 0.10454, null, null, null, null, "Sin pacto de permanencia"],
  ["INV-010", "Fiducia", "Skandia", ["12450503"], 0.11198, null, null, null, null, "Sin pacto de permanencia"],
  ["INV-011", "Fiducia", "Fiduciaria Bogotá", ["12450504"], 0.1077, null, null, null, null, "Sin pacto de permanencia"],
];

for (const [id, tipo, entidad, cuentas, tasa, ap, ve, cal, ren, obs] of SEED) {
  await client.query(
    `insert into inversion (id, tipo, entidad, cuentas, tasa_ea, fecha_apertura, fecha_vencimiento, calificacion, renovar, observaciones)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (id) do update set tipo=excluded.tipo, entidad=excluded.entidad, cuentas=excluded.cuentas,
       tasa_ea=excluded.tasa_ea, fecha_apertura=excluded.fecha_apertura, fecha_vencimiento=excluded.fecha_vencimiento,
       calificacion=excluded.calificacion, renovar=excluded.renovar, observaciones=excluded.observaciones`,
    [id, tipo, entidad, cuentas, tasa, ap, ve, cal, ren, obs],
  );
}

// Parámetros de referencia del portafolio (editables luego desde la app).
for (const [clave, valor, desc] of [
  ["bench_cdt180", 0, "Tasa de referencia CDT 180 días (Banco de la República), manual"],
  ["ipc_12m", 0, "Inflación 12 meses (IPC), manual"],
]) {
  await client.query(
    `insert into parametro (clave, valor, descripcion) values ($1, $2::jsonb, $3) on conflict (clave) do nothing`,
    [clave, JSON.stringify(valor), desc],
  );
}

const { rows } = await client.query(`select count(*) n from inversion`);
console.log(`OK: ${rows[0].n} inversiones en la tabla.`);
await client.end();
