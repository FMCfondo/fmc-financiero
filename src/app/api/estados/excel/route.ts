import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { ensureLoaded } from "@/lib/data";
import { estadoExcel } from "@/lib/estados-excel";

export const dynamic = "force-dynamic";

/** GET /api/estados/excel?estado=er|esf — descarga el estado con su detalle agrupado.
 *  Solo del administrador: trae toda la historia, no solo lo que la Junta tiene abierto. */
export async function GET(req: NextRequest) {
  // La cookie la mira el proxy; que la sesión valga y sea de administrador se mira aquí.
  const s = await obtenerSesion();
  if (!s || s.usuario.rol !== "admin" || s.usuario.debeCambiarClave)
    return NextResponse.json({ error: "Solo el administrador." }, { status: s ? 403 : 401 });

  const estado = req.nextUrl.searchParams.get("estado");
  if (estado !== "er" && estado !== "esf") return NextResponse.json({ error: "Estado no válido." }, { status: 400 });

  await ensureLoaded();
  const { archivo, nombre } = await estadoExcel(estado);
  return new NextResponse(new Uint8Array(archivo as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
