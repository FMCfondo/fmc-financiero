import type { LucideIcon } from "lucide-react";

type Tone = "pos" | "neg" | "neutral" | "accent";

export default function StatCard({
  label, value, sub, tone = "neutral", icon: Icon, hint,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon?: LucideIcon;
  hint?: string;
}) {
  const valueTone =
    tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "accent" ? "text-accent2" : "text-fg";
  const iconWrap =
    tone === "pos" ? "bg-emerald-500/10 text-pos"
    : tone === "neg" ? "bg-rose-500/10 text-neg"
    : tone === "accent" ? "bg-accent/10 text-accent2"
    : "bg-white/5 text-muted";

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        {Icon && (
          <span className={`h-8 w-8 grid place-items-center rounded-lg ${iconWrap}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <div className={`text-2xl font-semibold tnum tracking-tight ${valueTone}`}>{value}</div>
      {sub && <div className="text-xs text-faint">{sub}</div>}
      {hint && <div className="text-[11px] text-faint">{hint}</div>}
    </div>
  );
}
