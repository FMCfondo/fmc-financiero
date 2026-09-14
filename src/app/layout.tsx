import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PeriodSelector from "@/components/PeriodSelector";
import MenuUsuario from "@/components/MenuUsuario";
import { ensureLoaded, periodos } from "@/lib/data";
import { obtenerSesion } from "@/lib/auth";
import { modulosDe, rutaPermitida, destinoInicial } from "@/lib/permisos";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FMC Financiero",
  description: "Plataforma financiera · Fondo Mutuo de Cobertura FMC S.A.S.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sesion = await obtenerSesion();

  /* Sin sesión no hay aplicación: solo /entrar, sin barra ni cabecera. Cualquier otra
     ruta ya la devolvió el proxy a /entrar antes de llegar aquí. No se carga el
     dataset: la pantalla de entrada no depende de la base más que para el login. */
  if (!sesion) {
    return (
      <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
        <body className="min-h-full">{children}</body>
      </html>
    );
  }

  /* Una contraseña asignada por el administrador se cambia ANTES de ver nada. La ruta
     viene en la cabecera que deja el proxy: un layout no tiene otra forma de saber
     dónde está, y sin saberlo redirigir crearía un bucle en /cuenta. */
  const ruta = (await headers()).get("x-fmc-ruta") ?? "/";
  if (sesion.usuario.debeCambiarClave && !ruta.startsWith("/cuenta")) redirect("/cuenta?obligatorio=1");

  /* Primero el dataset —que es también quien refresca los parámetros desde la base— y
     DESPUÉS los permisos: si se evaluaran antes, un cambio en los módulos de la Junta
     tardaría una petición en aplicarse en cada instancia (pasó en la prueba: el primer
     aterrizaje tras el login aún veía los cuatro módulos). */
  await ensureLoaded();

  /* Lo que ve cada rol se decide AQUÍ, en cada petición, no solo en el menú: un
     miembro de la Junta que escriba /ingesta a mano vuelve a su primer módulo. */
  if (!rutaPermitida(sesion.usuario, ruta)) redirect(destinoInicial(sesion.usuario));
  const modulos = modulosDe(sesion.usuario);

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
