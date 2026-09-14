"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { extraerHojaPpto, type FilaLeida } from "@/lib/presupuesto-carga";
import { revisarPresupuesto, confirmarPresupuesto, type ResumenRevision } from "@/app/presupuesto/actions";
import { fmtCont, fmtNum } from "@/lib/format";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, DatabaseZap, Loader2, Info } from "lucide-react";

/* Carga del presupuesto de un año desde el libro de la Junta, en dos pasos:
   1) el navegador lee la hoja «PPTO <año>» (etiqueta, nivel de agrupación, doce
      meses y total) y el servidor devuelve la revisión: qué heredó del año anterior,
      qué es nuevo, qué desapareció y qué impide cargar — SIN escribir nada;
   2) el usuario confirma y se reemplaza el año entero.
   Lo que se envía al servidor son solo cifras y etiquetas; la estructura la decide él. */

type Lectura = { hoja: string; hojas: string[]; filas: FilaLeida[]; anioHoja: number | null; ignoradas: string[]; error?: string };

export default function PresupuestoCarga({ aniosCargados, anioSugerido }: { aniosCargados: number[]; anioSugerido: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState("");
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [anio, setAnio] = useState(anioSugerido);
  const [resumen, setResumen] = useState<ResumenRevision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState<number | null>(null);

  const leerHoja = (libro: XLSX.WorkBook, hoja: string): Lectura => {
    const ws = libro.Sheets[hoja];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    const niveles = ((ws["!rows"] ?? []) as { level?: number }[]).map((r) => r?.level ?? 0);
    const r = extraerHojaPpto(aoa, niveles);
    return { hoja, hojas: libro.SheetNames, ...r };
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombre(file.name); setResumen(null); setError(null); setCargado(null);
    const buf = await file.arrayBuffer();
    // cellStyles: sin ello SheetJS no entrega el outline de filas, que es el nivel.
    const libro = XLSX.read(buf, { type: "array", cellStyles: true });
    setWb(libro);
    // La hoja del presupuesto: la que se llame PPTO <año sugerido>, o la primera PPTO.
    const hoja = libro.SheetNames.find((n) => new RegExp(`^PPTO\\s*${anioSugerido}$`, "i").test(n.trim()))
      ?? libro.SheetNames.find((n) => /ppto|presupuesto/i.test(n)) ?? libro.SheetNames[0];
    const l = leerHoja(libro, hoja);
    setLectura(l);
    if (l.anioHoja) setAnio(l.anioHoja);
  }

  const cambiarHoja = (hoja: string) => {
    if (!wb) return;
    const l = leerHoja(wb, hoja);
    setLectura(l); setResumen(null); setCargado(null);
    if (l.anioHoja) setAnio(l.anioHoja);
  };

  const revisar = () =>
    start(async () => {
      if (!lectura) return;
      setError(null); setResumen(null); setCargado(null);
      const r = await revisarPresupuesto({ anio, filas: lectura.filas });
      if (r.resumen) setResumen(r.resumen);
      if (!r.ok) setError(r.error ?? "No se pudo revisar.");
    });

  const confirmar = () =>
    start(async () => {
      if (!lectura) return;
      setError(null);
      const r = await confirmarPresupuesto({ anio, filas: lectura.filas });
      if (!r.ok) { setError(r.error ?? "No se pudo cargar."); return; }
      setCargado(r.filas ?? 0);
      router.refresh();
    });

  const anioDistinto = lectura?.anioHoja && lectura.anioHoja !== anio;

  return (
    <div className="space-y-5">
      <label className="card p-8 flex flex-col items-center justify-center gap-3 border-dashed cursor-pointer hover:border-accent/50 transition-colors text-center">
        <div className="h-12 w-12 rounded-xl bg-accent/10 grid place-items-center"><Upload className="text-accent2" /></div>
        <div className="text-sm">
          <span className="text-accent2 font-medium">Selecciona el libro de la Junta</span>
          <span className="text-muted"> o arrástralo aquí</span>
        </div>
        <div className="text-xs text-muted">Excel (.xlsx) con la hoja «PPTO &lt;año&gt;»: conceptos agrupados, doce meses y total</div>
        <input type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={onFile} />
      </label>

      {lectura && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-pos" size={20} />
            <span className="text-sm">{nombre}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted">Hoja</label>
              <select value={lectura.hoja} onChange={(e) => cambiarHoja(e.target.value)}
                className="mt-1 w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent">
                {lectura.hojas.map((h) => <option key={h} value={h} className="bg-panel">{h}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Año del presupuesto</label>
              <input type="number" value={anio} min={2020} max={2100}
                onChange={(e) => { setAnio(parseInt(e.target.value) || anio); setResumen(null); setCargado(null); }}
                className="mt-1 w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent tnum" />
              {anioDistinto && <p className="text-[11px] text-[#8A6A1D] mt-1">La cabecera de la hoja dice {lectura.anioHoja}.</p>}
            </div>
            <div className="text-xs text-muted self-end pb-2">
              {lectura.error
                ? <span className="text-neg flex items-center gap-1.5"><AlertTriangle size={13} /> {lectura.error}</span>
                : <>{fmtNum(lectura.filas.length)} renglones hasta «UTILIDAD NETA»{lectura.ignoradas.length ? ` · ${lectura.ignoradas.length} después, ignorados (${lectura.ignoradas.slice(0, 3).join(", ")}${lectura.ignoradas.length > 3 ? "…" : ""})` : ""}</>}
            </div>
          </div>
          {aniosCargados.includes(anio) && (
            <p className="flex items-center gap-2 text-sm text-[#8A6A1D]"><AlertTriangle size={15} /> El presupuesto {anio} ya está cargado: al confirmar se reemplaza entero, conservando su mapeo de cuentas.</p>
          )}
          <button onClick={revisar} disabled={pending || !!lectura.error || !lectura.filas.length}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg brand-grad text-white text-sm font-medium disabled:opacity-60">
            {pending ? <Loader2 size={15} className="animate-spin" /> : <DatabaseZap size={15} />}
            Revisar contra el año anterior
          </button>
        </div>
      )}

      {resumen && (
        <div className={`card p-5 space-y-4 ${resumen.problemas.length ? "border-neg/40" : "border-pos/40"}`}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-medium">Revisión — presupuesto {anio}</h2>
            <span className="text-xs text-muted">estructura heredada de {resumen.anioBase ?? "—"}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
            <Dato label="Renglones" v={String(resumen.filas)} />
            <Dato label="Heredados exactos" v={String(resumen.porOrigen.exacta)} />
            <Dato label="Por parecido" v={String(resumen.porOrigen.aproximada)} tono={resumen.porOrigen.aproximada ? "warn" : undefined} />
            <Dato label="Nuevos (sin cuentas)" v={String(resumen.porOrigen.nueva)} tono={resumen.porOrigen.nueva ? "warn" : undefined} />
            <Dato label="Con cuentas PUC" v={`${resumen.conCuentas} de ${resumen.filas}`} />
          </div>

          {resumen.problemas.map((p, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-neg"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {p}</p>
          ))}
          {resumen.avisos.map((a, i) => (
            <p key={i} className="flex items-start gap-2 text-xs text-muted"><Info size={14} className="mt-0.5 shrink-0 text-accent2" /> {a}</p>
          ))}

          <details className="text-sm">
            <summary className="cursor-pointer text-accent2 hover:underline">Ver los {resumen.filas} renglones</summary>
            <div className="overflow-auto mt-2">
              <table className="text-xs border-collapse w-max min-w-full">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted">
                    {["#", "Concepto", "Tipo", "Origen", "Cuentas", "Total anual"].map((h, i) => (
                      <th key={h} className={`px-2 py-1.5 border-b border-line font-normal ${i >= 4 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resumen.detalle.map((d) => (
                    <tr key={d.orden} className={d.origen === "nueva" ? "bg-gold/10" : d.origen === "aproximada" ? "bg-accent/5" : ""}>
                      <td className="px-2 py-1 border-b border-line-soft tnum text-muted">{d.orden}</td>
                      <td className={`px-2 py-1 border-b border-line-soft ${d.tipo === "total" ? "font-semibold" : ""}`} style={{ paddingLeft: 8 + d.nivel * 14 }}>{d.etiqueta}</td>
                      <td className="px-2 py-1 border-b border-line-soft text-muted">{d.tipo}</td>
                      <td className="px-2 py-1 border-b border-line-soft">{d.origen === "aproximada" ? `≈ ${d.heredaDe}` : d.origen}</td>
                      <td className="px-2 py-1 border-b border-line-soft text-right tnum">{d.cuentas || "—"}</td>
                      <td className="px-2 py-1 border-b border-line-soft text-right tnum">{fmtCont(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {cargado === null ? (
            <button onClick={confirmar} disabled={pending || resumen.problemas.length > 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg brand-grad text-white text-sm font-medium disabled:opacity-60">
              {pending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {resumen.reemplaza ? `Confirmar y REEMPLAZAR el presupuesto ${anio}` : `Confirmar y cargar el presupuesto ${anio}`}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-pos font-medium">
              <CheckCircle2 size={16} /> Presupuesto {anio} cargado: {cargado} renglones. Ya está en Estados Financieros › Resultados y en el informe.
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="card p-4 flex items-start gap-2 border-neg/40 text-sm text-neg">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}

function Dato({ label, v, tono }: { label: string; v: string; tono?: "warn" }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`tnum font-semibold ${tono === "warn" ? "text-[#8A6A1D]" : ""}`}>{v}</div>
    </div>
  );
}
