"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIODOS, PERIODO_DEFAULT, etqNombre } from "@/lib/periodos";
import { ChevronDown, Calendar } from "lucide-react";

export default function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("p") || PERIODO_DEFAULT;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp.toString());
    params.set("p", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative flex items-center">
      <Calendar size={15} className="absolute left-3 text-faint pointer-events-none" />
      <select
        value={current}
        onChange={onChange}
        className="appearance-none bg-card2 border border-line rounded-lg pl-9 pr-9 py-2 text-sm text-fg outline-none focus:border-accent cursor-pointer min-w-[150px]"
      >
        {[...PERIODOS].reverse().map((p) => (
          <option key={p} value={p} className="bg-panel">{etqNombre(p)}</option>
        ))}
      </select>
      <ChevronDown size={15} className="absolute right-3 text-faint pointer-events-none" />
    </div>
  );
}
