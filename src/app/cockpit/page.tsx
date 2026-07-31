import Link from "next/link";
import { ensureLoaded, resolverEtq, leerNotas, type NotaPeriodo } from "@/lib/data";
import { construirInforme, TERMINOS, type Modo, type Informe } from "@/lib/cockpit";
import type { IndCockpit } from "@/lib/indicadores";
import { fmtCOP, fmtPct, mesNombre } from "@/lib/format";
import { C } from "@/components/Charts";
import { BarrasCobertura, Cobertura, Mini, DosVias, Linea } from "@/components/CockpitCharts";
import BalanceVisual from "@/components/BalanceVisual";
import EjecucionCockpit from "@/components/EjecucionCockpit";
import { FileSpreadsheet, Landmark, Waves, Layers, Wallet, Target, ArrowRight } from "lucide-react";

/* COCKPIT EJECUTIVO — la reunión de Junta, en orden.
   Principio rector: si a un miembro de Junta hay que explicarle el gráfico, el
   gráfico fracasó. Cada bloque abre con una imagen que se entiende sola; las
   cifras acompañan, no encabezan. El MISMO objeto `Informe` alimentará el PDF. */

const mm = (v: number, d?: number) => {
  const k = d === undefined ? (Math.abs(v) >= 100 ? 0 : 1) : d;
  return v.toLocaleString("es-CO", { minimumFractionDigits: k, maximumFractionDigits: k });
};
const Mill = ({ v }: { v: number }) => (
  <>{mm(v)}<span className="text-[0.5em] font-semibold text-faint ml-1 align-baseline">Mill.</span></>
);

export default async function CockpitPage({ searchParams }: {
  searchParams: Promise<{ p?: string; modo?: string }>;
}) {
  const { p, modo: qModo } = await searchParams;
  await ensureLoaded();
  const etq = resolverEtq(p);
  const modo: Modo = qModo === "mes" ? "mes" : "acum";
  const inf = construirInforme(etq, modo);
  const notas = await leerNotas(inf.periodo.anio, inf.periodo.mes);

  return (
    <div className="max-w-[1180px] space-y-6">
      <Encabezado inf={inf} p={p} />
      <Portada inf={inf} />
      <Balance inf={inf} />
      <Negocio inf={inf} />
      {inf.hayPpto && <Ejecucion inf={inf} />}
      <Trayectoria inf={inf} />
      <Notas notas={notas} mes={inf.periodo.mes} p={p} />
      <Detalle p={p} />
    </div>
  );
}

