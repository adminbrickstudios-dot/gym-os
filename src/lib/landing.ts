import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";

// Forma de lo que devuelve public.landing_publica (migración 0008).
export type Marca = {
  nombre: string;
  slug: string;
  logo_path: string | null;
  favicon_path: string | null;
  color_acento: string;
  color_fondo: string;
};

export type PlanPublico = {
  nombre: string;
  tipo: "membresia" | "pase_diario" | "pack";
  descripcion: string | null;
  duracion_meses?: number | null;
  cantidad_clases?: number | null;
  hora_desde?: string | null;
  hora_hasta?: string | null;
  max_ingresos_semana?: number | null;
  precio?: number | string | null;
  variantes?: { monto: number | string; medio_pago: string | null; pago_hasta_dia: number | null }[];
};

export type Seccion =
  | { tipo: "sobre_nosotros"; titulo: string; contenido: { texto?: string } }
  | { tipo: "actividades"; titulo: string; contenido: { items?: { emoji?: string; nombre: string; descripcion?: string }[] } }
  | { tipo: "planes"; titulo: string; contenido: Record<string, never> }
  | { tipo: "horarios"; titulo: string; contenido: { filas?: { dias: string; horas: string }[] } }
  | { tipo: "galeria"; titulo: string; contenido: { fotos?: string[] } }
  | { tipo: "equipo"; titulo: string; contenido: { personas?: { nombre: string; rol?: string; foto?: string }[] } }
  | { tipo: "preguntas"; titulo: string; contenido: { items?: { pregunta: string; respuesta: string }[] } }
  | { tipo: "ubicacion"; titulo: string; contenido: Record<string, never> };

export type Sede = { nombre: string; direccion: string | null; mapa_url: string | null; telefono: string | null };

export type LandingPublicada = {
  publicada: true;
  marca: Marca;
  portada: { titulo: string; bajada: string | null; foto_path: string | null; boton_texto: string };
  contacto: { whatsapp: string | null; mensaje_whatsapp: string; instagram: string | null; email: string | null };
  mostrar_precios: boolean;
  secciones: Seccion[];
  planes: PlanPublico[];
  sedes: Sede[];
};

export type Landing = LandingPublicada | { publicada: false; marca: Marca };

/** Trae la landing del host. null = el host no es de ningún gimnasio. Error = no se pudo preguntar. */
export async function traerLanding(host: string): Promise<Landing | null> {
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("landing_publica", { p_host: host });
  if (error) throw new Error(`No se pudo leer la página del gimnasio: ${error.message}`);
  return (data as Landing | null) ?? null;
}

// urlMarca vive aparte para poder usarla también en el navegador.
export { urlMarca } from "@/lib/url-marca";
