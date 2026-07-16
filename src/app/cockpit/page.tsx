import Link from "next/link";
import { ensureLoaded, resolverEtq } from "@/lib/data";
import { construirInforme, type Base, type Modo, type Informe } from "@/lib/cockpit";
import { indicadoresCockpit, type IndCockpit } from "@/lib/indicadores";
import { fmtM, fmtCOP, fmtPct } from "@/lib/format";
import { Sparkline } from "@/components/Charts";
import { DosLineas } from "@/components/CockpitCharts";
import {
  FileSpreadsheet, Landmark, Waves, Layers, Wallet, ArrowRight, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

/* Executive Financial Cockpit — la herramienta para CONDUCIR la reunión de Junta.
   Principio rector: si un miembro de Junta necesita que le expliquen un gráfico,
   el gráfico fracasó. Cada elemento se entiende en cinco segundos, con sus valores
   a la vista (sin hover para comprender), en una paleta sobria: azul institucional,
   gris para lo secundario, verde solo para lo positivo, rojo solo para lo importante.
   El MISMO objeto `Informe` que se renderiza aquí alimentará el informe PDF. */

const AZUL = "#13286E", GRIS = "#8A94A6", VERDE = "#1B7A3D";

export default async function CockpitPage({ searchParams }: {
  searchParams: Promise<{ p?: string; modo?: string; base?: string }>;
}) {
  const { p, modo: qModo, base: qBase } = await searchParams;
  await ensureLoaded();
  const etq = resolverEtq(p);
  const modo: Modo = qModo === "mes" ? "mes" : "acum";
  const base: Base = qBase === "mes" || qBase === "anio" ? qBase : "ppto";
  const inf = construirInforme(etq, modo, base);
  const indic = indicadoresCockpit(etq);

  return (
    <div className="space-y-7 max-w-[1200px]">
      <ContextBar inf={inf} p={p} />
      <ResumenEjecutivo inf={inf} />
      <SignosVitales inf={inf} />
      <QueCambio inf={inf} />
      <PresupuestoReal inf={inf} />
      <Evolucion inf={inf} />
      <Indicadores indic={indic} />
      <Portafolio inf={inf} />
      <Hallazgos inf={inf} />
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
  const dot = inf.estado === "grave" ? "bg-neg" : inf.estado === "vigilar" ? "bg-royal" : "bg-pos";
  const estado = inf.estado === "grave" ? "Requiere atención" : inf.estado === "vigilar" ? "Sólida, con frentes a vigilar" : "Sólida";
  const p1 = inf.frases.filter((f) => ["R1", "R2", "R3"].includes(f.regla)).map((f) => f.texto).join(" ");
  const p2 = inf.frases.filter((f) => ["R4", "R5"].includes(f.regla)).map((f) => f.texto).join(" ");
  return (
    <section>
      <SecHead n={1} titulo="Resumen ejecutivo" pregunta="¿Qué ocurrió en el período?" />
      <div className="card p-6 flex gap-4 items-start">
        <span className={`h-3 w-3 rounded-full mt-1.5 shrink-0 ${dot}`} />
        <div className="space-y-2.5">
          <div className="text-[15px] font-semibold">{estado} · {inf.periodo.nombre}</div>
          {p1 && <p className="text-[14px] leading-relaxed text-fg/85">{p1}</p>}
          {p2 && <p className="text-[14px] leading-relaxed text-fg/85">{p2}</p>}
          <p className="text-[11px] text-faint">Redactado por reglas sobre las cifras del motor — sin conclusiones inventadas. Comparación: {inf.baseLabel}.</p>
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
            <div className="mt-2.5 space-y-2.5">
              <BarraEjec label="Ingresos de operación" pct={inf.ejecGlobal.ing} bueno={(inf.ejecGlobal.ing ?? 0) >= 95} />
              <BarraEjec label="Gastos de administración" pct={inf.ejecGlobal.gas} bueno={(inf.ejecGlobal.gas ?? 999) <= 105} />
            </div>
            <div className="text-[11px] text-faint mt-2.5">% de {inf.planLabel} · detalle en la sección 4</div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-faint mt-2">
        <b className="text-muted">EBITDA</b> = la utilidad de operar el negocio antes de impuestos y de los gastos que no mueven caja (depreciaciones y amortizaciones).
      </p>
    </section>
  );
}

function KpiCard({ k }: { k: Informe["kpis"][number] }) {
  const valor = k.unidad === "pct" ? fmtPct(k.valor) : fmtM(k.valor);
  const title = k.unidad === "pct" ? undefined : fmtCOP(k.valor);
  // Paleta sobria: verde si mejora, gris si baja sin ser crítico, rojo solo lo importante.
  const critico = (k.id === "cobertura" && k.valor < 1) || (k.id === "utilidad" && k.valor < 0);
  const dcolor = critico ? "text-neg" : k.dir === "pos" ? "text-pos" : "text-muted";
  const f1 = (n: number) => Math.abs(n).toFixed(1).replace(".", ",");
  return (
    <div className={`card p-4 ${k.ancla ? "border-royal/30" : ""}`}>
      <div className="text-xs text-muted leading-snug">{k.label}</div>
      <div className={`text-[22px] font-bold tnum tracking-tight mt-1 ${critico ? "text-neg" : ""}`} title={title}>{valor}</div>
      <div className="flex items-end justify-between gap-2 mt-1.5">
        <div className="min-w-0">
          {k.delta === null
            ? <div className="text-[11px] text-faint">{k.deltaLabel}</div>
            : <div className={`text-xs font-semibold ${dcolor}`}>{k.delta >= 0 ? "▲" : "▼"} {k.deltaUnidad === "pts" ? `${f1(k.delta)} pts` : `${f1(k.delta)}%`} <span className="text-faint font-normal">{k.deltaLabel}</span></div>}
          {k.sub && <div className="text-[11px] text-faint mt-0.5 truncate">{k.sub}</div>}
        </div>
        {k.serie && k.serie.length > 2 && (
          <div className="w-[72px] shrink-0"><Sparkline data={k.serie} color={critico ? "#B3261E" : AZUL} height={26} /></div>
        )}
      </div>
    </div>
  );
}

function BarraEjec({ label, pct, bueno }: { label: string; pct: number | null; bueno: boolean }) {
  if (pct === null) return null;
  const color = bueno ? "var(--color-pos)" : GRIS;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1"><span className="text-muted">{label}</span><b className="tnum">{pct.toFixed(0)}%</b></div>
      <div className="ejec-bar"><span style={{ width: `${Math.min(pct, 140) / 1.4}%`, background: color }} /></div>
    </div>
  );
}

/* ---------- 3 · Qué cambió — sin waterfall, solo lo evidente ---------- */
function QueCambio({ inf }: { inf: Informe }) {
  if (!inf.variaciones.length) {
    return (
      <section>
        <SecHead n={3} titulo="Qué cambió" pregunta={`¿Qué se movió frente a ${inf.baseLabel}?`} />
        <div className="card p-5 text-sm text-muted">Sin variaciones materiales frente a {inf.baseLabel} en el período.</div>
      </section>
    );
  }
  const maxD = Math.max(...inf.variaciones.map((x) => Math.abs(x.delta)));
  return (
    <section>
      <SecHead n={3} titulo="Qué cambió" pregunta={`Los mayores movimientos frente a ${inf.baseLabel} — el resto es estable`} />
      <div className="card p-5 space-y-1">
        {inf.variaciones.map((v) => {
          const bien = v.impacto >= 0;
          const color = bien ? "var(--color-pos)" : GRIS;
          return (
            <div key={v.nombre} className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-2 border-b border-line-soft last:border-0">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-medium truncate">{v.nombre}</span>
                  <span className="text-[11px] text-faint whitespace-nowrap">{v.clase === "ingreso" ? "ingreso" : "gasto"}</span>
                </div>
                <div className="ejec-bar mt-1.5" style={{ maxWidth: 420 }}><span style={{ width: `${(Math.abs(v.delta) / maxD) * 100}%`, background: color }} /></div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="text-[14px] font-bold tnum" style={{ color }} title={fmtCOP(v.delta)}>
                  {v.delta >= 0 ? "+" : "−"}{fmtM(Math.abs(v.delta)).replace("COP ", "")}
                </div>
                <div className="text-[11px] text-faint tnum" title={`real ${fmtCOP(v.actual)} · ref. ${fmtCOP(v.ref)}`}>
                  {fmtM(v.actual).replace("COP ", "")} vs. {fmtM(v.ref).replace("COP ", "")}
                </div>
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-faint pt-2">Verde = mejora el resultado · gris = lo reduce. Solo se listan desvíos materiales (≥ 2% de los ingresos o ≥ COP 1 M).</p>
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
            const c = t.semaforo === "bueno" ? "var(--color-pos)" : t.semaforo === "malo" ? "var(--color-neg)" : GRIS;
            return (
              <div key={t.etiqueta} className="grid grid-cols-[170px_1fr_150px] max-sm:grid-cols-[1fr_120px] items-center gap-4 py-2.5 border-b border-line-soft last:border-0">
                <span className="text-[13px] font-medium truncate">{t.etiqueta}</span>
                <div className="ejec-bar max-sm:hidden" style={{ height: 8 }}>
                  <span style={{ width: `${Math.min(t.pct ?? 0, 140) / 1.4}%`, background: c }} />
                  <span className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-fg/45" style={{ left: `${100 / 1.4}%` }} />
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
          <span>La línea vertical marca el 100% de {inf.planLabel}.</span>
          <Link href="/estados/resultados?vista=ejec-acum" className="text-accent2 hover:underline font-medium">Ver las 75 líneas del presupuesto <ArrowRight size={11} className="inline" /></Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5 · Evolución (4 tendencias, cada una con su cifra de cierre) ---------- */
function Evolucion({ inf }: { inf: Informe }) {
  const e = inf.evolucion;
  return (
    <section>
      <SecHead n={5} titulo="Evolución" pregunta="¿Hacia dónde vamos? · últimos 12 meses" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="card p-5">
          <h3 className="font-medium mb-1">Ingresos vs. Gastos</h3>
          <p className="text-xs text-muted mb-1">que la línea azul (ingresos) se mantenga sobre la gris</p>
          <DosLineas data={e.ingGas.map((x) => ({ mes: x.mes, a: x.ingresos, b: x.gastos }))} labelA="Ingresos" labelB="Gastos" colorA={AZUL} colorB={GRIS} />
        </div>
        <div className="card p-5">
          <h3 className="font-medium mb-1">EBITDA y Utilidad neta del mes</h3>
          <DosLineas data={e.ebitdaUn.map((x) => ({ mes: x.mes, a: x.ebitda, b: x.utilNeta }))} labelA="EBITDA" labelB="Utilidad neta" colorA={AZUL} colorB={VERDE} />
        </div>
        <div className="card p-5">
          <h3 className="font-medium mb-1">Respaldo vs. Obligaciones de garantía</h3>
          <p className="text-xs text-muted mb-1">la misión del fondo: que la línea azul siempre cubra la gris</p>
          <DosLineas data={e.respaldo} labelA="Respaldo (efectivo + inversiones)" labelB="Obligaciones" colorA={AZUL} colorB={GRIS} />
        </div>
        <div className="card p-5">
          <h3 className="font-medium mb-1">Patrimonio total</h3>
          <p className="text-xs text-muted mb-1">incluye la utilidad estimada del ejercicio</p>
          <DosLineas data={e.patrimonio} labelA="Patrimonio" colorA={AZUL} />
        </div>
      </div>
      <p className="text-[11px] text-faint mt-2">El análisis profundo de tendencias (multi-año, con filtros) vive en <Link href="/estados/dashboard?sec=tendencias" className="text-accent2 hover:underline">Análisis › Tendencias</Link>.</p>
    </section>
  );
}

/* ---------- 6 · Indicadores INTERPRETADOS (no números pelados) ---------- */
function Indicadores({ indic }: { indic: IndCockpit[] }) {
  return (
    <section>
      <SecHead n={6} titulo="Indicadores financieros" pregunta="¿La salud financiera se sostiene?" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        {indic.map((i) => <IndCard key={i.id} i={i} />)}
      </div>
    </section>
  );
}

function fmtInd(v: number, formato: IndCockpit["formato"]): string {
  if (formato === "pct") return fmtPct(v);
  if (formato === "veces") return `${v.toFixed(2).replace(".", ",")}×`;
  return fmtM(v);
}
function IndCard({ i }: { i: IndCockpit }) {
  const chip = i.nivel === "bien" ? "bg-pos/12 text-pos" : i.nivel === "mal" ? "bg-neg/12 text-neg" : i.nivel === "regular" ? "bg-card2 text-muted" : "";
  const sube = (i.deltaMes ?? 0) >= 0;
  const favorable = i.deltaMes === null ? null : i.bueno === "bajo" ? !sube : sube;
  const trendColor = favorable === null ? "text-faint" : favorable ? "text-pos" : "text-muted";
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[13px] text-muted">{i.nombre}</div>
        {i.palabra && <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${chip}`}>{i.palabra}</span>}
      </div>
      <div className="text-[22px] font-bold tnum mt-1">{fmtInd(i.valor, i.formato)}</div>
      <div className="flex items-center gap-2 mt-1 text-[11.5px]">
        {i.deltaMes !== null && Math.abs(i.deltaMes) > 1e-9 && (
          <span className={`inline-flex items-center gap-0.5 font-medium ${trendColor}`}>
            {sube ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {favorable ? "mejoró" : "bajó"}
          </span>
        )}
        <span className="text-faint">{i.meta ?? (i.deltaMes !== null ? "vs. mes anterior" : "sin comparativo")}</span>
      </div>
      {/* La advertencia del catálogo es OBLIGATORIA y visible: nunca en un tooltip. */}
      {i.nota && <p className="text-[10.5px] text-faint leading-snug mt-1.5">{i.nota}</p>}
    </div>
  );
}

/* ---------- 7 · Portafolio ---------- */
function Portafolio({ inf }: { inf: Informe }) {
  const p = inf.portafolio;
  if (!p.hayDatos) return null;
  const COLS = [AZUL, GRIS, VERDE, "#3B5BD9"];
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
              <span key={t.tipo} title={`${t.tipo}: ${fmtPct(t.pct)}`} style={{ width: `${t.pct * 100}%`, background: COLS[i % COLS.length] }} />
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap mt-2 text-[11.5px] text-muted">
            {p.porTipo.map((t, i) => (
              <span key={t.tipo} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: COLS[i % COLS.length] }} />
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

/* ---------- 8 · Hallazgos del período (reemplaza "aspectos que requieren atención") ---------- */
function Hallazgos({ inf }: { inf: Informe }) {
  const c = inf.comportamiento;
  const maxV = Math.max(...c.map((m) => Math.abs(m.valor)), 1);
  const f1 = (n: number) => Math.abs(n).toFixed(1).replace(".", ",");
  return (
    <section>
      <SecHead n={8} titulo="Hallazgos del período" pregunta="Lo que un gerente diría al abrir la reunión" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
        {/* Comportamiento: 4 magnitudes con su crecimiento, en barras claras */}
        <div className="card p-5">
          <h3 className="font-medium mb-3">Comportamiento financiero</h3>
          <div className="space-y-3">
            {c.map((m) => {
              const dcol = m.delta === null ? "text-faint" : m.bueno ? "text-pos" : "text-muted";
              return (
                <div key={m.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] text-muted truncate">{m.label}</span>
                      <span className="text-[13px] font-bold tnum" title={fmtCOP(m.valor)}>{fmtM(m.valor).replace("COP ", "")}</span>
                    </div>
                    <div className="ejec-bar mt-1.5"><span style={{ width: `${(Math.abs(m.valor) / maxV) * 100}%`, background: AZUL }} /></div>
                  </div>
                  <div className={`text-[12px] font-semibold whitespace-nowrap w-16 text-right ${dcol}`}>
                    {m.delta === null ? "—" : `${m.delta >= 0 ? "↑" : "↓"} ${f1(m.delta)}%`}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-faint mt-3">Crecimiento frente a {inf.baseLabel}.</p>
        </div>

        {/* Hallazgos en prosa corta */}
        <div className="card p-5">
          <h3 className="font-medium mb-3">Durante el período</h3>
          <ul className="space-y-2.5">
            {inf.hallazgos.map((h, idx) => {
              const dot = h.tono === "pos" ? "bg-pos" : h.tono === "neg" ? "bg-neg" : "bg-faint";
              const cuerpo = (
                <span className="flex gap-2.5">
                  <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${dot}`} />
                  <span className="text-[13px] text-fg/85 leading-relaxed">{h.texto}</span>
                </span>
              );
              return (
                <li key={idx}>
                  {h.href ? <Link href={h.href} className="block hover:bg-card2/60 -mx-2 px-2 py-0.5 rounded-lg transition-colors">{cuerpo}</Link> : cuerpo}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
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
