"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { C, Leyenda } from "@/components/Charts";
import { fmtCompact } from "@/lib/format";

/* Gráficos del Cockpit — mismo lenguaje que Charts.tsx (sin tooltips, sin eje Y,
   halo en las etiquetas) pero más SOBRIOS: solo se rotula el último punto de
   cada serie; el resto es forma. La Junta lee tendencia + cifra de cierre. */

const AX = "#334155";
const GRID = "#e3e9f4";
const HALO = { paintOrder: "stroke" as const, stroke: "#ffffff", strokeWidth: 3.5 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lblUltimo = (n: number, dy = -8) => function UltimoLabel(p: any) {
  if (p?.index !== n - 1 || p?.value === undefined) return null;
  return (
    <text x={p.x} y={Number(p.y) + dy} textAnchor="end" fontSize={12} fontWeight={700} fill={AX} style={HALO}>
      {fmtCompact(Number(p.value))}
    </text>
  );
};

/** Dos series de línea (b opcional): la tendencia estratégica del Cockpit. */
export function DosLineas({ data, labelA, labelB, colorA = C.principal, colorB = C.comparativo }: {
  data: { mes: string; a: number; b: number | null }[];
  labelA: string; labelB?: string; colorA?: string; colorB?: string;
}) {
  const conB = data.some((d) => d.b !== null);
  const n = data.length;
  return (
    <div>
      <Leyenda items={[{ color: colorA, label: labelA }, ...(conB && labelB ? [{ color: colorB, label: labelB }] : [])]} />
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="mes" stroke={AX} tick={{ fontSize: 11, fill: AX }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis hide domain={["auto", "auto"]} />
          <Line dataKey="a" stroke={colorA} strokeWidth={2.2} dot={false} isAnimationActive={false}>
            <LabelList content={lblUltimo(n)} />
          </Line>
          {conB && (
            <Line dataKey="b" stroke={colorB} strokeWidth={2} dot={false} isAnimationActive={false}>
              <LabelList content={lblUltimo(n, 16)} />
            </Line>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
