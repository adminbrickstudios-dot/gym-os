// VD-44 · La foto de una persona del equipo. El bucket es privado: la base dice si quien la pide
// puede verla (el equipo siempre; el socio y quien mira la página, solo si el dueño lo prendió y la
// persona está tildada). Sin permiso o sin foto: 204 (la pantalla muestra las iniciales).
import { rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  let ruta: string | null;
  try { ruta = await rpc<string | null>("foto_equipo", { p_equipo_id: id }, { lectura: true }); }
  catch (e) { return new Response((e as Error).message, { status: 502 }); }
  if (!ruta) return new Response(null, { status: 204 });
  const { data, error } = await clienteServicio().storage.from("fotos_equipo").download(ruta);
  if (error || !data) return new Response(`No se pudo leer la foto: ${error?.message ?? "vacía"}`, { status: 502 });
  const tipo = ruta.endsWith(".png") ? "image/png" : ruta.endsWith(".jpg") ? "image/jpeg" : "image/webp";
  return new Response(await data.arrayBuffer(), { headers: { "content-type": tipo, "cache-control": "private, max-age=300" } });
}
