import { ensureLoaded, latest, periodos } from "@/lib/data";
import IngestaClient from "@/components/IngestaClient";

export const dynamic = "force-dynamic";

/* La página sugiere como destino el MES SIGUIENTE al último cargado
   (el flujo real: cada mes se sube el corte nuevo). */
export default async function IngestaPage() {
  await ensureLoaded();
  const ult = periodos.length ? latest() : { anio: new Date().getFullYear(), mes: new Date().getMonth() };
  const sugerido = ult.mes === 12 ? { anio: ult.anio + 1, mes: 1 } : { anio: ult.anio, mes: ult.mes + 1 };
  const anios: number[] = [];
  for (let a = 2023; a <= new Date().getFullYear() + 1; a++) anios.push(a);
  return <IngestaClient sugerido={sugerido} anios={anios} />;
}
