"use client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Cell, LabelList,
} from "recharts";
import { fmtCompact } from "@/lib/format";

/* Paleta financiera clásica: el color SIEMPRE significa algo.
     · azul rey profundo = el dato actual / principal
     · gris medio        = comparativos
     · verde / rojo      = RESERVADOS para bueno / malo
     · dorado            = único acento (inversiones)
   Reglas de esta revisión (pedidas por el analista):
     · etiquetas SIEMPRE visibles, 12px, seminegrita, con halo blanco (legibles
       aunque caigan sobre una línea u otra barra)
     · leyenda visible en todo gráfico con más de una serie
     · SIN tooltips (la etiqueta ya está visible), SIN eje Y ni líneas de ejes
       (el valor va en la etiqueta); se conserva el eje X (los meses)
     · barras más gruesas                                                     */
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
const GRID = "#e3e9f4";
const TICK = { fontSize: 12, fill: AX, fontWeight: 500 } as const;
/* Halo blanco: el texto se pinta con borde blanco por debajo del relleno
   (paintOrder: stroke), así la etiqueta se lee sobre cualquier fondo. */
const HALO = { paintOrder: "stroke" as const, stroke: "#ffffff", strokeWidth: 3.5 };
const ETIQ = { fontSize: 12, fontWeight: 600, fill: AX, style: HALO } as const;
const ETIQ_LG = { fontSize: 13, fontWeight: 700, fill: AX, style: HALO } as const;
const lblC = (v: unknown) => fmtCompact(Number(v ?? 0));
const lblPct = (v: unknown) => `${v ?? 0}%`;
const lblCM = (v: unknown) => fmtCompact(Number(v ?? 0) * 1e6);

