import { redirect } from "next/navigation";

export default async function HomeRedirect({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  redirect(`/estados/dashboard${p ? `?p=${p}` : ""}`);
}
