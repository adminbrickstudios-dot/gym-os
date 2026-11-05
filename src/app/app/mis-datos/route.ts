// SEG-6: el socio descarga lo que el gimnasio guarda de él (lo arma la base: mis_datos).
import { miSocio } from "@/lib/app/socio";
import { rpc } from "@/lib/panel/servidor";

export async function GET(req: Request) {
  const pedido = new URL(req.url).searchParams.get("socio");
  try {
    const { yo } = await miSocio(pedido);
    if (!yo.socio) return new Response("Elegí primero qué socio sos", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
    const datos = await rpc<unknown>("mis_datos", { p_socio_id: yo.socio.socio_id });
    return new Response(JSON.stringify(datos, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="mis-datos.json"', "cache-control": "no-store" },
    });
  } catch (e) {
    return new Response(`No se pudieron descargar tus datos: ${(e as Error).message}`, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
