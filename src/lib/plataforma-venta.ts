import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";

/** VD-26: los planes de BRIK que están activos (precio = dato del super admin, nunca del código). Si la base falla, la página sale sin precios y el error queda en el log. */
export async function planesBrikPublicos(): Promise<{ nombre: string; precio_mensual: number | string }[]> {
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("planes_brik_publicos");
  if (error) { console.error("planes_brik_publicos:", error.message); return []; }
  return (data ?? []) as { nombre: string; precio_mensual: number | string }[];
}

/** VD-62: el WhatsApp de BRIK para "Pedí una demo" (lo carga el super admin; nunca un número en el código). */
export async function contactoPlataforma(): Promise<{ whatsapp: string | null; mensaje_demo: string }> {
  const respaldo = "Hola! Quiero ver una demo de Base.";
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("contacto_plataforma_publico");
  if (error) { console.error("contacto_plataforma_publico:", error.message); return { whatsapp: null, mensaje_demo: respaldo }; }
  const d = data as { whatsapp: string | null; mensaje_demo: string } | null;
  return { whatsapp: d?.whatsapp ?? null, mensaje_demo: d?.mensaje_demo ?? respaldo };
}