/* ---------- cabecera ---------- */
function Encabezado({ inf, p }: { inf: Informe; p?: string }) {
  const href = (m: Modo) => {
    const q = new URLSearchParams();
    if (p) q.set("p", p);
    if (m !== "acum") q.set("modo", m);
    const s = q.toString();
    return `/cockpit${s ? "?" + s : ""}`;
  };
  const chip = (act: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
      act ? "bg-royal text-white border-royal" : "border-line text-muted hover:text-fg hover:bg-card2"}`;
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cockpit Ejecutivo</h1>
        <p className="text-sm text-muted mt-0.5">{inf.periodo.nombre} · {inf.tramoLabel} · millones de pesos</p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-fg mr-1">Ver:</span>
        <Link href={href("acum")} className={chip(inf.modo === "acum")}>Año corrido</Link>
        <Link href={href("mes")} className={chip(inf.modo === "mes")}>Solo el mes</Link>
      </div>
    </div>
  );
}

function Titulo({ children, sub, extra }: { children: React.ReactNode; sub?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
      {extra}
    </div>
  );
}

/* ---------- portada: el estado y la misión ---------- */
function Portada({ inf }: { inf: Informe }) {
  const m = inf.mision;
  const grave = inf.estado === "grave";
  const tono = grave ? "bg-neg" : inf.estado === "vigilar" ? "bg-gold" : "bg-pos";
  const etiqueta = grave ? "Requiere atención" : inf.estado === "vigilar" ? "Margen estrecho" : "Situación sólida";
  const r = inf.resultado;
  const cifras = [
    { k: "Utilidad neta", v: r.utilNeta, extra: r.pctPlanUn !== null ? `${r.pctPlanUn.toFixed(0)}% del plan anual` : undefined },
    { k: "EBITDA", v: r.ebitda, extra: `margen limpio ${fmtPct(r.margenEbitda)}` },
    { k: TERMINOS.ingOperacion, v: r.ingOp, extra: `${fmtPct(r.pctComisiones)} cobertura · ${fmtPct(r.pctInversiones)} inversiones` },
  ];
  return (
    <div className="grid lg:grid-cols-[1.05fr_1fr] gap-4">
      {/* la misión, en dos barras comparables */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className={`h-2 w-2 rounded-full ${tono}`} />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{etiqueta}</span>
          <span className="ml-auto text-[26px] font-bold tnum tracking-tight leading-none">{fmtPct(m.cobertura)}</span>
        </div>
        <BarrasCobertura respaldo={m.respaldo} obligaciones={m.obligaciones} />
        <div className="mt-4 pt-4 border-t border-line">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-muted">Cómo evolucionó en el año</span>
            <span className="text-[11px] text-faint">mínimo exigido 100%</span>
          </div>
          <Cobertura resp={m.sResp} gar={m.sGar} />
        </div>
      </div>

      {/* el resultado del período */}
      <div className="card p-6 flex flex-col">
        <h2 className="text-[17px] font-semibold tracking-tight leading-snug text-balance">{inf.titular}</h2>
        <p className="text-[13.5px] text-muted mt-2.5 leading-relaxed">{inf.lede}</p>
        <div className="grid grid-cols-3 gap-4 mt-auto pt-5">
          {cifras.map((c) => (
            <div key={c.k}>
              <div className="text-[11px] text-muted leading-tight">{c.k}</div>
              <div className="text-[21px] font-bold tnum tracking-tight mt-1 leading-none" title={fmtCOP(c.v * 1e6)}>
                <Mill v={c.v} />
              </div>
              {c.extra && <div className="text-[10.5px] text-faint mt-1 leading-snug">{c.extra}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- balance ---------- */
function Balance({ inf }: { inf: Informe }) {
  const [act, pas, pat] = inf.balance;
  return (
    <div className="card p-6">
      <Titulo sub="el activo y cómo está financiado — las dos columnas siempre miden lo mismo"
        extra={<span className="text-[11px] uppercase tracking-wider text-faint">al cierre de {inf.periodo.nombre.toLowerCase()}</span>}>
        Lo que tenemos y lo que debemos
      </Titulo>

      <BalanceVisual
        activo={{ total: act.total, items: act.items }}
        pasivo={{ total: pas.total, items: pas.items }}
        patrimonio={{ total: pat.total, items: pat.items }}
      />

      {/* proyección de cada bloque + indicadores de solidez */}
      <div className="grid sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-line">
        {inf.balance.map((b) => (
          <div key={b.id} className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted">{b.titulo} a diciembre</span>
            <span className="text-[15px] font-bold tnum">{mm(b.proyeccion)}</span>
          </div>
        ))}
      </div>
      {inf.indicadores.solidez.length > 0 && (
        <div className="flex gap-2.5 flex-wrap mt-4">{inf.indicadores.solidez.map((i) => <Pildora key={i.id} i={i} />)}</div>
      )}

      {/* cómo se movió cada cuenta */}
      <div className="mt-6 pt-5 border-t border-line">
        <Titulo sub="cada gráfico con su propia escala, para que las cuentas pequeñas también se vean">
          Cómo se movió cada cuenta en el año
        </Titulo>
        {inf.movimientos.map((g) => (
          <div key={g.grupo} className="mb-4 last:mb-0">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint mb-2">{g.grupo}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {g.cuentas.map((c) => {
                const col = c.cambio === null ? "#93a1b8" : c.cambio >= 0 ? C.bueno : C.malo;
                return (
                  <div key={c.nombre} className="rounded-lg border border-line p-3">
                    <div className="text-[11px] text-muted truncate" title={c.nombre}>{c.nombre}</div>
                    <div className="text-[17px] font-bold tnum mt-0.5">{mm(c.actual)}</div>
                    <div className="text-[10.5px] font-semibold mt-0.5" style={{ color: col }}>
                      {c.cambio === null ? "nuevo en el año" : `${c.cambio >= 0 ? "↑" : "↓"} ${Math.abs(c.cambio).toFixed(0)}%`}
                    </div>
                    <div className="mt-1.5"><Mini data={c.serie} color={col} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pildora({ i }: { i: IndCockpit }) {
  const col = i.nivel === "bien" ? "text-pos" : i.nivel === "mal" ? "text-neg" : i.nivel === "regular" ? "text-gold" : "text-fg";
  const v = i.formato === "pct" ? fmtPct(i.valor) : i.formato === "veces" ? i.valor.toFixed(2).replace(".", ",") : mm(i.valor / 1e6);
  return (
    <span className="inline-flex items-baseline gap-2 px-3 py-1.5 rounded-lg bg-card2 text-xs" title={i.nota ?? undefined}>
      <span className="text-muted">{i.nombre}</span>
      <b className={`${col} tnum text-[13px]`}>{v}</b>
      {i.palabra && <span className={`${col} font-medium`}>{i.palabra}</span>}
      {i.meta && <span className="text-faint text-[11px]">{i.meta}</span>}
    </span>
  );
}

/* ---------- lo que genera el negocio ---------- */
function Negocio({ inf }: { inf: Informe }) {
  const c = inf.comisiones, r = inf.resultado;
  return (
    <div className="card p-6">
      <Titulo sub="los dos motores del fondo y lo que aporta cada uno"
        extra={<span className="text-[11px] uppercase tracking-wider text-faint">{inf.tramoLabel}</span>}>
        Lo que genera el negocio
      </Titulo>

      {/* el embudo de la garantía: de lo facturado a lo que queda */}
      <div className="rounded-xl border border-line overflow-hidden mb-6">
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line">
          <Embudo k={TERMINOS.facturado} v={c.facturado} sub="cobrado al cliente, antes de IVA"
            barra={100} color={C.comparativo} proj={c.projFacturado} />
          <Embudo k={`(−) ${TERMINOS.reserva}`} v={c.reserva} sub={`${fmtPct(c.pctReserva)} — respalda las garantías`}
            barra={c.pctReserva * 100} color={C.malo} />
          <Embudo k={`= ${TERMINOS.comisiones}`} v={c.real} sub={`${fmtPct(c.pctReal)} de lo facturado`}
            barra={c.pctReal * 100} color={C.principal} destacado proj={c.projReal} />
        </div>
      </div>

      {/* las dos vías, mes a mes */}
      <Titulo sub="el número sobre cada barra es el total del mes">Las dos vías de ingreso</Titulo>
      <DosVias data={inf.dosVias} />

      <div className="grid sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-line">
        {[
          { k: TERMINOS.ingOperacion, v: r.ingOp, p: r.projIngOp },
          { k: "EBITDA", v: r.ebitda, p: r.projEbitda },
          { k: "Utilidad neta", v: r.utilNeta, p: r.projUtil },
        ].map((x) => (
          <div key={x.k} className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted">{x.k} al cierre</span>
            <span className="text-[15px] font-bold tnum">{x.p === null ? "—" : mm(x.p)}</span>
          </div>
        ))}
      </div>
      {inf.indicadores.margen.length > 0 && (
        <div className="flex gap-2.5 flex-wrap mt-4">{inf.indicadores.margen.map((i) => <Pildora key={i.id} i={i} />)}</div>
      )}
    </div>
  );
}

function Embudo({ k, v, sub, barra, color, destacado, proj }: {
  k: string; v: number; sub: string; barra: number; color: string; destacado?: boolean; proj?: number | null;
}) {
  return (
    <div className={`p-5 ${destacado ? "bg-accentdim" : ""}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{k}</div>
      <div className="text-[25px] font-bold tnum tracking-tight mt-1.5 leading-none" title={fmtCOP(v * 1e6)}>
        <Mill v={v} />
      </div>
      <div className="h-1.5 rounded-full bg-line mt-3 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(barra, 100)}%`, background: color }} />
      </div>
      <div className="text-[11.5px] text-muted mt-2 leading-snug">{sub}</div>
      {proj != null && <div className="text-[11px] text-faint mt-1">Al ritmo actual: <b className="text-fg tnum">{mm(proj)}</b> al cierre</div>}
    </div>
  );
}

