"use client";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Wand2 } from "lucide-react";
import { fmtNum } from "@/lib/format";

type Rol = "codigo" | "nombre" | "saldo" | "";

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

export default function IngestaPage() {
  const [name, setName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [map, setMap] = useState<{ codigo: number; nombre: number; saldo: number }>({ codigo: -1, nombre: -1, saldo: -1 });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
    const hdr = (aoa[0] ?? []).map((h, i) => String(h || `Columna ${i + 1}`));
    const data = aoa.slice(1).filter((r) => r.some((c) => c !== null && c !== undefined && c !== ""));
    setHeaders(hdr);
    setRows(data);
    setMap(autodetect(hdr, data));
  }

  const preview = useMemo(() => {
    if (map.codigo < 0) return [];
    return rows.slice(0, 12).map((r) => ({
      codigo: String(r[map.codigo] ?? "").trim(),
      nombre: String(r[map.nombre] ?? ""),
      saldo: toNum(r[map.saldo]),
    }));
  }, [rows, map]);

  const report = useMemo(() => {
    if (map.codigo < 0 || !rows.length) return null;
    let validos = 0, noPuc = 0, sinSaldo = 0, suma = 0;
    const vistos = new Set<string>();
    let dup = 0;
    for (const r of rows) {
      const cod = String(r[map.codigo] ?? "").trim();
      const sal = toNum(r[map.saldo]);
      if (!cod) continue;
      if (isPUC(cod)) validos++; else noPuc++;
      if (sal === null) sinSaldo++; else suma += sal;
      if (vistos.has(cod)) dup++; else vistos.add(cod);
    }
    return { total: rows.length, validos, noPuc, sinSaldo, suma, dup, unicos: vistos.size };
  }, [rows, map]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cargar Balance de Prueba</h1>
        <p className="text-sm text-muted mt-0.5">Sube el archivo de Siigo — la herramienta reconoce las columnas automáticamente.</p>
      </div>

      <label className="card p-8 flex flex-col items-center justify-center gap-3 border-dashed cursor-pointer hover:border-accent/50 transition-colors text-center">
        <div className="h-12 w-12 rounded-xl bg-accent/10 grid place-items-center"><Upload className="text-accent2" /></div>
        <div className="text-sm">
          <span className="text-accent2 font-medium">Selecciona un archivo</span>
          <span className="text-muted"> o arrástralo aquí</span>
        </div>
        <div className="text-xs text-faint">Excel (.xlsx) o CSV — código PUC, nombre y saldo final</div>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
      </label>

      {name && (
        <div className="card p-4 flex items-center gap-3">
          <FileSpreadsheet className="text-pos" size={20} />
          <span className="text-sm">{name}</span>
          <span className="text-xs text-faint ml-auto">{rows.length} filas leídas</span>
        </div>
      )}

      {headers.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wand2 size={16} className="text-accent2" />
            <h2 className="font-medium">Columnas detectadas</h2>
            <span className="text-xs text-faint">— revisa y corrige si es necesario</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["codigo", "nombre", "saldo"] as const).map((rol) => (
              <div key={rol}>
                <label className="text-xs text-muted capitalize">{rol === "codigo" ? "Código PUC" : rol === "saldo" ? "Saldo final" : "Nombre"}</label>
                <select
                  value={map[rol]}
                  onChange={(e) => setMap({ ...map, [rol]: parseInt(e.target.value) })}
                  className="mt-1 w-full bg-card2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value={-1}>— sin asignar —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i} className="bg-panel">{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Chip ok label="Cuentas válidas" value={fmtNum(report.validos)} />
          <Chip ok={report.noPuc === 0} label="Códigos no PUC" value={fmtNum(report.noPuc)} />
          <Chip ok={report.dup === 0} label="Duplicados" value={fmtNum(report.dup)} />
          <Chip ok={report.sinSaldo === 0} label="Sin saldo" value={fmtNum(report.sinSaldo)} />
        </div>
      )}

      {preview.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-sm font-medium">Vista previa</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-faint border-b border-line">
                  <th className="text-left font-normal px-4 py-2">Código</th>
                  <th className="text-left font-normal px-4 py-2">Nombre</th>
                  <th className="text-right font-normal px-4 py-2">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-b border-line-soft">
                    <td className="px-4 py-1.5 tnum text-faint">{r.codigo}</td>
                    <td className="px-4 py-1.5 text-muted">{r.nombre}</td>
                    <td className="px-4 py-1.5 text-right tnum">{r.saldo === null ? "—" : fmtNum(r.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-line flex items-center justify-between">
            <p className="text-xs text-faint flex items-center gap-1.5">
              <AlertTriangle size={13} /> En la versión conectada a Neon, este paso guardará el período con validación y trazabilidad.
            </p>
            <button className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium opacity-60 cursor-not-allowed" disabled>
              Cargar período
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className={`card p-4 ${ok ? "" : "border-warn/40"}`}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 size={15} className="text-pos" /> : <AlertTriangle size={15} className="text-warn" />}
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className="text-lg font-semibold tnum mt-1">{value}</div>
    </div>
  );
}
