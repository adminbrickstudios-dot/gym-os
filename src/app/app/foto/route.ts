// FA-16: la foto del socio, para él mismo. La base dice si el socio es suyo (foto_propia); recién ahí el servidor la baja del bucket privado.
import { rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";

export async function GET(pedido: Request) {
  const socio = new URL(pedido.url).searchParams.get("socio") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(socio)) return new Response("Falta el socio.", { status: 400 });
  let ruta: string | null;
  try { ruta = await rpc<string | null>("foto_propia", { p_socio_id: socio }); }
  catch (e) { return new Response((e as Error).message, { status: 403 }); }
  if (!ruta) return new Response(null, { status: 204 });   // sin foto: la pantalla muestra las iniciales
  const { data, error } = await clienteServicio().storage.from("fotos_socios").download(ruta);
  if (error || !data) return new Response(`No se pudo leer la foto: ${error?.message ?? "vacía"}`, { status: 502 });
  return new Response(await data.arrayBuffer(), { headers: { "content-type": "image/jpeg", "cache-control": "private, no-cache" } });
}
