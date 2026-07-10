import { redirect } from "next/navigation";

export default async function ERRedirect({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  redirect(`/estados/resultados${p ? `?p=${p}` : ""}`);
}
