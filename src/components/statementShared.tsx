"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

/* Primitivas compartidas del sistema de estados financieros: estado expandido
   (persistente por vista) y la celda de concepto con guías de indentación y
   chevron. Las usan StatementMatrix y AnalisisMatrix para verse y comportarse
   idéntico. Estilos en globals.css → `.stmt`. */

export const MAX_SANGRIA = 4;

type NodoBase = { codigo: string; depth: number; hijos: NodoBase[] };
export type Ctx = { isOpen: (c: string) => boolean; toggle: (c: string) => void; setAll: (o: boolean) => void; allExpanded: boolean; hasGroups: boolean };
const ExpandCtx = createContext<Ctx | null>(null);
export const useExpandCtx = () => useContext(ExpandCtx)!;

export function useExpand<T extends NodoBase>(arboles: T[][], persistKey?: string): Ctx {
  const { groups, defaults } = useMemo(() => {
    const groups: string[] = [];
    const defaults: string[] = [];
    const walk = (n: NodoBase) => {
      if (n.hijos.length) { groups.push(n.codigo); if (n.depth <= 0) defaults.push(n.codigo); n.hijos.forEach(walk); }
    };
    arboles.forEach((a) => a.forEach(walk));
    return { groups, defaults };
  }, [arboles]);

  const [open, setOpen] = useState<Set<string>>(() => new Set(defaults));
  const key = persistKey ? `stmt:${persistKey}` : null;

  useEffect(() => {
    if (!key) return;
    try { const raw = localStorage.getItem(key); if (raw) setOpen(new Set(JSON.parse(raw) as string[])); } catch { /* noop */ }
  }, [key]);

  const persist = (s: Set<string>) => { if (key) try { localStorage.setItem(key, JSON.stringify([...s])); } catch { /* noop */ } };
  const toggle = (c: string) => setOpen((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); persist(n); return n; });
  const setAll = (o: boolean) => { const n = new Set(o ? groups : []); setOpen(n); persist(n); };
  return { isOpen: (c) => open.has(c), toggle, setAll, allExpanded: groups.length > 0 && open.size >= groups.length, hasGroups: groups.length > 0 };
}

export function ExpandProvider({ ctx, children }: { ctx: Ctx; children: React.ReactNode }) {
  return <ExpandCtx.Provider value={ctx}>{children}</ExpandCtx.Provider>;
}

/* Celda de concepto: guías de indentación + chevron + código + nombre. */
export function Concepto({ codigo, nombre, depth, esGrupo, has, open, onToggle }: {
  codigo: string; nombre: string; depth: number; esGrupo: boolean; has: boolean; open: boolean; onToggle: () => void;
}) {
  const d = Math.min(depth, MAX_SANGRIA);
  return (
    <button
      onClick={() => has && onToggle()}
      className={`indent text-left w-full min-w-0 ${has ? "cursor-pointer" : "cursor-default"}`}
      aria-expanded={has ? open : undefined}
    >
      {Array.from({ length: d }).map((_, i) => <span key={i} className={`guide ${i === d - 1 ? "line" : ""}`} />)}
      {has ? <ChevronRight size={13} className={`chev ${open ? "open" : ""}`} /> : <span className="w-[13px] shrink-0" />}
      <span className="code w-[64px] shrink-0 pl-1">{codigo}</span>
      <span className={`truncate ${esGrupo ? "text-fg font-medium" : "text-muted"}`}>{nombre}</span>
    </button>
  );
}

/* Botón Expandir/Contraer todo, consistente en todas las vistas.
   No se muestra en estados planos (sin grupos que expandir). */
export function ExpandToggle({ ctx }: { ctx: Ctx }) {
  if (!ctx.hasGroups) return null;
  return (
    <button
      onClick={() => ctx.setAll(!ctx.allExpanded)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-muted hover:text-fg hover:bg-card2 transition-colors"
    >
      {ctx.allExpanded ? "Contraer todo" : "Expandir todo"}
    </button>
  );
}
