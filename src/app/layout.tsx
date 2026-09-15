import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PeriodSelector from "@/components/PeriodSelector";
import MenuUsuario from "@/components/MenuUsuario";
import { ensureLoaded, periodos } from "@/lib/data";
import { obtenerSesion } from "@/lib/auth";
import { modulosDe, entradaDe } from "@/lib/permisos";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FMC Financiero",
  description: "Plataforma financiera · Fondo Mutuo de Cobertura FMC S.A.S.",
};

/* EL LAYOUT RAÍZ NO REDIRIGE NUNCA. Quién puede estar dónde lo decide cada página con
   `accesoA` / `soloAdmin` (src/lib/permisos.ts). Dos razones, las dos aprendidas:
   · un layout compartido no se vuelve a ejecutar cuando el navegador cambia de ruta
     sin recargar, así que una comprobación aquí solo valdría en las cargas completas;
   · una redirección lanzada desde el layout raíz mientras se sirve la redirección de
     una acción de servidor deja la pantalla EN BLANCO (2026-09-15: un miembro de la
     Junta guardaba su contraseña nueva, la acción mandaba a /panel, el Panel estaba
     deshabilitado para la Junta, el layout volvía a redirigir… y no se pintaba nada
     hasta recargar). Las páginas sí pueden redirigir: el router las envuelve en un
     límite que lo resuelve sin perder la aplicación.
   Aquí solo se decide QUÉ se pinta alrededor: sin sesión, nada; con sesión, la barra
   y la cabecera. */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sesion = await obtenerSesion();

  /* Sin sesión válida no hay aplicación: ni barra ni cabecera. La página que venga
     dentro manda a /entrar por su cuenta (todas lo hacen), y /entrar es la única que
     se pinta así a propósito. Que la cookie exista no basta (el proxy solo mira eso):
     si la sesión caducó o el administrador desactivó la cuenta, aquí ya no hay
     sesión. No se carga el dataset: la pantalla de entrada no lo necesita. */
  if (!sesion) {
    return (
      <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
        <body className="min-h-full">{children}</body>
      </html>
    );
  }

  /* El dataset es también quien refresca los parámetros desde la base, y de ellos
     salen los módulos que ve la Junta: por eso va antes de calcular el menú. */
  await ensureLoaded();
  const modulos = modulosDe(sesion.usuario).map((href) => ({ href, destino: entradaDe(sesion.usuario, href) }));

  // El selector de períodos se alimenta de la BASE, no de una lista fija:
  // al ingestar un mes nuevo aparece de inmediato.
  const etiquetas = periodos.map((q) => q.etiqueta);
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={<div className="fixed left-0 top-0 z-40 h-screen w-[248px] brand-grad" />}>
          <Sidebar rol={sesion.usuario.rol} modulos={modulos} />
        </Suspense>
        <div className="pl-[248px] min-h-screen flex flex-col">
          <header className="h-16 shrink-0 border-b border-line bg-panel/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="hidden sm:inline text-faint">Entidad</span>
              <span className="font-medium text-fg">FMC S.A.S.</span>
            </div>
            <div className="flex items-center gap-5">
              <Suspense fallback={null}>
                <PeriodSelector periodos={etiquetas} />
              </Suspense>
              <MenuUsuario nombre={sesion.usuario.nombre} rol={sesion.usuario.rol} />
            </div>
          </header>
          <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