/** Leyenda visible: punto de color + concepto, texto oscuro. */
export function Leyenda({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-5 flex-wrap mb-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-2 text-[13px] font-medium text-fg">
          <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export type ModoEtiquetas = "todas" | "picos" | "ocultas";

/** Picos y valles notables de una serie (extremos locales + primero y último). */
function extremos(vals: number[]): Set<number> {
  const out = new Set<number>();
  for (let i = 1; i < vals.length - 1; i++) {
    const a = vals[i - 1], v = vals[i], b = vals[i + 1];
    if ((v >= a && v >= b && (v > a || v > b)) || (v <= a && v <= b && (v < a || v < b))) out.add(i);
  }
  if (vals.length) { out.add(0); out.add(vals.length - 1); }
  return out;
}

const lblSerie = (fill: string, dy: number, mostrar: (i: number) => boolean) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function EtiquetaSerie(p: any) {
    if (p?.index === undefined || !mostrar(p.index) || p?.value === undefined) return null;
    return (
      <text x={Number(p.x ?? 0)} y={Number(p.y ?? 0) + dy} textAnchor="middle" fontSize={12} fontWeight={600} fill={fill} style={HALO}>
        {fmtCompact(Number(p.value))}
      </text>
    );
  };

export function TrendChart({ data, etiquetas = "todas" }: {
  data: { mes: string; ingresos: number; gastos: number }[];
  etiquetas?: ModoEtiquetas;
}) {
  // "picos": solo máximos y mínimos notables, para que no tapen las líneas.
  const extIng = extremos(data.map((d) => d.ingresos));
  const extGas = extremos(data.map((d) => d.gastos));
  const muestra = (ext: Set<number>) => (i: number) =>
    etiquetas === "todas" ? true : etiquetas === "picos" ? ext.has(i) : false;
  return (
    <div>
      <Leyenda items={[{ color: C.principal, label: "Ingresos" }, { color: C.acento, label: "Gastos" }]} />
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 30, right: 28, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id="gIng" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.principal} stopOpacity={0.18} />
              <stop offset="100%" stopColor={C.principal} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="mes" stroke={AX} tick={TICK} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={C.principal} strokeWidth={2.5} fill="url(#gIng)"
            dot={{ r: 3, fill: C.principal, strokeWidth: 0 }}
            label={lblSerie(C.principal, -12, muestra(extIng))} />
          <Area type="monotone" dataKey="gastos" name="Gastos" stroke={C.acento} strokeWidth={2.5} fill="transparent"
            dot={{ r: 3, fill: C.acento, strokeWidth: 0 }}
            label={lblSerie("#8A6A1D", 20, muestra(extGas))} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras mensuales de una sola medida (EBITDA, utilidad neta…): positivo en el
 *  color dado, negativo SIEMPRE en rojo. */
export function MesBars({ data, nombre, color = C.principal }: {
  data: { mes: string; valor: number }[]; nombre: string; color?: string;
}) {
  return (
    <div>
      <Leyenda items={[{ color, label: nombre }, ...(data.some((d) => d.valor < 0) ? [{ color: C.malo, label: `${nombre} negativo` }] : [])]} />
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 26, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="mes" stroke={AX} tick={TICK} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Bar dataKey="valor" name={nombre} radius={[4, 4, 0, 0]} barSize={30}>
            <LabelList dataKey="valor" position="top" {...ETIQ} formatter={lblC} />
            {data.map((d, i) => (
              <Cell key={i} fill={d.valor >= 0 ? color : C.malo} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResultBars({ data }: { data: { mes: string; resultado: number }[] }) {
  return (
    <div>
      <Leyenda items={[{ color: C.bueno, label: "Utilidad del mes" }, { color: C.malo, label: "Pérdida del mes" }]} />
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 26, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="mes" stroke={AX} tick={TICK} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]} barSize={30}>
            <LabelList dataKey="resultado" position="top" {...ETIQ} formatter={lblC} />
            {data.map((d, i) => (
              <Cell key={i} fill={d.resultado >= 0 ? C.bueno : C.malo} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBars({ data, grueso }: { data: { name: string; value: number }[]; grueso?: boolean }) {
  const alto = grueso ? 64 : 48;
  return (
    <ResponsiveContainer width="100%" height={Math.max(150, data.length * alto)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 86, left: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" stroke={AX}
          tick={{ fontSize: grueso ? 13.5 : 12.5, fill: AX, fontWeight: grueso ? 700 : 500 }}
          width={grueso ? 200 : 175} tickLine={false} axisLine={false} />
        <Bar dataKey="value" name="Valor" radius={[0, 5, 5, 0]} fill={C.principal} barSize={grueso ? 34 : 24}>
          <LabelList dataKey="value" position="right" {...(grueso ? ETIQ_LG : ETIQ)} formatter={lblC} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Sparkline: contexto histórico junto a la cifra. */
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

/** Los dos motores de utilidad, mes a mes: total arriba y, dentro de cada
 *  barra, cuánto puso cada fuente (se omite si el segmento es muy bajito). */
const lblDentro = (fill: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function EtiquetaDentro(p: any) {
    if (!p?.value || Number(p.height ?? 0) < 16) return null;
    return (
      <text x={Number(p.x ?? 0) + Number(p.width ?? 0) / 2} y={Number(p.y ?? 0) + Number(p.height ?? 0) / 2 + 4}
        textAnchor="middle" fontSize={11} fontWeight={600} fill={fill}>
        {fmtCompact(Number(p.value))}
      </text>
    );
  };

export function ContribBars({ data }: { data: { mes: string; cobertura: number; inversiones: number }[] }) {
  return (
    <div>
      <Leyenda items={[
        { color: C.principal, label: "Ingresos por cobertura de créditos (netos)" },
        { color: C.acento, label: "Ingresos por inversiones" },
      ]} />
      <ResponsiveContainer width="100%" height={310}>
        <BarChart data={data} margin={{ top: 28, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="mes" stroke={AX} tick={TICK} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Bar dataKey="cobertura" name="Cobertura de créditos" stackId="c" fill={C.principal} barSize={38}>
            <LabelList dataKey="cobertura" content={lblDentro("#ffffff")} />
          </Bar>
          <Bar dataKey="inversiones" name="Inversiones" stackId="c" fill={C.acento} barSize={38} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="inversiones" content={lblDentro("#13286E")} />
            <LabelList {...ETIQ} position="top"
              valueAccessor={(e: any) => (e?.payload ? e.payload.cobertura + e.payload.inversiones : null)}
              formatter={lblC} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Análisis vertical: participación sobre la base — la etiqueta muestra
 *  PORCENTAJE y CIFRA: "89,6% · 1.490,7 M". */
export function PctBars({ data, grueso }: { data: { name: string; pct: number; valor: number }[]; grueso?: boolean }) {
  const alto = grueso ? 60 : 44;
  const d = data.map((x) => ({ ...x, lbl: `${x.pct}% · ${fmtCompact(x.valor)}` }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(150, d.length * alto)}>
      <BarChart data={d} layout="vertical" margin={{ top: 4, right: 150, left: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" stroke={AX}
          tick={{ fontSize: grueso ? 13.5 : 12.5, fill: AX, fontWeight: grueso ? 700 : 500 }}
          width={grueso ? 200 : 175} tickLine={false} axisLine={false} />
        <Bar dataKey="pct" name="Participación" radius={[0, 5, 5, 0]} barSize={grueso ? 32 : 22}>
          <LabelList dataKey="lbl" position="right" {...(grueso ? ETIQ_LG : ETIQ)} />
          {d.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Análisis horizontal: variación % vs. año anterior — la etiqueta muestra
 *  variación Y cifra actual: "▲ 91,4% · 1.664,2 M". */
export function VarBars({ data }: { data: { name: string; varPct: number; valor: number }[] }) {
  const d = data.map((x) => ({ ...x, lbl: `${x.varPct >= 0 ? "▲" : "▼"} ${Math.abs(x.varPct)}% · ${fmtCompact(x.valor)}` }));
  return (
    <div>
      <Leyenda items={[{ color: C.bueno, label: "Crece vs. año anterior" }, { color: C.malo, label: "Cae vs. año anterior" }]} />
      <ResponsiveContainer width="100%" height={Math.max(150, d.length * 44)}>
        <BarChart data={d} layout="vertical" margin={{ top: 4, right: 160, left: 12, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" stroke={AX} tick={{ fontSize: 12.5, fill: AX, fontWeight: 500 }} width={175} tickLine={false} axisLine={false} />
          <Bar dataKey="varPct" name="Variación" radius={[0, 5, 5, 0]} barSize={22}>
            <LabelList dataKey="lbl" {...ETIQ} position="right" />
            {d.map((x, i) => <Cell key={i} fill={x.varPct >= 0 ? C.bueno : C.malo} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WaterfallChart({ data }: { data: { name: string; base: number; value: number; tipo: string; signo: number }[] }) {
  const d = data.map((x) => ({ ...x, base: x.base / 1e6, value: x.value / 1e6 }));
  const color = (x: { tipo: string; signo: number }) =>
    x.tipo === "total" ? (x.signo >= 0 ? C.principal : C.malo) : x.tipo === "inc" ? C.bueno : C.malo;
  return (
    <div>
      <Leyenda items={[
        { color: C.bueno, label: "Suma" },
        { color: C.malo, label: "Resta" },
        { color: C.principal, label: "Subtotal / resultado" },
      ]} />
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={d} margin={{ top: 26, right: 8, left: 8, bottom: 40 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" stroke={AX} tick={{ fontSize: 11.5, fill: AX, fontWeight: 500 }} interval={0} tickLine={false} axisLine={false} angle={-26} textAnchor="end" height={72} />
          <YAxis hide />
          <Bar dataKey="base" stackId="a" fill="transparent" />
          <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]} barSize={44}>
            <LabelList {...ETIQ} position="top"
              valueAccessor={(e: any) => (e?.payload ? e.payload.signo * e.payload.value : null)}
              formatter={lblCM} />
            {d.map((x, i) => (
              <Cell key={i} fill={color(x)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DualLine({ data }: { data: { mes: string; activo: number; pasivo: number }[] }) {
  return (
    <div>
      <Leyenda items={[{ color: C.principal, label: "Activo" }, { color: C.acento, label: "Pasivo" }]} />
      <ResponsiveContainer width="100%" height={290}>
        <AreaChart data={data} margin={{ top: 26, right: 26, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.principal} stopOpacity={0.16} /><stop offset="100%" stopColor={C.principal} stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="mes" stroke={AX} tick={TICK} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Area type="monotone" dataKey="activo" name="Activo" stroke={C.principal} strokeWidth={2.5} fill="url(#gA)"
            dot={{ r: 3, fill: C.principal, strokeWidth: 0 }}
            label={{ position: "top", dy: -6, ...ETIQ, fill: C.principal, formatter: lblC }} />
          <Area type="monotone" dataKey="pasivo" name="Pasivo" stroke={C.acento} strokeWidth={2.5} fill="transparent"
            dot={{ r: 3, fill: C.acento, strokeWidth: 0 }}
            label={{ position: "bottom", dy: 8, ...ETIQ, fill: "#8A6A1D", formatter: lblC }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Composición como donut eliminada (parte-todo = barras). */
export function DonutComposition({ data }: { data: { name: string; value: number }[] }) {
  return <HBars data={data} />;
}
