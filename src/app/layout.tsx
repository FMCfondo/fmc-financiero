import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PeriodSelector from "@/components/PeriodSelector";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FMC Financiero",
  description: "Plataforma financiera · Fondo Mutuo de Cobertura FMC S.A.S.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Suspense fallback={<div className="w-[248px] shrink-0 border-r border-line hidden md:block" />}>
            <Sidebar />
          </Suspense>
          <div className="flex-1 min-w-0 flex flex-col">
            <header className="h-16 shrink-0 border-b border-line bg-panel/70 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6">
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="hidden sm:inline text-faint">Entidad</span>
                <span className="font-medium text-fg">FMC S.A.S.</span>
              </div>
              <Suspense fallback={null}>
                <PeriodSelector />
              </Suspense>
            </header>
            <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
