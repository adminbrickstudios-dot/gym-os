import { NextResponse } from "next/server";
import { ultimasEntradas } from "../ventana-acciones";

// Las últimas entradas de la barra fija de la Entrada. Se leen con un GET común y no con una acción del servidor:
// la barra las pide apenas abre cada pantalla y cada 20 s, y una acción en ese momento se cruzaba con la que
// mandaba la persona (la acción de la persona guardaba, pero la pantalla no se refrescaba).
// Los permisos los decide la misma función de siempre (contextoPanel + la base): sin sesión o sin permiso, error.
export const dynamic = "force-dynamic";

export async function GET(pedido: Request) {
  const sede = new URL(pedido.url).searchParams.get("sede") ?? "";
  const r = await ultimasEntradas(sede);
  return NextResponse.json(r, { status: r.error ? 403 : 200, headers: { "Cache-Control": "no-store" } });
}
