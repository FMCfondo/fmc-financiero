import Link from "next/link";
import { ensureLoaded, resolverEtq, leerNotas, type NotaPeriodo } from "@/lib/data";
import { mesNombre } from "@/lib/format";
import { construirInforme, TERMINOS, type Modo, type Informe } from "@/lib/cockpit";
import type { IndCockpit } from "@/lib/indicadores";
import { fmtCOP, fmtPct } from "@/lib/format";
import { C } from "@/components/Charts";
import { Cobertura, Mini, DosVias, Linea } from "@/components/CockpitCharts";
import EjecucionCockpit from "@/components/EjecucionCockpit";
import { FileSpreadsheet, Landmark, Waves, Layers, Wallet, Target } from "lucide-react";

/* COCKPIT EJECUTIVO — la herramienta para conducir la reunión de Junta.
   No es un dashboard: es la reunión, en orden. El MISMO objeto `Informe` que se
   renderiza aquí alimentará el informe PDF. Principio rector: si a un miembro de
   Junta hay que explicarle el gráfico, el gráfico fracasó. */

/** Cifras SIEMPRE en millones (el motor ya las entrega así). */
const mm = (v: number, d?: number) => {
  const k = d === undefined ? (Math.abs(v) >= 100 ? 0 : 1) : d;
  return v.toLocaleString("es-CO", { minimumFractionDigits: k, maximumFractionDigits: k });
};
const Mill = ({ v }: { v: number }) => <>{mm(v)}<span className="un">Mill.</span></>;
const PAL = [C.principal, C.secundario, C.acento, C.comparativo, "#c2ccdc"];

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
    <div className="max-w-[1120px] space-y-0">
      <Encabezado inf={inf} p={p} />
      <Portada inf={inf} />
      <Balance inf={inf} />
      <Comisiones inf={inf} />
      <Negocio inf={inf} />
      {inf.hayPpto && <Ejecucion inf={inf} />}
      <Trayectoria inf={inf} />
      <Notas notas={notas} mes={inf.periodo.mes} p={p} />
      <Detalle p={p} />
    </div>
  );
}

/* ---------- encabezado y contexto ---------- */
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
    <div className="flex items-end justify-between gap-4 flex-wrap pb-4 border-b border-line">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cockpit Ejecutivo</h1>
        <p className="text-sm text-muted mt-0.5">
          {inf.periodo.nombre} · {inf.tramoLabel} · cifras en millones de pesos
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-fg mr-1">Ver:</span>
        <Link href={href("acum")} className={chip(inf.modo === "acum")}>Año corrido</Link>
        <Link href={href("mes")} className={chip(inf.modo === "mes")}>Solo el mes</Link>
      </div>
    </div>
  );
}

function Seccion({ n, titulo, pregunta, derecha, children }: {
  n: string; titulo: string; pregunta?: string; derecha?: string; children: React.ReactNode;
}) {
  return (
    <section className="ck-sec">
      <div className="ck-head">
        <span className="rn">{n}</span>
        <span className="ti">
          <h2>{titulo}</h2>
          {pregunta && <span className="q">{pregunta}</span>}
          {derecha && <span className="rt">{derecha}</span>}
        </span>
      </div>
      <div className="ck-body">{children}</div>
    </section>
  );
}

/* ---------- portada: veredicto + la misión ---------- */
function Portada({ inf }: { inf: Informe }) {
  const m = inf.mision;
  const tono = inf.estado === "grave" ? "text-neg" : inf.estado === "vigilar" ? "text-gold" : "text-pos";
  const etiqueta = inf.estado === "grave" ? "Requiere atención" : inf.estado === "vigilar" ? "Margen estrecho" : "Situación sólida";
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-8 py-9 border-b-2 border-royal2">
      <div>
        <div className={`flex items-center gap-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] ${tono} mb-4`}>
          <span className="w-5 h-px bg-current" />{etiqueta}
        </div>
        <h2 className="text-[clamp(20px,2.7vw,29px)] font-semibold tracking-tight leading-[1.22] text-balance max-w-[21ch]">
          {inf.titular}
        </h2>
        <p className="mt-4 text-[14.5px] leading-relaxed text-muted max-w-[58ch]">{inf.lede}</p>
      </div>
      <div className="lg:pl-7 lg:border-l border-line max-lg:pt-6 max-lg:border-t">
        <div className="ck-lab">Razón de cobertura</div>
        <div className="text-[46px] font-semibold tracking-[-0.04em] leading-none mt-2 tnum">
          {fmtPct(m.cobertura)}
        </div>
        <p className="text-xs text-muted mt-2.5 leading-relaxed">
          El respaldo supera las obligaciones de garantía en{" "}
          <b className="text-pos font-semibold">{mm(m.excedente)} Mill.</b> El mínimo exigido es 100%.
        </p>
        <div className="mt-4"><Cobertura resp={m.sResp} gar={m.sGar} /></div>
      </div>
    </div>
  );
}

