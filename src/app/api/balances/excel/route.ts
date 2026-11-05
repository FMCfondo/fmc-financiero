import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { ensureLoaded } from "@/lib/data";
import { balancesExcel } from "@/lib/balances-excel";

export const dynamic = "force-dynamic";

/** GET /api/balances/excel?modo=mes|acumulado — descarga los balances procesados. Como la
 *  pantalla Balances, es solo del administrador. */
export async function GET(req: NextRequest) {
  // La cookie la mira el proxy; que la sesión valga y sea de administrador se mira aquí.
  const s = await obtenerSesion();
  if (!s || s.usuario.rol !== "admin" || s.usuario.debeCambiarClave)
    return NextResponse.json({ error: "Solo el administrador." }, { status: s ? 403 : 401 });

  await ensureLoaded();
  const modo = req.nextUrl.searchParams.get("modo") === "acumulado" ? "acumulado" : "mes";
  const { archivo, nombre } = await balancesExcel(modo);
  return new NextResponse(new Uint8Array(archivo as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
