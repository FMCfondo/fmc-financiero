import { NextResponse, type NextRequest } from "next/server";

/* Entrar y salir NO son acciones de servidor sino peticiones HTTP clásicas con una
   redirección 303 de verdad. Motivo: al entrar o salir cambia TODO el layout raíz
   (de la pantalla de entrada a la aplicación con su barra, o al revés), y el router
   del navegador no vuelve a ejecutar un layout compartido cuando cambia de ruta sin
   recargar. Con una redirección HTTP el navegador carga la página de destino entera,
   con o sin JavaScript, igual en desarrollo que en Vercel. */

export const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Solo rutas internas: nada de mandar a alguien a otro dominio tras entrar. */
export const esInterna = (v: string) => v.startsWith("/") && !v.startsWith("//");

/** 303: el navegador sigue con un GET a la página de destino. */
export function irA(req: NextRequest, ruta: string): NextResponse {
  return NextResponse.redirect(new URL(ruta, req.url), 303);
}

/** El formulario debe venir de esta misma aplicación (lo que las acciones de servidor
 *  comprueban solas). Si el navegador manda Origin y no coincide con el host, se
 *  rechaza. */
export function otroOrigen(req: NextRequest): NextResponse | null {
  const origen = req.headers.get("origin");
  if (!origen) return null;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let hostOrigen = "";
  try { hostOrigen = new URL(origen).host; } catch { /* Origin: null u otro valor raro */ }
  return hostOrigen && hostOrigen === host ? null : NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
}
