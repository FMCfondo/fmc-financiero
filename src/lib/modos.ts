/* Los dos modos de la aplicación (client-safe, sin acceso a datos).
   No hay usuarios ni contraseñas: es un conmutador de vista.

   · REUNIONES — lo que se presenta a la Junta, los accionistas y la Gerencia.
     Nada operativo: ni cargue, ni validaciones, ni mapeos, ni cuentas crudas.
   · OPERACIÓN — el trabajo del analista: cargar el balance, revisar el mes,
     analizar en profundidad y mantener la configuración.

   El Panel vive en los dos, porque es el resumen del que arranca cualquiera
   de las dos conversaciones. */
export type ModoApp = "reuniones" | "operacion";
export const MODO_DEFAULT: ModoApp = "reuniones";
export const CLAVE_MODO = "fmc:modo";

export const MODOS: { id: ModoApp; label: string; desc: string }[] = [
  { id: "reuniones", label: "Reuniones", desc: "Junta Directiva · Accionistas · Gerencia" },
  { id: "operacion", label: "Operación", desc: "Análisis y ciclo mensual" },
];

/** `modos` vacío = visible en ambos.
 *  `match` admite varias rutas porque un módulo puede tener pestañas: Estados
 *  Financieros son cuatro rutas hermanas, y con un solo prefijo `/estados/` se
 *  encendería también Análisis, que cuelga del mismo sitio. */
export type ItemNav = { href: string; match: string | string[]; label: string; icono: string; modos?: ModoApp[] };

export const NAV: ItemNav[] = [
  { href: "/panel", match: "/panel", label: "Panel Ejecutivo", icono: "Gauge" },
  /* Una sola puerta al módulo: las cuatro pestañas se ven desde dentro. Antes había
     además una entrada suelta a «Situación Financiera», que llevaba a la misma sección
     y hacía saltar el resaltado entre dos entradas al cambiar de pestaña — parecían
     módulos distintos sin serlo. */
  { href: "/estados/resultados", label: "Estados Financieros", icono: "Landmark",
    match: ["/estados/resultados", "/estados/situacion", "/estados/flujo",
            "/estados/patrimonio", "/estados/inversiones"] },
  { href: "/portafolio", match: "/portafolio", label: "Portafolio", icono: "Wallet" },
  /* En LOS DOS modos, igual que el Panel, y por la misma razón: es donde arrancan las
     dos conversaciones. En Reuniones es el documento que se le envía a la Junta; en
     Operación es donde el analista escribe las notas, sobre la propia hoja.
     Estuvo un rato solo en Reuniones y eso dejó el editor INALCANZABLE: para verlo
     había que estar ya en /informe y cambiar de modo sin moverse, porque en Operación
     la entrada del menú desaparecía. Quien lo edita tiene que poder llegar. */
  { href: "/informe", match: "/informe", label: "Informe de Junta", icono: "FileText" },
  { href: "/estados/dashboard", match: "/estados/dashboard", label: "Análisis", icono: "LineChart", modos: ["operacion"] },
  { href: "/balances", match: "/balances", label: "Balances / Resumen", icono: "Table2", modos: ["operacion"] },
  { href: "/ingesta", match: "/ingesta", label: "Cargar Balance", icono: "Upload", modos: ["operacion"] },
  { href: "/revision", match: "/revision", label: "Revisión del cierre", icono: "ClipboardCheck", modos: ["operacion"] },
  { href: "/impuesto", match: "/impuesto", label: "Provisión de Impuesto", icono: "Percent", modos: ["operacion"] },
];

export const visibleEn = (item: ItemNav, modo: ModoApp) => !item.modos || item.modos.includes(modo);

/* El modo se recuerda en el navegador de quien mira, pero DENTRO de la misma pestaña
   nadie se entera de que cambió: `storage` solo avisa a las demás. Por eso quien lo
   cambia lo anuncia, y cualquier componente que dependa del modo puede escucharlo.
   Lo necesita el informe, que muestra el editor de notas solo en Operación. */
export const EVENTO_MODO = "fmc:modo-cambiado";

export function leerModo(): ModoApp {
  try {
    const g = localStorage.getItem(CLAVE_MODO);
    if (g === "reuniones" || g === "operacion") return g;
  } catch { /* noop */ }
  return MODO_DEFAULT;
}

export function escribirModo(m: ModoApp): void {
  try { localStorage.setItem(CLAVE_MODO, m); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent<ModoApp>(EVENTO_MODO, { detail: m }));
}
