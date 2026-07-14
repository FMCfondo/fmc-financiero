// Diagnóstico: calcula los indicadores propuestos con datos reales para evaluar
// cuáles son significativos y cuáles dependen de una clasificación inexistente.
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

const ETQ = "MAY2026";
const { rows } = await client.query(
  `select c.codigo_puc, abs(coalesce(s.saldo_acumulado,0))::float8 v
     from dim_cuenta c
     join dim_periodo p on p.etiqueta = $1
     left join fact_saldo s on s.cuenta_id = c.cuenta_id and s.periodo_id = p.periodo_id`,
  [ETQ],
);
const M = new Map(rows.map((r) => [r.codigo_puc, r.v]));
const g = (c) => M.get(c) ?? 0;

const activo = g("1"), pasivo = g("2"), patrim = g("3");
const efectivo = g("11"), inversiones = g("12"), deudores = g("13");
const garantias = g("2640");
const ing = g("4"), gas = g("5");
const ingOrd = g("41"), ingFin = g("4150"), ingCob = g("4180");
const gAdmin = g("51"), otrosGas = g("5199"), costoCob = g("5199150101");
const p = (x) => (x * 100).toFixed(1) + "%";
const n = (x) => x.toLocaleString("es-CO", { maximumFractionDigits: 0 });

console.log(`\n########## FMC · ${ETQ} ##########`);
console.log(`Activo ${n(activo)} | Pasivo ${n(pasivo)} | Patrimonio ${n(patrim)}`);

console.log(`\n===== 1. LO QUE MIDE EL NEGOCIO REAL (no está en el spec) =====`);
const respaldo = inversiones + efectivo;
console.log(`  Inversiones + Efectivo (respaldo) : ${n(respaldo)}`);
console.log(`  Obligaciones de Garantías (2640)  : ${n(garantias)}`);
console.log(`  >> RAZÓN DE COBERTURA             : ${p(respaldo / garantias)}   <-- el número clave`);
console.log(`  >> Excedente de respaldo          : ${n(respaldo - garantias)}`);

console.log(`\n===== 2. LOS INDICADORES DEL SPEC QUE ENGAÑAN =====`);
console.log(`  Endeudamiento total (P/A)         : ${p(pasivo / activo)}  <-- parece quiebra`);
console.log(`  Autonomía (K/A)                   : ${p(patrim / activo)}  <-- parece quiebra`);
console.log(`  Pasivo / Patrimonio               : ${(pasivo / patrim).toFixed(2)}x <-- 18x, "insolvente"`);
console.log(`  ... pero el 97,1% del pasivo es la provisión de garantías (2640),`);
console.log(`      que es el negocio del fondo, NO deuda financiera.`);
const deudaReal = pasivo - garantias;
console.log(`  Pasivo SIN la provisión           : ${n(deudaReal)}`);
console.log(`  >> Endeudamiento real (sin 2640)  : ${p(deudaReal / activo)}  <-- la verdad`);

console.log(`\n===== 3. RAZÓN CORRIENTE: DEPENDE DE UNA CLASIFICACIÓN QUE NO EXISTE =====`);
const escenarios = [
  ["A) 2640 es NO corriente; inversiones NO corrientes", efectivo + deudores, pasivo - garantias],
  ["B) 2640 es corriente; inversiones NO corrientes", efectivo + deudores, pasivo],
  ["C) 2640 es corriente; inversiones SÍ corrientes", efectivo + inversiones + deudores, pasivo],
];
for (const [label, ac, pc] of escenarios) {
  console.log(`  ${label.padEnd(52)} => ${(ac / pc).toFixed(2)}`);
}
console.log(`  >> El resultado va de 0,10 a 4,18 segun como se clasifique. NO se puede adivinar.`);

console.log(`\n===== 4. ESTADO DE RESULTADOS =====`);
console.log(`  Ingresos cobertura (4180)         : ${n(ingCob)}`);
console.log(`  Costo cobertura (5199150101)      : ${n(costoCob)}`);
console.log(`  >> Resultado bruto de cobertura   : ${n(ingCob - costoCob)}  (margen ${p((ingCob - costoCob) / ingCob)})`);
console.log(`  Ingresos financieros (4150)       : ${n(ingFin)}`);
console.log(`  Gastos admin (51)                 : ${n(gAdmin)}`);
console.log(`     de los cuales 5199 "Otros"     : ${n(otrosGas)}  = ${p(otrosGas / gAdmin)} del total`);
console.log(`     admin REALES (51 - costo cob.) : ${n(gAdmin - costoCob)}`);
console.log(`  >> Margen operacional (41-51-52)/41: ${p((ingOrd - gAdmin - g("52")) / ingOrd)}`);
console.log(`  >> Margen neto                    : ${p((ing - gas) / ing)}`);
console.log(`  >> ROE                            : ${p((ing - gas) / patrim)}`);
console.log(`  >> ROA                            : ${p((ing - gas) / activo)}`);

console.log(`\n===== 5. POR QUÉ EL TREEMAP DE GASTOS FALLARÍA =====`);
console.log(`  Un treemap de gastos por categoría (clase 5, crudo) mostraría:`);
console.log(`     "Otros gastos" (5199) = ${p(otrosGas / gas)} del total  <-- una caja gigante llamada "Otros"`);
console.log(`  Reclasificando el costo de cobertura fuera de admin, el resto SÍ tiene historia.`);

await client.end();
