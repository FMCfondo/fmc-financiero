"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function MesesSelector({ current }: { current: number }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const href = (n: number) => {
    const params = new URLSearchParams(sp.toString());
    if (n === 4) params.delete("meses");
    else params.set("meses", String(n));
    const q = params.toString();
    return pathname + (q ? "?" + q : "");
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-faint mr-1">Meses a mostrar:</span>
      {[3, 4, 6, 12].map((n) => (
        <Link
          key={n}
          href={href(n)}
          className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
            current === n ? "bg-accentdim border-accent/40 text-accent2 font-medium" : "border-line text-muted hover:text-fg hover:bg-card2"
          }`}
        >
          {n}
        </Link>
      ))}
    </div>
  );
}
