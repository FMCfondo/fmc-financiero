"use client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";
import { fmtCompact, fmtNum } from "@/lib/format";

const AX = "#64748b";
const GRID = "#e6ecf5";
export const PALETTE = ["#45b6e8", "#1e40af", "#e0b94a", "#86cef0", "#5b6ee1", "#3ddc97", "#c9a227", "#94a3b8"];

function TT({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label && <div className="mb-1 font-medium text-fg">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}:</span>
          <span className="tnum text-fg">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data }: { data: { mes: string; ingresos: number; gastos: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="gIng" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#45b6e8" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#45b6e8" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gGas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e0b94a" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#e0b94a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="mes" stroke={AX} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis stroke={AX} tick={{ fontSize: 11 }} tickFormatter={fmtCompact} tickLine={false} axisLine={false} width={52} />
        <Tooltip content={<TT />} />
        <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#45b6e8" strokeWidth={2} fill="url(#gIng)" />
        <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#e0b94a" strokeWidth={2} fill="url(#gGas)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ResultBars({ data }: { data: { mes: string; resultado: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="mes" stroke={AX} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis stroke={AX} tick={{ fontSize: 11 }} tickFormatter={fmtCompact} tickLine={false} axisLine={false} width={52} />
        <Tooltip content={<TT />} cursor={{ fill: "#ffffff08" }} />
        <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.resultado >= 0 ? "#34d399" : "#fb7185"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutComposition({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<TT />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
        <XAxis type="number" stroke={AX} tick={{ fontSize: 11 }} tickFormatter={fmtCompact} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" stroke={AX} tick={{ fontSize: 11 }} width={150} tickLine={false} axisLine={false} />
        <Tooltip content={<TT />} cursor={{ fill: "#ffffff08" }} />
        <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]} fill="#45b6e8" barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function WaterfallTT({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const v = payload.find((p: any) => p.dataKey === "value");
  return (
    <div className="rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-0.5 font-medium text-fg">{label}</div>
      <div className="tnum text-fg">{fmtNum((v?.value ?? 0) * 1e6)}</div>
    </div>
  );
}

export function WaterfallChart({ data }: { data: { name: string; base: number; value: number; tipo: string; signo: number }[] }) {
  const d = data.map((x) => ({ ...x, base: x.base / 1e6, value: x.value / 1e6 }));
  // Ingresos en verde, costos/gastos en rojo, subtotales en azul rey (o rojo si negativo)
  const color = (x: { tipo: string; signo: number }) =>
    x.tipo === "total" ? (x.signo >= 0 ? "#1e40af" : "#dc2626") : x.tipo === "inc" ? "#16a34a" : "#dc2626";
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={d} margin={{ top: 8, right: 8, left: 4, bottom: 24 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" stroke={AX} tick={{ fontSize: 10 }} interval={0} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={50} />
        <YAxis stroke={AX} tick={{ fontSize: 11 }} tickFormatter={(v) => fmtCompact(v * 1e6)} tickLine={false} axisLine={false} width={52} />
        <Tooltip content={<WaterfallTT />} cursor={{ fill: "#1e40af10" }} />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]}>
          {d.map((x, i) => (
            <Cell key={i} fill={color(x)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
