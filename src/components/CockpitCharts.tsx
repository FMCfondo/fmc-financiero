"use client";
import { C } from "@/components/Charts";

/* Gráficos del Cockpit — SVG a mano, sin librería: son pocos, muy específicos y
   así se controla exactamente la densidad y las etiquetas. Reglas de la casa:
   valores SIEMPRE visibles (nunca hay que pasar el cursor para entender),
   sin tooltips, sin eje Y, y el color solo cuando significa algo. */

const AX = "#334155", FAINT = "#93a1b8", LINE = "#e3e9f2";
const mm = (v: number, d?: number) => {
  const k = d === undefined ? (Math.abs(v) >= 100 ? 0 : 1) : d;
  return v.toLocaleString("es-CO", { minimumFractionDigits: k, maximumFractionDigits: k });
};

/** El gráfico insignia: el respaldo cubriendo las obligaciones de garantía.
 *  Mientras la línea sólida vaya por encima de la punteada, el fondo cumple. */
export function Cobertura({ resp, gar }: { resp: number[]; gar: number[] }) {
  const W = 300, H = 96, pt = 12, pb = 16;
  const all = [...resp, ...gar];
  const mn = Math.min(...all) * 0.985, mx = Math.max(...all) * 1.015;
  const n = resp.length;
  const X = (i: number) => (n < 2 ? W / 2 : (i * W) / (n - 1));
  const Y = (v: number) => pt + (1 - (v - mn) / (mx - mn || 1)) * (H - pt - pb);
  const path = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const banda = `${path(resp)} L ${X(n - 1)} ${Y(gar[n - 1])} ${gar.slice().reverse().map((v, i) => `L ${X(n - 1 - i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ")} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} aria-hidden>
        <path d={banda} fill={C.bueno} opacity={0.15} />
        <path d={path(gar)} fill="none" stroke={FAINT} strokeWidth={1.4} strokeDasharray="3 3" />
        <path d={path(resp)} fill="none" stroke={C.bueno} strokeWidth={2.2} strokeLinejoin="round" />
        <circle cx={X(n - 1)} cy={Y(resp[n - 1])} r={3} fill={C.bueno} />
      </svg>
      <div className="flex gap-4 text-[10.5px] text-faint mt-1">
        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-0.5" style={{ background: C.bueno }} />Respaldo</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-3" style={{ borderTop: `1.4px dashed ${FAINT}` }} />Obligaciones</span>
      </div>
    </div>
  );
}

/** Mini-serie de una cuenta, con SU propia escala. */
export function Mini({ data, color }: { data: number[]; color: string }) {
  const W = 140, H = 30;
  const mn = Math.min(...data), mx = Math.max(...data), rg = mx - mn || 1;
  const n = data.length;
  const X = (i: number) => (n < 2 ? W / 2 : (i * W) / (n - 1));
  const Y = (v: number) => 3 + (1 - (v - mn) / rg) * (H - 7);
  const d = data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={color} opacity={0.09} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={X(n - 1)} cy={Y(data[n - 1])} r={2.2} fill={color} />
    </svg>
  );
}

/** Barras apiladas de las dos vías de ingreso, con el TOTAL sobre cada barra. */
export function DosVias({ data }: { data: { mes: string; comisiones: number; inversiones: number; total: number }[] }) {
  const W = 780, H = 200, pt = 24, pb = 24;
  const mx = Math.max(...data.map((d) => d.total)) * 1.18 || 1;
  const gap = W / data.length, bw = gap * 0.44;
  const Y = (v: number) => pt + (1 - v / mx) * (H - pt - pb);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 200 }} aria-hidden>
        <line x1={0} y1={H - pb} x2={W} y2={H - pb} stroke={LINE} strokeWidth={1} />
        {data.map((d, i) => {
          const x = i * gap + (gap - bw) / 2, yT = Y(d.total), yC = Y(d.inversiones);
          return (
            <g key={d.mes}>
              <rect x={x} y={yC} width={bw} height={Math.max(0, H - pb - yC)} fill={C.acento} />
              <rect x={x} y={yT} width={bw} height={Math.max(0, yC - yT)} fill={C.principal} />
              <text x={x + bw / 2} y={yT - 8} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={AX}>{mm(d.total)}</text>
              <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize={10.5} fill={FAINT}>{d.mes}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-5 text-[11.5px] text-muted mt-2">
        <span className="flex items-center gap-2"><i className="inline-block w-3 h-2.5 rounded-sm" style={{ background: C.principal }} />Ingresos por cobertura de créditos</span>
        <span className="flex items-center gap-2"><i className="inline-block w-3 h-2.5 rounded-sm" style={{ background: C.acento }} />Ingreso por inversiones</span>
      </div>
    </div>
  );
}

/** Serie(s) de línea con el último valor rotulado. */
export function Linea({ series, leyenda }: {
  series: { v: number[]; color: string; dash?: boolean }[];
  leyenda?: [string, string][];
}) {
  const W = 330, H = 138, pt = 22, pb = 20;
  const all = series.flatMap((s) => s.v);
  let mn = Math.min(...all), mx = Math.max(...all);
  const pad = (mx - mn) * 0.3 || 1; mn -= pad; mx += pad;
  const n = series[0].v.length;
  const X = (i: number) => (n < 2 ? W / 2 : (i * W) / (n - 1));
  const Y = (v: number) => pt + (1 - (v - mn) / (mx - mn || 1)) * (H - pt - pb);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 138 }} aria-hidden>
        <line x1={0} y1={H - pb} x2={W} y2={H - pb} stroke={LINE} strokeWidth={1} />
        {series.map((s, k) => {
          const d = s.v.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
          return (
            <g key={k}>
              {k === 0 && <path d={`${d} L ${W} ${H - pb} L 0 ${H - pb} Z`} fill={s.color} opacity={0.1} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeDasharray={s.dash ? "3 3" : undefined} />
              <circle cx={X(n - 1)} cy={Y(s.v[n - 1])} r={3} fill={s.color} />
              <text x={X(n - 1)} y={Y(s.v[n - 1]) - 9} textAnchor="end" fontSize={12} fontWeight={700} fill={AX}>{mm(s.v[n - 1])}</text>
            </g>
          );
        })}
      </svg>
      {leyenda && (
        <div className="flex gap-5 flex-wrap text-[11.5px] text-muted mt-2">
          {leyenda.map(([nm, col]) => <span key={nm} className="flex items-center gap-2"><i className="inline-block w-3.5 h-0.5" style={{ background: col }} />{nm}</span>)}
        </div>
      )}
    </div>
  );
}
