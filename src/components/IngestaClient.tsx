"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { cargarPeriodo, type ResumenCarga } from "@/app/ingesta/actions";
import { fmtNum, fmtCont } from "@/lib/format";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Wand2, DatabaseZap, Loader2 } from "lucide-react";

/* Carga del Balance de Prueba, en dos pasos:
   1) el archivo se lee y valida EN el navegador (columnas auto-detectadas) y
      el servidor devuelve el resumen (ecuación contable, cuentas nuevas,
      si reemplaza un período ya cargado) SIN escribir nada;
   2) el usuario confirma y ahí sí se escribe en Neon (RN0 + RN1), se refresca
      toda la app y el período nuevo aparece en el selector. */

function toNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const s = v.replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.\-]/g, "");
    if (s === "" || s === "-") return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  return null;
}
const isPUC = (v: unknown) => /^\d{1,10}$/.test(String(v ?? "").trim());

function autodetect(headers: string[], rows: unknown[][]): { codigo: number; nombre: number; saldo: number } {
  const sample = rows.slice(0, 60);
  const score = headers.map((h, i) => {
    const vals = sample.map((r) => r[i]).filter((v) => v !== null && v !== undefined && v !== "");
    const puc = vals.filter(isPUC).length;
    const num = vals.filter((v) => toNum(v) !== null && !isPUC(v)).length;
    const txt = vals.filter((v) => typeof v === "string" && toNum(v) === null).length;
    const hl = String(h ?? "").toLowerCase();
    return {
      i, n: vals.length || 1, puc, num, txt,
      hCod: /c[oó]digo|cuenta|puc/.test(hl), hNom: /nombre|descrip/.test(hl), hSal: /saldo|final|valor|monto|debe|haber/.test(hl),
    };
  });
  const pick = (fn: (s: (typeof score)[number]) => number, used: number[]) =>
    score.filter((s) => !used.includes(s.i)).sort((a, b) => fn(b) - fn(a))[0]?.i ?? -1;
  const codigo = pick((s) => s.puc / s.n + (s.hCod ? 1 : 0), []);
  const saldo = pick((s) => s.num / s.n + (s.hSal ? 1 : 0), [codigo]);
  const nombre = pick((s) => s.txt / s.n + (s.hNom ? 1 : 0), [codigo, saldo]);
  return { codigo, nombre, saldo };
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function IngestaClient({ sugerido, anios }: { sugerido: { anio: number; mes: number }; anios: number[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [map, setMap] = useState<{ codigo: number; nombre: number; saldo: number }>({ codigo: -1, nombre: -1, saldo: -1 });
  const [anio, setAnio] = useState(sugerido.anio);
  const [mes, setMes] = useState(sugerido.mes);
  const [resumen, setResumen] = useState<ResumenCarga | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setName(file.name); setResumen(null); setError(null); setCargado(false);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
    const hdr = (aoa[0] ?? []).map((h, i) => String(h || `Columna ${i + 1}`));
    const data = aoa.slice(1).filter((r) => r.some((c) => c !== null && c !== undefined && c !== ""));
    setHeaders(hdr); setRows(data); setMap(autodetect(hdr, data));
  }

  const filas = useMemo(() => {
    if (map.codigo < 0) return [];
    return rows
      .map((r) => ({
        codigo: String(r[map.codigo] ?? "").trim(),
        nombre: String(r[map.nombre] ?? "").trim(),
        saldo: toNum(r[map.saldo]) ?? 0,
      }))
      .filter((f) => isPUC(f.codigo));
  }, [rows, map]);

  const report = useMemo(() => {
    if (map.codigo < 0 || !rows.length) return null;
    let validos = 0, noPuc = 0, sinSaldo = 0;
    const vistos = new Set<string>();
    let dup = 0;
    for (const r of rows) {
      const cod = String(r[map.codigo] ?? "").trim();
      if (!cod) continue;
      if (isPUC(cod)) validos++; else noPuc++;
      if (toNum(r[map.saldo]) === null) sinSaldo++;
      if (vistos.has(cod)) dup++; else vistos.add(cod);
    }
    return { validos, noPuc, sinSaldo, dup };
  }, [rows, map]);

  const validar = () =>
    start(async () => {
      setError(null); setResumen(null); setCargado(false);
      const r = await cargarPeriodo({ anio, mes, archivo: name, filas, confirmar: false });
      if (r.resumen) setResumen(r.resumen);
      if (!r.ok) setError(r.error ?? "Error de validación.");
    });

  const confirmar = () =>
    start(async () => {
      setError(null);
      const r = await cargarPeriodo({ anio, mes, archivo: name, filas, confirmar: true });
      if (!r.ok) { setError(r.error ?? "Error al cargar."); return; }
      setCargado(true);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cargar Balance de Prueba</h1>
        <p className="text-sm text-muted mt-0.5">Sube el archivo de Siigo (acumulado enero → mes). La herramienta reconoce las columnas y valida antes de guardar.</p>
      </div>

      {/* 1. Archivo */}
      <label className="card p-8 flex flex-col items-center justify-center gap-3 border-dashed cursor-pointer hover:border-accent/50 transition-colors text-center">
        <div className="h-12 w-12 rounded-xl bg-accent/10 grid place-items-center"><Upload className="text-accent2" /></div>
        <div className="text-sm">
          <span className="text-accent2 font-medium">Selecciona un archivo</span>
          <span className="text-muted"> o arrástralo aquí</span>
        </div>
        <div className="text-xs text-muted">Excel (.xlsx) o CSV — código PUC, nombre y saldo acumulado</div>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
      </label>

      {name && (
        <div className="card p-4 flex items-center gap-3">
          <FileSpreadsheet className="text-pos" size={20} />
          <span className="text-sm">{name}</span>
          <span className="text-xs text-muted ml-auto">{fmtNum(filas.length)} cuentas válidas de {fmtNum(rows.length)} filas</span>
        </div>
      )}

      {/* 2. Columnas + período */}
      {headers.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wand2 size={16} className="text-accent2" />
            <h2 className="font-medium">Columnas detectadas y período de destino</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {(["codigo", "nombre", "saldo"] as const).map((rol) => (
              <div key={rol}>
                <label className="text-xs text-muted">{rol === "codigo" ? "Código PUC" : rol === "saldo" ? "Saldo acumulado" : "Nombre"}</label>
                <select value={map[rol]} onChange={(e) => setMap({ ...map, [rol]: parseInt(e.target.value) })}
                  className="mt-1 w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent">
                  <option value={-1}>— sin asignar —</option>
                  {headers.map((h, i) => <option key={i} value={i} className="bg-panel">{h}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="text-xs text-muted">Mes del corte</label>
              <select value={mes} onChange={(e) => { setMes(parseInt(e.target.value)); setResumen(null); setCargado(false); }}
                className="mt-1 w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent">
                {MESES.map((m, i) => <option key={m} value={i + 1} className="bg-panel">{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Año</label>
              <select value={anio} onChange={(e) => { setAnio(parseInt(e.target.value)); setResumen(null); setCargado(false); }}
                className="mt-1 w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent">
                {anios.map((a) => <option key={a} value={a} className="bg-panel">{a}</option>)}
              </select>
            </div>
          </div>
          {report && (
            <div className="flex gap-4 flex-wrap text-xs">
              <Mini ok label={`${fmtNum(report.validos)} cuentas válidas`} />
              <Mini ok={report.noPuc === 0} label={`${fmtNum(report.noPuc)} códigos no PUC (se omiten)`} />
              <Mini ok={report.dup === 0} label={`${fmtNum(report.dup)} duplicados`} />
              <Mini ok={report.sinSaldo === 0} label={`${fmtNum(report.sinSaldo)} sin saldo (se cargan en 0)`} />
            </div>
          )}
          <button onClick={validar} disabled={pending || !filas.length}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg brand-grad text-white text-sm font-medium disabled:opacity-60">
            {pending ? <Loader2 size={15} className="animate-spin" /> : <DatabaseZap size={15} />}
            Validar contra la base
          </button>
        </div>
      )}

      {/* 3. Resumen de validación + confirmación */}
      {resumen && (
        <div className={`card p-5 space-y-3 ${Math.abs(resumen.difEcuacion) < 1 ? "border-pos/40" : "border-gold/50"}`}>
          <h2 className="font-medium">Validación — {MESES[mes - 1]} {anio}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <Dato label="Total activos" v={resumen.totalActivo} />
            <Dato label="Total pasivos" v={resumen.totalPasivo} />
            <Dato label="Patrimonio" v={resumen.totalPatrim} />
            <Dato label="Utilidad acumulada" v={resumen.utilidadAcum} />
          </div>
          <div className={`flex items-center gap-2 text-sm ${Math.abs(resumen.difEcuacion) < 1 ? "text-pos" : "text-[#8A6A1D]"}`}>
            {Math.abs(resumen.difEcuacion) < 1 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {Math.abs(resumen.difEcuacion) < 1
              ? "La ecuación contable cuadra (A = P + K + utilidad)."
              : `La ecuación NO cuadra: diferencia de ${fmtCont(resumen.difEcuacion)}. Puedes cargar igual, pero revisa el archivo (mismo caso del descuadre de DIC2025).`}
          </div>
          {resumen.reemplaza && (
            <p className="flex items-center gap-2 text-sm text-[#8A6A1D]"><AlertTriangle size={15} /> Este período YA está cargado: al confirmar se reemplaza por completo.</p>
          )}
          {resumen.cuentasNuevas.length > 0 && (
            <p className="text-xs text-muted">
              {resumen.cuentasNuevas.length} cuentas nuevas se crearán en el plan: {resumen.cuentasNuevas.slice(0, 8).join(", ")}{resumen.cuentasNuevas.length > 8 ? "…" : ""}
            </p>
          )}
          {!cargado ? (
            <button onClick={confirmar} disabled={pending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg brand-grad text-white text-sm font-medium disabled:opacity-60">
              {pending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {resumen.reemplaza ? "Confirmar y REEMPLAZAR el período" : "Confirmar y cargar el período"}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-pos font-medium">
              <CheckCircle2 size={16} /> Período {MESES[mes - 1]} {anio} cargado. Ya está disponible en el selector y en todos los estados.
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

function Mini({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${ok ? "text-muted" : "text-[#8A6A1D] font-medium"}`}>
      {ok ? <CheckCircle2 size={13} className="text-pos" /> : <AlertTriangle size={13} />} {label}
    </span>
  );
}
function Dato({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="tnum tabular-nums font-semibold">{fmtCont(v, true)}</div>
    </div>
  );
}
