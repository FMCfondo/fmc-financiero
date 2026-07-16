import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PeriodSelector from "@/components/PeriodSelector";
import { ensureLoaded, periodos } from "@/lib/data";

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
  // El selector de períodos se alimenta de la BASE, no de una lista fija:
  // al ingestar un mes nuevo aparece de inmediato.
  await ensureLoaded();
  const etiquetas = periodos.map((q) => q.etiqueta);
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={<div className="fixed left-0 top-0 z-40 h-screen w-16 brand-grad" />}>
          <Sidebar />
        </Suspense>
        <div className="pl-16 min-h-screen flex flex-col">
          <header className="h-16 shrink-0 border-b border-line bg-panel/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="hidden sm:inline text-faint">Entidad</span>
              <span className="font-medium text-fg">FMC S.A.S.</span>
            </div>
            <Suspense fallback={null}>
              <PeriodSelector periodos={etiquetas} />
            </Suspense>
          </header>
          <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
