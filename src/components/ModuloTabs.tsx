"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, FileSpreadsheet } from "lucide-react";

const TABS = [
  { id: "dashboard", href: "/estados/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "fin", href: "/estados/resultados", label: "Estados Financieros", icon: FileSpreadsheet },
];

export default function ModuloTabs() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.get("p") ? `?p=${sp.get("p")}` : "";
  const current = pathname.startsWith("/estados/dashboard") ? "dashboard" : "fin";

  return (
    <div className="flex gap-6 border-b border-line">
      {TABS.map(({ id, href, label, icon: Icon }) => {
        const active = current === id;
        return (
          <Link
            key={id}
            href={`${href}${qs}`}
            className={`relative flex items-center gap-2 pb-3 -mb-px text-[15px] transition-colors ${
              active
                ? "text-royal font-semibold border-b-2 border-royal"
                : "text-muted hover:text-fg border-b-2 border-transparent"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
