import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/auth-cookie";

/* Guardia de la puerta, no de la verdad. Aquí solo se comprueba que la petición
   traiga la cookie de sesión; si no la trae, a /entrar (o 401 si es la API). La
   validez real de la sesión —que exista, que no haya caducado, que el usuario siga
   activo— la decide `obtenerSesion()` contra la base, en el layout y en cada acción.
   El proxy no toca la base a propósito: corre en cada petición y debe ser barato.

   También deja la ruta pedida en una cabecera, que es la única forma que tiene un
   layout de servidor de saber dónde está (para obligar el cambio de contraseña sin
   encerrar al usuario en un bucle). */

const PUBLICAS = ["/entrar"];

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const tieneCookie = !!req.cookies.get(COOKIE_SESION)?.value;
  const esPublica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!tieneCookie && !esPublica) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
    const destino = req.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    // Volver a donde iba, salvo a la raíz (que ya redirige sola).
    if (pathname !== "/") destino.searchParams.set("volver", pathname + search);
    return NextResponse.redirect(destino);
  }

  const cabeceras = new Headers(req.headers);
  cabeceras.set("x-fmc-ruta", pathname);
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  // Todo menos los archivos estáticos de Next y los recursos con extensión.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|woff2?)$).*)"],
};
