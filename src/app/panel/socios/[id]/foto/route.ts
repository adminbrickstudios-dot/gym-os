// La foto del socio: privada. La base dice si quien la pide es del equipo
// (foto_socio); recién ahí el servidor la baja del bucket y la manda.
import { rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let ruta: string | null;
  try { ruta = await rpc<string | null>("foto_socio", { p_socio_id: id }); }
  catch (e) { return new Response((e as Error).message, { status: 403 }); }
  // Sin foto: 204 (la pantalla muestra las iniciales; no es un error).
  if (!ruta) return new Response(null, { status: 204 });
  const { data, error } = await clienteServicio().storage.from("fotos_socios").download(ruta);
  if (error || !data) return new Response(`No se pudo leer la foto: ${error?.message ?? "vacía"}`, { status: 502 });
  return new Response(await data.arrayBuffer(), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" } });
}
