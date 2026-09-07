import { redirect } from "next/navigation";

// La portada es el Panel Ejecutivo: la reunión de Junta empieza ahí.
export default async function HomeRedirect({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  redirect(`/panel${p ? `?p=${p}` : ""}`);
}
