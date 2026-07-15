"use client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, LabelList,
} from "recharts";
import { fmtCompact, fmtNum, fmtPct } from "@/lib/format";

/* Paleta financiera clásica (elegida por el analista, 2026-07):
   el color SIEMPRE significa algo — nada decorativo.
     · azul rey profundo = el dato actual / principal
     · gris medio        = comparativos y secundarios
     · verde / rojo      = RESERVADOS para variaciones buenas / malas
     · dorado            = único acento (el segundo motor: inversiones)
   Texto de ejes y etiquetas: oscuro (#334155) y 12px — legible sin esfuerzo. */
export const C = {
  principal: "#13286E",
  secundario: "#3B5BD9",
  comparativo: "#8A94A6",
  bueno: "#1B7A3D",
  malo: "#B3261E",
  acento: "#C99A2E",
} as const;
export const PALETTE = ["#13286E", "#3B5BD9", "#C99A2E", "#7C93E8", "#8A94A6", "#5E718D", "#B58A2A", "#94A3B8"];

const AX = "#334155";
const GRID = "#dbe3f0";
const TICK = { fontSize: 12, fill: AX } as const;
const ETIQ = { fontSize: 11, fill: AX } as const;
const lblC = (v: unknown) => fmtCompact(Number(v ?? 0));
const lblPct = (v: unknown) => `${v ?? 0}%`;
const lblCM = (v: unknown) => fmtCompact(Number(v ?? 0) * 1e6);

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
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 22, right: 16, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="gIng" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.principal} stopOpacity={0.22} />
            <stop offset="100%" stopColor={C.principal} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gGas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.acento} stopOpacity={0.22} />
            <stop offset="100%" stopColor={C.acento} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="mes" stroke={AX} tick={TICK} tickLine={false} axisLine={false} />
        <YAxis stroke={AX} tick={TICK} tickFormatter={fmtCompact} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={<TT />} />
        <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={C.principal} strokeWidth={2.5} fill="url(#gIng)"
          label={{ position: "top", ...ETIQ, fill: C.principal, formatter: lblC }} />
        <Area type="monotone" dataKey="gastos" name="Gastos" stroke={C.acento} strokeWidth={2.5} fill="url(#gGas)"
          label={{ position: "bottom", ...ETIQ, fill: "#8A6A1D", formatter: lblC }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ResultBars({ data }: { data: { mes: string; resultado: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="mes" stroke={AX} tick={TICK} tickLine={false} axisLine={false} />
        <YAxis stroke={AX} tick={TICK} tickFormatter={fmtCompact} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={<TT />} cursor={{ fill: "#13286E0d" }} />
        <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="resultado" position="top" {...ETIQ} formatter={lblC} />
          {data.map((d, i) => (
            <Cell key={i} fill={d.resultado >= 0 ? C.bueno : C.malo} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(170, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 74, left: 4, bottom: 4 }}>
        <XAxis type="number" stroke={AX} tick={TICK} tickFormatter={fmtCompact} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" stroke={AX} tick={TICK} width={170} tickLine={false} axisLine={false} />
        <Tooltip content={<TT />} cursor={{ fill: "#13286E0d" }} />
        <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]} fill={C.principal} barSize={18}>
          <LabelList dataKey="value" position="right" {...ETIQ} formatter={lblC} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Sparkline: contexto histórico junto a la cifra. Sin ejes ni etiquetas — no se
 *  leen valores, se lee la forma. */
export function Sparkline({ data, color = C.principal, height = 30 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / span) * 100}`).join(" ");
  const last = data[data.length - 1];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: "100%" }} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={3} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={100} cy={100 - ((last - min) / span) * 100} r={2.5} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Los dos motores de utilidad, mes a mes. Azul rey = cobertura, dorado = inversiones. */
export function ContribBars({ data }: { data: { mes: string; cobertura: number; inversiones: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="mes" stroke={AX} tick={TICK} tickLine={false} axisLine={false} />
        <YAxis stroke={AX} tick={TICK} tickFormatter={fmtCompact} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={<TT />} cursor={{ fill: "#13286E0d" }} />
        <Bar dataKey="cobertura" name="Cobertura de créditos" stackId="c" fill={C.principal} />
        <Bar dataKey="inversiones" name="Inversiones" stackId="c" fill={C.acento} radius={[3, 3, 0, 0]}>
          <LabelList {...ETIQ} position="top"
            valueAccessor={(e: any) => (e?.payload ? e.payload.cobertura + e.payload.inversiones : null)}
            formatter={lblC} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TTPct({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-0.5 font-medium text-fg">{label}</div>
      <div className="tnum text-fg">{fmtPct(p.value / 100)}</div>
      {p.payload?.valor !== undefined && <div className="tnum text-muted">{fmtNum(p.payload.valor)}</div>}
    </div>
  );
}

/** Análisis vertical: participación de cada línea sobre la base, en %. */
export function PctBars({ data }: { data: { name: string; pct: number; valor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
        <XAxis type="number" stroke={AX} tick={TICK} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" stroke={AX} tick={TICK} width={175} tickLine={false} axisLine={false} />
        <Tooltip content={<TTPct />} cursor={{ fill: "#13286E0d" }} />
        <Bar dataKey="pct" name="Participación" radius={[0, 4, 4, 0]} barSize={16}>
          <LabelList dataKey="pct" position="right" {...ETIQ} formatter={lblPct} />
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Análisis horizontal: variación % vs. año anterior (divergente, verde/rojo). */
export function VarBars({ data }: { data: { name: string; varPct: number; valor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 12, bottom: 4 }}>
        <XAxis type="number" stroke={AX} tick={TICK} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" stroke={AX} tick={TICK} width={175} tickLine={false} axisLine={false} />
        <Tooltip content={<TTPct />} cursor={{ fill: "#13286E0d" }} />
        <Bar dataKey="varPct" name="Variación" radius={[0, 4, 4, 0]} barSize={16}>
          <LabelList dataKey="varPct" {...ETIQ} formatter={lblPct}
            position="right" />
          {data.map((d, i) => <Cell key={i} fill={d.varPct >= 0 ? C.bueno : C.malo} />)}
        </Bar>
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
  const color = (x: { tipo: string; signo: number }) =>
    x.tipo === "total" ? (x.signo >= 0 ? C.principal : C.malo) : x.tipo === "inc" ? C.bueno : C.malo;
  return (
    <ResponsiveContainer width="100%" height={330}>
      <BarChart data={d} margin={{ top: 24, right: 8, left: 4, bottom: 26 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" stroke={AX} tick={{ fontSize: 11.5, fill: AX }} interval={0} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={54} />
        <YAxis stroke={AX} tick={TICK} tickFormatter={(v) => fmtCompact(v * 1e6)} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={<WaterfallTT />} cursor={{ fill: "#13286E10" }} />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]}>
          <LabelList {...ETIQ} position="top"
            valueAccessor={(e: any) => (e?.payload ? e.payload.signo * e.payload.value : null)}
            formatter={lblCM} />
          {d.map((x, i) => (
            <Cell key={i} fill={color(x)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DualLine({ data }: { data: { mes: string; activo: number; pasivo: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 22, right: 16, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.principal} stopOpacity={0.2} /><stop offset="100%" stopColor={C.principal} stopOpacity={0} /></linearGradient>
          <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.acento} stopOpacity={0.2} /><stop offset="100%" stopColor={C.acento} stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="mes" stroke={AX} tick={TICK} tickLine={false} axisLine={false} />
        <YAxis stroke={AX} tick={TICK} tickFormatter={fmtCompact} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={<TT />} />
        <Area type="monotone" dataKey="activo" name="Activo" stroke={C.principal} strokeWidth={2.5} fill="url(#gA)"
          label={{ position: "top", ...ETIQ, fill: C.principal, formatter: lblC }} />
        <Area type="monotone" dataKey="pasivo" name="Pasivo" stroke={C.acento} strokeWidth={2.5} fill="url(#gP)"
          label={{ position: "bottom", ...ETIQ, fill: "#8A6A1D", formatter: lblC }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Composición como donut eliminada (Few/Power BI: parte-todo = barras). Se
 *  mantiene el nombre exportado por compatibilidad, renderizando barras. */
export function DonutComposition({ data }: { data: { name: string; value: number }[] }) {
  return <HBars data={data} />;
}