/* ---------- ejecución ---------- */
function Ejecucion({ inf }: { inf: Informe }) {
  return (
    <div className="card p-6">
      <Titulo sub={`el tiempo transcurrido (${inf.tiempoPct.toFixed(0)}% del año) marca el ritmo esperado en cada barra`}
        extra={<span className="text-[11px] uppercase tracking-wider text-faint">{inf.modo === "acum" ? "vs. plan anual" : "vs. ritmo mensual"}</span>}>
        Ejecución presupuestal
      </Titulo>
      <EjecucionCockpit filas={inf.ejecucion} tiempoPct={inf.tiempoPct} />
      <p className="text-[11.5px] text-faint mt-4 leading-relaxed max-w-[80ch]">
        Se compara contra el <b className="text-muted">plan anual</b> —y no contra el reparto mensual— porque el presupuesto
        se distribuyó sin una estacionalidad conocida. «vs. ritmo» es cuánto se lleva por encima o por debajo de lo esperado
        a esta altura del año.
      </p>
    </div>
  );
}

/* ---------- trayectoria ---------- */
function Trayectoria({ inf }: { inf: Informe }) {
  const t = inf.trayectoria;
  const graficos = [
    { t: "Ingreso de operación y gastos", s: "la distancia entre las líneas es el EBITDA",
      series: [{ v: t.ingOp, color: C.principal }, { v: t.gastos, color: C.comparativo, dash: true }],
      leyenda: [["Ingreso de operación", C.principal], ["Gastos", C.comparativo]] as [string, string][] },
    { t: "Utilidad neta del mes", s: "lo que quedó cada mes, después de impuestos", series: [{ v: t.utilNeta, color: C.bueno }] },
    { t: "Patrimonio total", s: "incluye la utilidad estimada del ejercicio", series: [{ v: t.patrimonio, color: C.principal }] },
  ];
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {graficos.map((g) => (
        <div key={g.t} className="card p-5">
          <h3 className="text-[13.5px] font-semibold">{g.t}</h3>
          <p className="text-[11.5px] text-muted mt-0.5">{g.s}</p>
          <div className="mt-2"><Linea series={g.series} leyenda={g.leyenda} /></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- notas ---------- */
function Notas({ notas, mes, p }: { notas: NotaPeriodo[]; mes: number; p?: string }) {
  return (
    <div className="card p-6">
      <Titulo sub="lo que explica los movimientos fuera de lo habitual"
        extra={notas.length ? <span className="text-[11px] uppercase tracking-wider text-faint">{notas.length} nota{notas.length === 1 ? "" : "s"}</span> : undefined}>
        Notas del período
      </Titulo>
      {notas.length === 0 ? (
        <p className="text-sm text-muted">
          Aún no hay notas de este período. En{" "}
          <Link href={`/revision${p ? `?p=${p}` : ""}`} className="text-accent2 hover:underline">Revisión del cierre</Link>{" "}
          la aplicación señala lo que se sale de lo habitual y pide la explicación; lo que escribas aparecerá aquí.
        </p>
      ) : (
        <div className="space-y-4">
          {notas.map((nt, i) => (
            <div key={i} className="border-l-2 border-royal pl-4">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-[14px] font-semibold">{nt.titulo}</span>
                {nt.cifra && <span className="text-[11px] font-semibold text-neg tnum">{nt.cifra}</span>}
                <span className="text-[10.5px] uppercase tracking-wider text-faint ml-auto">Cierre de {mesNombre[mes].toLowerCase()}</span>
              </div>
              <p className="text-[13.5px] text-muted mt-1.5 leading-relaxed max-w-[80ch]">{nt.cuerpo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- detalle ---------- */
function Detalle({ p }: { p?: string }) {
  const qs = p ? `?p=${p}` : "";
  const items = [
    { href: `/estados/resultados${qs}`, label: "Estado de Resultados", icon: FileSpreadsheet },
    { href: `/estados/situacion${qs}`, label: "Situación Financiera", icon: Landmark },
    { href: `/estados/flujo${qs}`, label: "Flujo de Efectivo", icon: Waves },
    { href: `/estados/resultados${qs ? qs + "&" : "?"}vista=presupuesto`, label: "Presupuesto", icon: Target },
    { href: `/estados/patrimonio${qs}`, label: "Patrimonio", icon: Layers },
    { href: `/portafolio`, label: "Portafolio", icon: Wallet },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href}
          className="card px-4 py-3.5 flex items-center gap-2.5 hover:border-royal/40 hover:bg-card2 transition-colors group">
          <Icon size={16} className="text-royal shrink-0" />
          <span className="text-[12.5px] font-medium leading-tight flex-1">{label}</span>
          <ArrowRight size={13} className="text-faint group-hover:text-royal transition-colors shrink-0" />
        </Link>
      ))}
    </div>
  );
}
