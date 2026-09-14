// Crea las tablas de identidad: `usuario` (quien puede entrar y con que rol) y
// `sesion` (las sesiones vivas, revocables al instante). Sustituyen a `perfil`, que
// se creo pensando en un proveedor externo de identidad y nunca se uso.
//
// La contrasena se guarda como scrypt (Node) con sal propia; la sesion se guarda
// como el SHA-256 del identificador que viaja en la cookie: una fuga de la base no
// entrega sesiones vivas. Idempotente. Uso: node scripts/migrate-usuarios.mjs
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
  create table if not exists usuario (
    id                 uuid primary key default gen_random_uuid(),
    email              text not null,
    nombre             text not null,
    rol                text not null check (rol in ('admin', 'junta')),
    clave              text not null,                 -- scrypt$N$sal$hash
    activo             boolean not null default true,
    debe_cambiar_clave boolean not null default false,
    intentos_fallidos  smallint not null default 0,
    bloqueado_hasta    timestamptz,
    ultimo_acceso      timestamptz,
    creado_en          timestamptz not null default now(),
    creado_por         uuid references usuario(id)
  );
  create unique index if not exists usuario_email_unico on usuario (lower(email));

  create table if not exists sesion (
    hash        text primary key,                     -- sha256 del token de la cookie
    usuario_id  uuid not null references usuario(id) on delete cascade,
    creada_en   timestamptz not null default now(),
    expira_en   timestamptz not null,
    agente      text
  );
  create index if not exists sesion_usuario on sesion (usuario_id);
`);

const { rows: [u] } = await client.query(`select count(*)::int n from usuario`);
console.log(`OK: tablas usuario y sesion listas. Usuarios existentes: ${u.n}${u.n === 0 ? " (el primero se crea desde /entrar)" : ""}.`);
await client.end();
