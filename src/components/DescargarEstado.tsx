import { Download } from "lucide-react";

/** Descarga un estado financiero en Excel, con todos los meses y el detalle agrupado. */
export default function DescargarEstado({ estado }: { estado: "er" | "esf" }) {
  return (
    <a href={`/api/estados/excel?estado=${estado}`} download title="Todos los meses, con el detalle agrupado"
      className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-medium text-fg hover:bg-card2">
      <Download size={14} /> Descargar Excel
    </a>
  );
}
