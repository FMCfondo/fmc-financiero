import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { ensureLoaded } from "@/lib/data";
import { plantillaPresupuesto } from "@/lib/plantilla-presupuesto";

export const dynamic = "force-dynamic";

/** GET /api/presupuesto/plantilla — la hoja «PPTO <año siguiente>» lista para llenar y
 *  cargar. Solo del administrador, como todo el módulo de Presupuesto. */
export async function GET() {
  // La cookie la mira el proxy; que la sesión valga y sea de administrador se mira aquí.
  const s = await obtenerSesion();
  if (!s || s.usuario.rol !== "admin" || s.usuario.debeCambiarClave)
    return NextResponse.json({ error: "Solo el administrador." }, { status: s ? 403 : 401 });

  await ensureLoaded();
  const p = await plantillaPresupuesto();
  if (!p) return NextResponse.json({ error: "No hay ningún presupuesto cargado del que partir." }, { status: 404 });
  return new NextResponse(new Uint8Array(p.archivo as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${p.nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
