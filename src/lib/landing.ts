import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import type { Agenda } from "@/lib/horarios";

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
  id?: string;
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
  | { tipo: "ubicacion"; titulo: string; contenido: Record<string, never> }
  | { tipo: "probar"; titulo: string; contenido: { texto?: string } };

export type Sede = { nombre: string; direccion: string | null; mapa_url: string | null; telefono: string | null };

/** VD-44: la gente del equipo que el dueño eligió mostrar (sin horarios de trabajo). */
export type EquipoPublico = { equipo_id: string; nombre: string; rol: string; tiene_foto: boolean; actividades: string[] };

export type LandingPublicada = {
  publicada: true;
  marca: Marca;
  portada: { titulo: string; bajada: string | null; foto_path: string | null; boton_texto: string };
  contacto: { whatsapp: string | null; mensaje_whatsapp: string; instagram: string | null; email: string | null };
  mostrar_precios: boolean;
  /** Se puede hacer socio desde la página (0032). */
  altas_online?: boolean;
  secciones: Seccion[];
  planes: PlanPublico[];
  sedes: Sede[];
  equipo_publico?: EquipoPublico[];
};

/** Sin publicar: la marca y el WhatsApp (0029), para el "Próximamente". */
export type LandingSinPublicar = { publicada: false; marca: Marca; contacto?: { whatsapp: string | null; mensaje_whatsapp: string | null } };
export type Landing = LandingPublicada | LandingSinPublicar;

/** Trae la landing del host. null = el host no es de ningún gimnasio. Error = no se pudo preguntar. */
// VD-47: la marca, los planes, las secciones y los horarios casi no cambian: se guardan 60 s por direccion y se
// invalidan al guardar (etiqueta "landing", ver rpc() en lib/panel/servidor.ts). Es informacion publica, igual
// para todos: nunca permisos, plata ni socios.
const landingEnCache = unstable_cache(async (host: string): Promise<Landing | null> => {
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("landing_publica", { p_host: host });
  if (error) throw new Error(`No se pudo leer la página del gimnasio: ${error.message}`);
  return (data as Landing | null) ?? null;
}, ["landing_publica"], { tags: ["landing"], revalidate: 60 });

export const traerLanding = (host: string): Promise<Landing | null> => landingEnCache(host);

/** Horarios, "abierto ahora" y próximos cierres del gimnasio del host (agenda_publica, sin sesión). */
export async function traerAgenda(host: string): Promise<Agenda | null> {
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("agenda_publica", { p_host: host });
  if (error) throw new Error(`No se pudieron leer los horarios del gimnasio: ${error.message}`);
  return (data as Agenda | null) ?? null;
}

// urlMarca vive aparte para poder usarla también en el navegador.
export { urlMarca } from "@/lib/url-marca";

/** COM-8: un evento suelto (seminario, clase especial) tal como se muestra afuera. */
export type EventoPublico = { evento_id: string; nombre: string; inicio: string; precio: number; descripcion: string | null; cupo: number; para: "todos" | "socios"; quedan: number; zona: string };

/** Los eventos que vienen del gimnasio del host (solo con la página publicada). */
export async function traerEventos(host: string): Promise<EventoPublico[]> {
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("eventos_publicos", { p_host: host });
  if (error) throw new Error(`No se pudieron leer los eventos del gimnasio: ${error.message}`);
  return (data as EventoPublico[]) ?? [];
}

/** COM-11: los IDs de medición que cargó el dueño (solo con la página publicada; la base los valida). */
export type Medicion = { pixel_meta?: string | null; google_analytics?: string | null };

const medicionEnCache = unstable_cache(async (host: string): Promise<Medicion> => {
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("medicion_publica", { p_host: host });
  if (error) throw new Error(`No se pudo leer la medición de la página: ${error.message}`);
  return (data as Medicion) ?? {};
}, ["medicion_publica"], { tags: ["landing"], revalidate: 60 });

export const traerMedicion = (host: string): Promise<Medicion> => medicionEnCache(host);
