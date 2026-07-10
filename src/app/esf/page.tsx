import { redirect } from "next/navigation";

export default async function ESFRedirect({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  redirect(`/estados/situacion${p ? `?p=${p}` : ""}`);
}
