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
    <div className="flex items-center">
      <span className="seg-label">Meses</span>
      <div className="seg">
        {[3, 4, 6, 12].map((n) => (
          <Link key={n} href={href(n)} className={current === n ? "on" : ""}>{n}</Link>
        ))}
      </div>
    </div>
  );
}
