import "server-only";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";

/**
 * Para robots.txt y sitemap.xml (fuera del middleware): el host pedido, su
 * origen, y si es la página publicada de un gimnasio (con o sin altas online).
 */
export async function hostPublico(): Promise<{ origen: string; publicada: boolean; altas: boolean; esGimnasio: boolean }> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  const origen = `${h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")}://${host}`;
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("landing_publica", { p_host: host.replace(/:\d+$/, "") });
  if (error) throw new Error(`No se pudo leer la página: ${error.message}`);
  const l = data as { publicada: boolean; altas_online?: boolean } | null;
  return { origen, esGimnasio: !!l, publicada: !!l?.publicada, altas: !!l?.altas_online };
}