/* ---------- I · balance ---------- */
function Balance({ inf }: { inf: Informe }) {
  return (
    <Seccion n="I" titulo="Lo que tenemos y lo que debemos" pregunta="la foto patrimonial" derecha={`al cierre de ${inf.periodo.nombre.toLowerCase()}`}>
      <div className="grid lg:grid-cols-3">
        {inf.balance.map((b) => (
          <div key={b.id} className="ck-col">
            <div className="ck-lab">{b.titulo}</div>
            <div className="ck-fig"><Mill v={b.total} /></div>
            <div className="ck-cap">{b.nota}</div>
            <div className="ck-comp">
              {b.items.map((x, i) => <span key={x.nombre} style={{ width: `${Math.max(x.pct * 100, 0)}%`, background: PAL[i % 5] }} />)}
            </div>
            <div className="mt-3">
              {b.items.map((x, i) => (
                <div key={x.nombre} className="ck-cl">
                  <s style={{ background: PAL[i % 5] }} />
                  <span className="nm" title={x.nombre}>{x.nombre}</span>
                  <span className="vv">{mm(x.valor)}</span>
                  <span className="pp">{(x.pct * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="ck-proj"><span>Al ritmo actual, a diciembre</span><b>{mm(b.proyeccion)}</b></div>
          </div>
        ))}
      </div>

      {/* indicadores de solidez, integrados aquí */}
      {inf.indicadores.solidez.length > 0 && (
        <div className="flex gap-2.5 flex-wrap mt-6">
          {inf.indicadores.solidez.map((i) => <Pildora key={i.id} i={i} />)}
        </div>
      )}

      {/* cómo se movió cada cuenta */}
      {inf.movimientos.map((g) => (
        <div key={g.grupo}>
          <div className="ck-smt">{g.grupo} · cómo se movió cada cuenta en el año</div>
          <div className="ck-smg">
            {g.cuentas.map((c) => {
              const col = c.cambio === null ? "#93a1b8" : c.cambio >= 0 ? C.bueno : C.malo;
              return (
                <div key={c.nombre} className="ck-sm">
                  <div className="nm" title={c.nombre}>{c.nombre}</div>
                  <div className="vv">{mm(c.actual)}</div>
                  <div className="dd" style={{ color: col }}>
                    {c.cambio === null ? "nuevo en el año" : `${c.cambio >= 0 ? "↑" : "↓"} ${Math.abs(c.cambio).toFixed(0)}% desde enero`}
                  </div>
                  <Mini data={c.serie} color={col} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-faint mt-4 leading-relaxed max-w-[76ch]">
        Cada cuenta se dibuja con <b className="text-muted">su propia escala</b>: así se ve el movimiento de Deudores o
        Efectivo, que quedarían aplastados si compartieran eje con Inversiones.
      </p>
    </Seccion>
  );
}

function Pildora({ i }: { i: IndCockpit }) {
  const col = i.nivel === "bien" ? "text-pos" : i.nivel === "mal" ? "text-neg" : i.nivel === "regular" ? "text-gold" : "text-fg";
  const v = i.formato === "pct" ? fmtPct(i.valor) : i.formato === "veces" ? i.valor.toFixed(2).replace(".", ",") : mm(i.valor / 1e6);
  return (
    <span className="ck-ind" title={i.nota ?? undefined}>
      <span className="text-muted">{i.nombre}</span>
      <b className={col}>{v}</b>
      {i.palabra && <span className={`${col} font-medium`}>{i.palabra}</span>}
      {i.meta && <span className="meta">{i.meta}</span>}
    </span>
  );
}

/* ---------- II · de lo facturado al ingreso real ---------- */
function Comisiones({ inf }: { inf: Informe }) {
  const c = inf.comisiones;
  return (
    <Seccion n="II" titulo="De lo facturado al ingreso real" pregunta="las dos cifras que se confunden" derecha={inf.tramoLabel}>
      <div className="ck-flow">
        <div className="ck-fn">
          <div className="k">{TERMINOS.facturado}</div>
          <div className="v"><Mill v={c.facturado} /></div>
          <div className="p">
            valor cobrado al cliente, antes de IVA
            {c.projFacturado !== null && <><br /><b className="text-fg">Al ritmo actual: {mm(c.projFacturado)} al cierre</b></>}
          </div>
        </div>
        <div className="ck-ar">−</div>
        <div className="ck-fn">
          <div className="k">{TERMINOS.reserva}</div>
          <div className="v"><Mill v={c.reserva} /></div>
          <div className="p">{fmtPct(c.pctReserva)} de lo facturado — respalda las garantías vigentes</div>
        </div>
        <div className="ck-ar">=</div>
        <div className="ck-fn keep">
          <div className="k" style={{ color: "var(--color-pos)" }}>{TERMINOS.comisiones}</div>
          <div className="v text-pos"><Mill v={c.real} /></div>
          <div className="p">
            {fmtPct(c.pctReal)} de lo facturado
            {c.projReal !== null && <><br /><b className="text-fg">Al ritmo actual: {mm(c.projReal)} al cierre</b></>}
          </div>
        </div>
      </div>
      <p className="text-xs text-faint mt-4 leading-relaxed max-w-[76ch]">
        <b className="text-muted">Regla del tablero:</b> «{TERMINOS.comisiones}» es lo que le queda al fondo tras constituir
        la reserva. El valor facturado se nombra siempre «facturado» y se muestra junto a su reserva, nunca solo.
      </p>
    </Seccion>
  );
}

/* ---------- III · lo que genera el negocio ---------- */
function Negocio({ inf }: { inf: Informe }) {
  const r = inf.resultado;
  const kpis = [
    { k: TERMINOS.ingOperacion, v: r.ingOp, cap: `lo que realmente entra al fondo — comisiones ${fmtPct(r.pctComisiones)}, inversiones ${fmtPct(r.pctInversiones)}`, p: r.projIngOp },
    { k: "EBITDA", v: r.ebitda, cap: `margen limpio ${fmtPct(r.margenEbitda)} — sobre el ingreso de operación`, p: r.projEbitda },
    { k: "Utilidad neta", v: r.utilNeta, cap: r.pctPlanUn !== null ? `${r.pctPlanUn.toFixed(0)}% del plan anual, con ${inf.tiempoPct.toFixed(0)}% del año transcurrido` : "después de la provisión de renta", p: r.projUtil },
  ];
  return (
    <Seccion n="III" titulo="Lo que genera el negocio" pregunta="de dónde sale la utilidad" derecha={inf.tramoLabel}>
      <div className="grid lg:grid-cols-3">
        {kpis.map((x) => (
          <div key={x.k} className="ck-col">
            <div className="ck-lab">{x.k}</div>
            <div className="ck-fig"><Mill v={x.v} /></div>
            <div className="ck-cap">{x.cap}</div>
            {x.p !== null && <div className="ck-proj"><span>Al ritmo actual, al cierre</span><b>{mm(x.p)}</b></div>}
          </div>
        ))}
      </div>
      {inf.indicadores.margen.length > 0 && (
        <div className="flex gap-2.5 flex-wrap mt-6">{inf.indicadores.margen.map((i) => <Pildora key={i.id} i={i} />)}</div>
      )}
      <div className="mt-8">
        <h3 className="text-[13.5px] font-semibold">Las dos vías de ingreso, mes a mes</h3>
        <p className="text-xs text-faint mt-0.5">el número sobre cada barra es el total del mes</p>
        <div className="mt-3"><DosVias data={inf.dosVias} /></div>
      </div>
    </Seccion>
  );
}

/* ---------- IV · ejecución presupuestal ---------- */
function Ejecucion({ inf }: { inf: Informe }) {
  return (
    <Seccion n="IV" titulo="Ejecución presupuestal" pregunta="frente al plan aprobado por la Junta"
      derecha={inf.modo === "acum" ? "vs. plan anual" : "vs. ritmo mensual"}>
      <EjecucionCockpit filas={inf.ejecucion} tiempoPct={inf.tiempoPct} />
      <p className="text-xs text-faint mt-4 leading-relaxed max-w-[80ch]">
        La marca de cada barra señala el <b className="text-muted">{inf.tiempoPct.toFixed(0)}% del año transcurrido</b>;
        «vs. ritmo» es cuánto se lleva por encima o por debajo de ese ritmo. Se compara contra el <b className="text-muted">plan
        anual</b> —y no contra el reparto mensual— porque el presupuesto se distribuyó sin una estacionalidad conocida.
      </p>
    </Seccion>
  );
}

/* ---------- V · trayectoria ---------- */
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
    <Seccion n="V" titulo="Trayectoria" pregunta="hacia dónde vamos" derecha={`enero – ${inf.labels[inf.labels.length - 1]}`}>
      <div className="grid lg:grid-cols-3">
        {graficos.map((g) => (
          <div key={g.t} className="ck-col">
            <h3 className="text-[13.5px] font-semibold">{g.t}</h3>
            <p className="text-xs text-faint mt-0.5">{g.s}</p>
            <div className="mt-3"><Linea series={g.series} leyenda={g.leyenda} /></div>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

/* ---------- VI · notas del período ---------- */
function Notas({ notas, mes, p }: { notas: NotaPeriodo[]; mes: number; p?: string }) {
  return (
    <Seccion n="VI" titulo="Notas del período" pregunta="lo que explica lo inusual"
      derecha={notas.length ? `${notas.length} nota${notas.length === 1 ? "" : "s"}` : undefined}>
      {notas.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          Aún no hay notas registradas para este período. En{" "}
          <Link href={`/revision${p ? `?p=${p}` : ""}`} className="text-accent2 hover:underline">Revisión del cierre</Link>{" "}
          la aplicación señala los movimientos que se salen de lo habitual y pide la explicación; lo que escribas aparecerá aquí.
        </div>
      ) : (
        <div>
          {notas.map((nt, i) => (
            <div key={i} className="ck-nt">
              <div className="mg">Cierre de {mesNombre[mes].toLowerCase()}</div>
              <div>
                <div className="h">{nt.titulo}{nt.cifra && <em>{nt.cifra}</em>}</div>
                <div className="b">{nt.cuerpo}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-faint mt-4 leading-relaxed max-w-[76ch]">
        Estas notas <b className="text-muted">no las escribe el sistema</b>: la aplicación detecta lo que se sale del
        comportamiento habitual de cada cuenta y el analista registra la explicación al cerrar el mes.
      </p>
    </Seccion>
  );
}

/* ---------- VII · detalle ---------- */
function Detalle({ p }: { p?: string }) {
  const qs = p ? `?p=${p}` : "";
  const items = [
    { href: `/estados/resultados${qs}`, label: "Estado de Resultados", icon: FileSpreadsheet },
    { href: `/estados/situacion${qs}`, label: "Situación Financiera", icon: Landmark },
    { href: `/estados/flujo${qs}`, label: "Flujo de Efectivo", icon: Waves },
    { href: `/estados/resultados${qs ? qs + "&" : "?"}vista=presupuesto`, label: "Presupuesto", icon: Target },
    { href: `/estados/patrimonio${qs}`, label: "Cambios en el Patrimonio", icon: Layers },
    { href: `/portafolio`, label: "Portafolio", icon: Wallet },
  ];
  return (
    <Seccion n="VII" titulo="Ir al detalle" pregunta="los estados completos, para profundizar">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="ck-lk">
            <span className="flex items-center gap-2.5"><Icon size={15} className="text-royal" />{label}</span>
            <span className="text-faint">→</span>
          </Link>
        ))}
      </div>
    </Seccion>
  );
}
