import Link from "next/link";
import { ensureLoaded, mesesVista, resolverEtq } from "@/lib/data";
import { construirInforme, type Base, type Modo, type Informe } from "@/lib/cockpit";
import { indicadoresMatriz } from "@/lib/indicadores";
import { fmtM, fmtCOP, fmtPct, mesCorto } from "@/lib/format";
import { Sparkline, TrendChart, WaterfallChart } from "@/components/Charts";
import { DosLineas } from "@/components/CockpitCharts";
import IndicadoresTabla from "@/components/IndicadoresTabla";
import {
  FileSpreadsheet, Landmark, Waves, Layers, Wallet, ArrowRight, CheckCircle2,
} from "lucide-react";

/* Executive Financial Cockpit — la herramienta para CONDUCIR la reunión de Junta.
   No es un dashboard: es la reunión, en orden. Cada sección responde la pregunta
   que naturalmente sigue en la presentación, y el MISMO objeto `Informe` que se
   renderiza aquí alimentará el informe PDF para la Junta (misma narrativa).
   Todo sale de los motores validados — esta página no calcula nada contable. */

export default async function CockpitPage({ searchParams }: {
  searchParams: Promise<{ p?: string; modo?: string; base?: string }>;
}) {
  const { p, modo: qModo, base: qBase } = await searchParams;
  await ensureLoaded();
  const etq = resolverEtq(p);
  const modo: Modo = qModo === "mes" ? "mes" : "acum";
  const base: Base = qBase === "mes" || qBase === "anio" ? qBase : "ppto";
  const inf = construirInforme(etq, modo, base);

  return (
    <div className="space-y-7 max-w-[1200px]">
      <ContextBar inf={inf} p={p} />
      <ResumenEjecutivo inf={inf} />
      <SignosVitales inf={inf} />
      <QueCambio inf={inf} />
      <PresupuestoReal inf={inf} />
      <Evolucion inf={inf} />
      <Indicadores etq={etq} />
      <Portafolio inf={inf} />
      <Atencion inf={inf} />
      <Detalle p={p} />
    </div>
  );
}

