/* Prueba de punta a punta del ciclo de sesión en un Chrome REAL (hidratado), que es
 * lo que el panel de verificación integrado no puede hacer. Crea un miembro de junta
 * desechable, recorre el ciclo y lo borra al final (también si algo falla):
 *
 *   entrar con clave provisional → cambio obligatorio de contraseña → navegar sin
 *   recargar → ruta de Operación escrita a mano → salir → entrar con la clave nueva
 *   → cookie sin sesión (como cuando el administrador desactiva la cuenta).
 *
 * Uso:  node scripts/prueba-sesion.mjs            (contra http://localhost:3000)
 *       BASE=http://localhost:3001 node scripts/prueba-sesion.mjs
 * Necesita DATABASE_URL en .env.local, `puppeteer-core` (devDependency) y Chrome en la
 * ruta de abajo (o CHROME=ruta\\a\\chrome.exe). Imprime una línea por comprobación y
 * termina con código 1 si alguna falla.
 *
 * Por qué existe: el 2026-09-15 un miembro de la Junta se quedaba con la pantalla en
 * blanco al guardar su contraseña nueva. Solo se reproducía con React hidratado. */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import puppeteer from "puppeteer-core";
import { neon } from "@neondatabase/serverless";

const base = process.env.BASE ?? "http://localhost:3000";
const chrome = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const m = readFileSync(".env.local", "utf8").match(/DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/);
if (!m) { console.error("Falta DATABASE_URL en .env.local"); process.exit(1); }
const sql = neon(m[1]);

const sufijo = randomBytes(4).toString("hex");
const email = `prueba.sesion.${sufijo}@example.com`;
const clave1 = `provisional-${sufijo}-2026`;
const clave2 = `definitiva-${sufijo}-2026`;

// Mismo formato que hashClave() en src/lib/auth.ts.
const hash = (clave) => {
  const sal = randomBytes(16).toString("base64url");
  return `scrypt$16384$${sal}$${scryptSync(clave.normalize("NFKC"), sal, 64, { N: 16384 }).toString("base64url")}`;
};
const [{ id }] = await sql.query(
  "insert into usuario (email, nombre, rol, clave, debe_cambiar_clave, creado_por) values ($1, 'Prueba de sesión', 'junta', $2, true, null) returning id",
  [email, hash(clave1)]);

let fallos = 0;
const ok = (nombre, cond, extra) => { if (!cond) fallos++; console.log(`${cond ? "OK   " : "FALLA"} ${nombre}${extra ? " · " + JSON.stringify(extra) : ""}`); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e).slice(0, 200)));
  page.on("console", (c) => { if (c.type() === "error") errores.push(c.text().slice(0, 200)); });

  const hidratado = async () => {
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => Object.keys(document.querySelector("form,main,aside") ?? {}).some((k) => k.startsWith("__react")))) return true;
      await espera(500);
    }
    return false;
  };
  const estado = async () => ({
    url: page.url().replace(base, ""),
    barra: await page.evaluate(() => !!document.querySelector("aside")),
    titulo: await page.evaluate(() => document.querySelector("main h1, h1")?.textContent?.trim() ?? ""),
    vacio: await page.evaluate(() => document.body.innerText.trim().length < 20),
  });
  const entrar = async (clave) => {
    await page.type("#email", email);
    await page.type("#clave", clave);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }), page.click("button[type=submit]")]);
  };

  // 1. clave provisional → cambio obligatorio, con la aplicación alrededor
  await page.goto(`${base}/entrar`, { waitUntil: "networkidle0", timeout: 60000 });
  ok("React hidratado en /entrar (si no, la prueba no vale)", await hidratado());
  await entrar(clave1);
  let e = await estado();
  ok("entrar con clave provisional → /cuenta?obligatorio=1 con barra", e.url === "/cuenta?obligatorio=1" && e.barra && !e.vacio, e);

  // 2. guardar la contraseña nueva (acción de servidor) → a su primer módulo, sin pantalla en blanco
  ok("React hidratado en /cuenta", await hidratado());
  await page.type("#actual", clave1);
  await page.type("#nueva", clave2);
  await page.type("#confirma", clave2);
  await page.click("main form button[type=submit]");
  for (let i = 0; i < 40 && page.url().includes("obligatorio=1"); i++) await espera(500);
  await espera(1500);
  e = await estado();
  ok("tras guardar la clave nueva: dentro, con barra y con contenido", !e.url.includes("obligatorio=1") && e.barra && !e.vacio, e);

  // 3. navegar por la barra sin recargar
  const enlaces = await page.$$eval("aside nav a", (as) => as.map((a) => a.getAttribute("href")));
  const actual = new URL(page.url()).pathname;
  const href = enlaces.find((h) => h && !actual.startsWith(h));
  if (href) {
    await page.click(`aside nav a[href="${href}"]`);
    for (let i = 0; i < 40 && !page.url().includes(href); i++) await espera(500);
    await espera(1500);
    e = await estado();
    ok(`navegación sin recarga a ${href} con barra`, e.url.startsWith(href) && e.barra && !e.vacio, e);
  } else ok("hay otro módulo en la barra de la Junta al que navegar", false, enlaces);

  // 4. una ruta de Operación escrita a mano rebota a un módulo de la Junta
  await page.goto(`${base}/ingesta`, { waitUntil: "networkidle0", timeout: 60000 });
  e = await estado();
  ok("/ingesta escrita a mano rebota", !e.url.startsWith("/ingesta") && e.barra, e);

  // 5. salir → pantalla de entrada, sin barra
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }), page.click('form[action="/api/sesion/salir"] button')]);
  e = await estado();
  ok("salir → /entrar sin barra", e.url === "/entrar" && !e.barra && !e.vacio, e);

  // 6. entrar con la clave nueva
  ok("React hidratado en /entrar (2)", await hidratado());
  await entrar(clave2);
  e = await estado();
  ok("entrar con la clave nueva → dentro, con barra", e.barra && !e.vacio && !e.url.startsWith("/entrar"), e);

  // 7. la cookie sigue en el navegador pero la sesión ya no existe (cuenta desactivada, etc.)
  await sql.query("delete from sesion where usuario_id = $1", [id]);
  await page.goto(`${base}/portafolio`, { waitUntil: "networkidle0", timeout: 60000 });
  e = await estado();
  ok("cookie sin sesión → vuelve a /entrar, no pinta la página", e.url.startsWith("/entrar") && !e.barra, e);

  ok("sin errores en la consola del navegador", errores.length === 0, errores.length ? errores : undefined);
} finally {
  await browser.close();
  await sql.query("delete from sesion where usuario_id = $1", [id]);
  await sql.query("delete from auditoria where usuario::text = $1 or registro_id = $1 or registro_id = $2", [id, email]);
  await sql.query("delete from usuario where id = $1", [id]);
  console.log(`usuario desechable ${email} borrado`);
}
process.exit(fallos ? 1 : 0);
