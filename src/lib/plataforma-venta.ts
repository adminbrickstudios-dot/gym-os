import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { NOMBRE_PRODUCTO } from "@/lib/producto";

/** VD-26: los planes de BRIK que están activos (precio = dato del super admin, nunca del código). Si la base falla, la página sale sin precios y el error queda en el log. */
export type PlanBrik = { nombre: string; precio_mensual: number | string; max_socios?: number | null; max_sedes?: number | null; descripcion?: string | null; modulos?: string[] | null };
export async function planesBrikPublicos(): Promise<PlanBrik[]> {
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("planes_brik_publicos");
  if (error) { console.error("planes_brik_publicos:", error.message); return []; }
  return (data ?? []) as PlanBrik[];
}

/** VD-62: el WhatsApp de BRIK para "Pedí una demo" (lo carga el super admin; nunca un número en el código). */
/** Vuelta final: también la llave de la página de venta nueva (landing_venta_nueva; sin la clave, la de siempre). */
export async function contactoPlataforma(): Promise<{ whatsapp: string | null; mensaje_demo: string; landing_nueva: boolean }> {
  const respaldo = `Hola! Quiero ver una demo de ${NOMBRE_PRODUCTO}.`;
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("contacto_plataforma_publico");
  if (error) { console.error("contacto_plataforma_publico:", error.message); return { whatsapp: null, mensaje_demo: respaldo, landing_nueva: false }; }
  const d = data as { whatsapp: string | null; mensaje_demo: string; landing_nueva?: boolean } | null;
  return { whatsapp: d?.whatsapp ?? null, mensaje_demo: d?.mensaje_demo ?? respaldo, landing_nueva: d?.landing_nueva === true };
}