/* ---------- 0 · contexto único: período, modo y base de comparación ---------- */
function ContextBar({ inf, p }: { inf: Informe; p?: string }) {
  const href = (m: Modo, b: Base) => {
    const q = new URLSearchParams();
    if (p) q.set("p", p);
    if (m !== "acum") q.set("modo", m);
    if (b !== "ppto") q.set("base", b);
    const s = q.toString();
    return `/cockpit${s ? "?" + s : ""}`;
  };
  const chip = (act: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${act ? "bg-royal text-white border-royal" : "border-line text-muted hover:text-fg hover:bg-card2"}`;
  return (
    <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cockpit Ejecutivo</h1>
        <p className="text-sm text-muted">{inf.periodo.nombre} · cifras en millones de pesos (el valor exacto, al pasar el cursor)</p>
      </div>
      <div className="flex items-center gap-1.5 ml-auto flex-wrap">
        <span className="text-xs font-medium text-fg mr-1">Ver:</span>
        <Link href={href("acum", inf.base)} className={chip(inf.modo === "acum")}>Acumulado del año</Link>
        <Link href={href("mes", inf.base)} className={chip(inf.modo === "mes")}>Mes</Link>
        <span className="text-xs font-medium text-fg ml-3 mr-1">Comparar contra:</span>
        {inf.hayPpto && <Link href={href(inf.modo, "ppto")} className={chip(inf.base === "ppto")}>Presupuesto</Link>}
        {inf.hayPrevMes && <Link href={href(inf.modo, "mes")} className={chip(inf.base === "mes")}>Mes anterior</Link>}
        {inf.hayPrevAnio && <Link href={href(inf.modo, "anio")} className={chip(inf.base === "anio")}>Año anterior</Link>}
      </div>
    </div>
  );
}

function SecHead({ n, titulo, pregunta }: { n: number; titulo: string; pregunta: string }) {
  return (
    <div className="flex items-baseline gap-2.5 mb-3 flex-wrap">
      <h2 className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted">{n} · {titulo}</h2>
      <span className="text-xs text-faint">{pregunta}</span>
    </div>
  );
}

/* ---------- 1 · Resumen Ejecutivo — la apertura del gerente ---------- */
function ResumenEjecutivo({ inf }: { inf: Informe }) {
  const dot = inf.estado === "grave" ? "bg-neg" : inf.estado === "vigilar" ? "bg-gold" : "bg-pos";
  const estado = inf.estado === "grave" ? "Requiere atención" : inf.estado === "vigilar" ? "Sólida, con frentes a vigilar" : "Sólida";
  // Dos párrafos: el resultado (R1–R3) y la salud del fondo (R4–R5).
  const p1 = inf.frases.filter((f) => ["R1", "R2", "R3"].includes(f.regla)).map((f) => f.texto).join(" ");
  const p2 = inf.frases.filter((f) => ["R4", "R5"].includes(f.regla)).map((f) => f.texto).join(" ");
  return (
    <section>
      <SecHead n={1} titulo="Resumen ejecutivo" pregunta="¿Qué ocurrió en el período?" />
      <div className="card p-6 flex gap-4 items-start">
        <span className={`h-3 w-3 rounded-full mt-1.5 shrink-0 ${dot}`} style={{ boxShadow: "0 0 0 4px color-mix(in srgb, currentcolor 15%, transparent)" }} />
        <div className="space-y-2.5">
          <div className="text-[15px] font-semibold">{estado} · {inf.periodo.nombre}</div>
          {p1 && <p className="text-[14px] leading-relaxed text-fg/85">{p1}</p>}
          {p2 && <p className="text-[14px] leading-relaxed text-fg/85">{p2}</p>}
          <p className="text-[11px] text-faint">Narrativa generada por reglas (R1–R5) sobre las cifras del motor — sin conclusiones inventadas. Comparación: {inf.baseLabel}.</p>
        </div>
      </div>
    </section>
  );
}

/* ---------- 2 · Signos vitales ---------- */
function SignosVitales({ inf }: { inf: Informe }) {
  return (
    <section>
      <SecHead n={2} titulo="Signos vitales" pregunta="¿Cómo está la organización?" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {inf.kpis.map((k) => <KpiCard key={k.id} k={k} />)}
        {inf.ejecGlobal && (
          <div className="card p-4">
            <div className="text-xs text-muted leading-snug">Ejecución del presupuesto</div>
            <div className="mt-2 space-y-2">
              <BarraEjec label="Ingresos de operación" pct={inf.ejecGlobal.ing} />
              <BarraEjec label="Gastos de administración" pct={inf.ejecGlobal.gas} inverso />
            </div>
            <div className="text-[11px] text-faint mt-2">% del plan del tramo · detalle en la sección 4</div>
          </div>
        )}
      </div>
    </section>
  );
}

function KpiCard({ k }: { k: Informe["kpis"][number] }) {
  const valor = k.unidad === "pct" ? fmtPct(k.valor) : fmtM(k.valor);
  const title = k.unidad === "pct" ? undefined : fmtCOP(k.valor);
  const dcolor = k.dir === "pos" ? "text-pos" : k.dir === "neg" ? "text-neg" : "text-muted";
  const flecha = k.delta === null ? "" : k.delta >= 0 ? "▲" : "▼";
  const f1 = (n: number) => Math.abs(n).toFixed(1).replace(".", ","); // decimal es-CO
  const deltaTxt = k.delta === null ? "—" : k.deltaUnidad === "pts" ? `${f1(k.delta)} pts` : `${f1(k.delta)}%`;
  return (
    <div className={`card p-4 ${k.ancla ? "border-royal/30" : ""}`}>
      <div className="text-xs text-muted leading-snug">{k.label}</div>
      <div className="text-[22px] font-bold tnum tracking-tight mt-1" title={title}>{valor}</div>
      <div className="flex items-end justify-between gap-2 mt-1.5">
        <div className="min-w-0">
          <div className={`text-xs font-semibold ${dcolor}`}>{flecha} {deltaTxt} <span className="text-faint font-normal">{k.deltaLabel}</span></div>
          {k.sub && <div className="text-[11px] text-faint mt-0.5 truncate">{k.sub}</div>}
        </div>
        {k.serie && k.serie.length > 2 && (
          <div className="w-[72px] shrink-0"><Sparkline data={k.serie} color={k.dir === "neg" ? "#B3261E" : "#13286E"} height={26} /></div>
        )}
      </div>
    </div>
  );
}

function BarraEjec({ label, pct, inverso }: { label: string; pct: number | null; inverso?: boolean }) {
  if (pct === null) return null;
  const bien = inverso ? pct <= 105 : pct >= 95;
  const color = bien ? "var(--color-pos)" : "var(--color-neg)";
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1"><span className="text-muted">{label}</span><b className="tnum">{pct.toFixed(0)}%</b></div>
      <div className="ejec-bar"><span style={{ width: `${Math.min(pct, 140) / 1.4}%`, background: color }} /></div>
    </div>
  );
}

/* ---------- 3 · Qué cambió y por qué ---------- */
function QueCambio({ inf }: { inf: Informe }) {
  if (!inf.puente.length && !inf.variaciones.length) return null;
  return (
    <section>
      <SecHead n={3} titulo="Qué cambió y por qué" pregunta="¿Qué explica el resultado del período?" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3.5 items-start">
        {inf.puente.length > 0 && (
          <div className="card p-5 lg:col-span-3">
            <h3 className="font-medium">Puente de la utilidad</h3>
            <p className="text-xs text-muted mb-2">De la utilidad {inf.baseLabel === "lo presupuestado" ? "presupuestada" : `de ${inf.baseLabel}`} a la real — qué sumó y qué restó (cierra exacto)</p>
            <WaterfallChart data={inf.puente} />
          </div>
        )}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-medium">Variaciones que explican el período</h3>
          <p className="text-xs text-muted mb-3">Solo desvíos materiales (≥ 2% de los ingresos o ≥ COP 1 M) · vs. {inf.baseLabel}</p>
          {inf.variaciones.length === 0 && <p className="text-sm text-faint">Sin desvíos materiales en el período.</p>}
          <div>
            {inf.variaciones.map((v) => {
              const bien = v.impacto >= 0;
              const maxD = Math.max(...inf.variaciones.map((x) => Math.abs(x.delta)));
              return (
                <div key={v.nombre} className="py-2 border-b border-line-soft last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] truncate">{v.nombre}</span>
                    <span className={`text-[13px] font-bold tnum whitespace-nowrap ${bien ? "text-pos" : "text-neg"}`} title={fmtCOP(v.delta)}>
                      {v.delta >= 0 ? "+" : "−"}{fmtM(Math.abs(v.delta)).replace("COP ", "")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-0.5">
                    <span className="text-[11px] text-faint">{v.clase === "ingreso" ? "ingreso" : "gasto"} · real {fmtM(v.actual).replace("COP ", "")} / ref. {fmtM(v.ref).replace("COP ", "")}</span>
                  </div>
                  <div className="ejec-bar mt-1.5"><span style={{ width: `${(Math.abs(v.delta) / maxD) * 100}%`, background: bien ? "var(--color-pos)" : "var(--color-neg)" }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 4 · Presupuesto vs. Real ---------- */
function PresupuestoReal({ inf }: { inf: Informe }) {
  if (!inf.termometro.length) return null;
  return (
    <section>
      <SecHead n={4} titulo="Presupuesto vs. real" pregunta="¿Cómo vamos frente al plan aprobado por la Junta?" />
      <div className="card p-5">
        <div>
          {inf.termometro.map((t) => {
            const c = t.semaforo === "bueno" ? "var(--color-pos)" : t.semaforo === "malo" ? "var(--color-neg)" : "var(--color-gold)";
            return (
              <div key={t.etiqueta} className="grid grid-cols-[170px_1fr_150px] max-sm:grid-cols-[1fr_120px] items-center gap-4 py-2.5 border-b border-line-soft last:border-0">
                <span className="text-[13px] font-medium truncate">{cap(t.etiqueta)}</span>
                <div className="ejec-bar max-sm:hidden" style={{ height: 8 }}>
                  <span style={{ width: `${Math.min(t.pct ?? 0, 140) / 1.4}%`, background: c }} />
                  <span className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-fg/50" style={{ left: `${100 / 1.4}%` }} />
                </div>
                <span className="text-right text-[13px] tnum">
                  <b style={{ color: c }}>{t.pct === null ? "—" : `${t.pct.toFixed(0)}%`}</b>
                  <span className="text-faint text-[11px] block" title={`${fmtCOP(t.real)} / ${fmtCOP(t.ppto)}`}>
                    {fmtM(t.real).replace("COP ", "")} / {fmtM(t.ppto).replace("COP ", "")}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-x-4 gap-y-1 text-[11px] text-muted flex-wrap mt-3">
          <span>La línea vertical marca el 100% del plan del tramo.</span>
          <Link href="/estados/resultados?vista=ejec-acum" className="text-accent2 hover:underline font-medium">Ver las 75 líneas del presupuesto <ArrowRight size={11} className="inline" /></Link>
        </div>
      </div>
    </section>
  );
}
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/* ---------- 5 · Evolución (las 4 tendencias estratégicas) ---------- */
function Evolucion({ inf }: { inf: Informe }) {
  const e = inf.evolucion;
  return (
    <section>
      <SecHead n={5} titulo="Evolución" pregunta="¿Hacia dónde vamos? · últimos 12 meses" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="card p-5">
          <h3 className="font-medium mb-1">Ingresos vs. Gastos</h3>
          <TrendChart data={e.ingGas} etiquetas="picos" />
        </div>
        <div className="card p-5">
          <h3 className="font-medium mb-1">EBITDA y Utilidad neta del mes</h3>
          <DosLineas data={e.ebitdaUn.map((x) => ({ mes: x.mes, a: x.ebitda, b: x.utilNeta }))} labelA="EBITDA" labelB="Utilidad neta" colorA="#13286E" colorB="#C99A2E" />
        </div>
        <div className="card p-5">
          <h3 className="font-medium mb-1">Respaldo vs. Obligaciones de garantía</h3>
          <p className="text-xs text-muted mb-1">la misión del fondo: que la línea azul siempre cubra la gris</p>
          <DosLineas data={e.respaldo} labelA="Respaldo (efectivo + inversiones)" labelB="Obligaciones (2640)" colorA="#13286E" colorB="#8A94A6" />
        </div>
        <div className="card p-5">
          <h3 className="font-medium mb-1">Patrimonio total</h3>
          <p className="text-xs text-muted mb-1">incluye la utilidad estimada del ejercicio</p>
          <DosLineas data={e.patrimonio} labelA="Patrimonio" colorA="#1B7A3D" />
        </div>
      </div>
      <p className="text-[11px] text-faint mt-2">El análisis profundo de tendencias (multi-año, con filtros) vive en <Link href="/estados/dashboard?sec=tendencias" className="text-accent2 hover:underline">Análisis › Tendencias</Link>.</p>
    </section>
  );
}

/* ---------- 6 · Indicadores ---------- */
async function Indicadores({ etq }: { etq: string }) {
  const meses = mesesVista(etq, undefined, 6);
  const cats = indicadoresMatriz(meses);
  const labels = meses.map((m) => `${mesCorto[m.mes]} ${String(m.anio).slice(2)}`);
  return (
    <section>
      <SecHead n={6} titulo="Indicadores financieros" pregunta="¿La salud financiera se sostiene? · pasa el cursor por un indicador para ver qué es" />
      <IndicadoresTabla labels={labels} cats={cats} />
    </section>
  );
}

/* ---------- 7 · Portafolio ---------- */
function Portafolio({ inf }: { inf: Informe }) {
  const p = inf.portafolio;
  if (!p.hayDatos) return null;
  return (
    <section>
      <SecHead n={7} titulo="Portafolio" pregunta="¿Cómo rinde la tesorería? ¿Hay liquidez?" />
      <div className="card p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat l="Total invertido" v={fmtM(p.total)} title={fmtCOP(p.total)} s={`mayor entidad: ${fmtPct(p.top1)}`} />
          <Stat l="Tasa ponderada E.A." v={fmtPct(p.tasaPonderada)} s={p.benchmark ? `referencia ${fmtPct(p.benchmark)}` : "referencia sin definir"} />
          <Stat l="Disponible a la vista" v={fmtPct(p.pctLiquido)} s="liquidez inmediata" />
          <Stat l="Próximo vencimiento" v={p.proxVenc ? `${p.proxVenc.dias} días` : "—"} s={p.proxVenc ? `${p.proxVenc.entidad} · ${p.proxVenc.fecha}` : "sin CDTs vigentes"} />
        </div>
        <div className="mt-4">
          <div className="flex h-2.5 rounded-full overflow-hidden border border-line">
            {p.porTipo.map((t, i) => (
              <span key={t.tipo} title={`${t.tipo}: ${fmtPct(t.pct)}`} style={{ width: `${t.pct * 100}%`, background: ["#13286E", "#C99A2E", "#1B7A3D", "#8A94A6"][i % 4] }} />
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap mt-2 text-[11.5px] text-muted">
            {p.porTipo.map((t, i) => (
              <span key={t.tipo} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: ["#13286E", "#C99A2E", "#1B7A3D", "#8A94A6"][i % 4] }} />
                {t.tipo} {fmtPct(t.pct)}
              </span>
            ))}
            <Link href="/portafolio" className="text-accent2 hover:underline font-medium ml-auto">Ver el portafolio completo <ArrowRight size={11} className="inline" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
function Stat({ l, v, s, title }: { l: string; v: string; s?: string; title?: string }) {
  return (
    <div>
      <div className="text-[11.5px] text-muted">{l}</div>
      <div className="text-lg font-bold tnum mt-0.5" title={title}>{v}</div>
      {s && <div className="text-[11px] text-faint mt-0.5">{s}</div>}
    </div>
  );
}

/* ---------- 8 · Aspectos que requieren atención ---------- */
function Atencion({ inf }: { inf: Informe }) {
  return (
    <section>
      <SecHead n={8} titulo="Aspectos que requieren atención" pregunta="Solo situaciones relevantes, por reglas objetivas" />
      {inf.atencion.length === 0 ? (
        <div className="card p-5 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-pos shrink-0" />
          <p className="text-sm text-muted">No hay aspectos que requieran atención especial en este período.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {inf.atencion.map((a, i) => (
            <Link key={i} href={a.href} className="flex gap-3.5 px-5 py-3.5 border-b border-line-soft last:border-0 hover:bg-card2/70 transition-colors">
              <span className={`w-1 rounded-full shrink-0 self-stretch ${a.sev === "alta" ? "bg-neg" : a.sev === "media" ? "bg-gold" : "bg-line"}`} />
              <span className="flex-1">
                <span className="block text-[13.5px] font-semibold">{a.titulo}</span>
                <span className="block text-[12.5px] text-muted mt-0.5">{a.detalle}</span>
              </span>
              <ArrowRight size={14} className="text-faint self-center shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- 9 · Acceso al detalle ---------- */
function Detalle({ p }: { p?: string }) {
  const qs = p ? `?p=${p}` : "";
  const items = [
    { href: `/estados/resultados${qs}`, label: "Estado de Resultados", icon: FileSpreadsheet },
    { href: `/estados/situacion${qs}`, label: "Situación Financiera", icon: Landmark },
    { href: `/estados/flujo${qs}`, label: "Flujo de Efectivo", icon: Waves },
    { href: `/estados/patrimonio${qs}`, label: "Cambios en el Patrimonio", icon: Layers },
    { href: `/portafolio`, label: "Portafolio", icon: Wallet },
  ];
  return (
    <section>
      <SecHead n={9} titulo="Ir al detalle" pregunta="Los estados financieros completos, para profundizar" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="card p-4 flex items-center gap-3 hover:bg-card2 transition-colors group">
            <Icon size={17} className="text-royal shrink-0" />
            <span className="text-[13px] font-medium flex-1">{label}</span>
            <ArrowRight size={13} className="text-faint group-hover:text-royal transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}
