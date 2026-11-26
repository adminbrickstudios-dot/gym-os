import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { propsMarca } from "@/lib/marca";
import { linkWhatsapp } from "@/lib/landing-textos";
import { traerLanding, urlMarca, type Marca, type PlanPublico } from "@/lib/landing";
import { FormAlta } from "./FormAlta";
import type { Transferencia } from "./acciones";
import { Icono } from "@/components/ui/Icono";
import { raizDelGimnasio } from "@/lib/app/raiz-gimnasio";
import { urlDeHost } from "@/lib/urls";
import { NOMBRE_PRODUCTO } from "@/lib/producto";

export type DatosAlta = {
  abierta: boolean; con_plan?: boolean; marca: Marca; contacto: { whatsapp: string | null; mensaje_whatsapp?: string };
  mostrar_precios?: boolean; planes?: PlanPublico[]; plan_sugerido?: string | null; reglamento?: { version: number; texto: string } | null; transferencia?: Transferencia | null;
};

/**
 * Lo que necesita la pantalla de alta. Si la base falla (un corte, un tiempo agotado) se reintenta una vez; si sigue fallando NO se tira el error:
 * en producción Next lo esconde como "React error 441" y la persona que escanea el QR se queda sin saber qué pasó. Se devuelve el texto
 * y la página lo muestra (con "Probar de nuevo"); el error queda en el registro del servidor.
 */
async function datos(): Promise<{ d: DatosAlta | null; error?: string }> {
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) return { d: null };
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  let ultimo = "";
  for (let intento = 0; intento < 2; intento++) {
    try {
      const { data, error } = await supabase.rpc("alta_publica", { p_host: host });
      if (!error) return { d: data as DatosAlta | null };
      ultimo = error.message;
    } catch (e) {
      ultimo = (e as Error).message;
    }
    console.error(`[hacete-socio] alta_publica falló (intento ${intento + 1}) para ${host}: ${ultimo}`);
  }
  return { d: null, error: ultimo || "no se pudo leer" };
}

/**
 * El nombre del gimnasio para el título y la descripción sale de la MISMA landing que ya está en caché (rápido): si el generateMetadata
 * esperara la consulta del alta (lenta), Next manda las etiquetas DESPUÉS del <head> (streaming) y Lighthouse y Google no las ven
 * ("Document does not have a meta description").
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  const landing = host ? await traerLanding(host).catch(() => null) : null;
  const nombre = landing?.marca.nombre ?? null;
  const titulo = nombre ? `Crear mi cuenta · ${nombre}` : "Crear mi cuenta";
  // SEO: toda página pública lleva su descripción.
  const descripcion = nombre ? `Creá tu cuenta gratis en ${nombre}: dejá tus datos y empezá a entrenar.` : "Creá tu cuenta gratis: dejá tus datos y empezá a entrenar.";
  // Al compartir el link por WhatsApp: la misma imagen y el mismo ícono que la página del gimnasio (la foto de portada, o /og con su nombre y sus colores).
  const origen = host ? urlDeHost(host, "/og") : "/og";
  const foto = landing?.publicada && landing.portada.foto_path ? urlMarca(landing.portada.foto_path) : null;
  const imagen = foto ?? origen;
  const icono = landing ? urlMarca(landing.marca.favicon_path ?? landing.marca.logo_path) : null;
  return {
    title: { absolute: titulo },
    description: descripcion,
    icons: icono ? { icon: icono, apple: icono } : { icon: "/icono", apple: "/icono" },
    openGraph: { type: "website", title: titulo, description: descripcion, siteName: nombre ?? NOMBRE_PRODUCTO, locale: "es_AR", images: [{ url: imagen, alt: nombre ?? NOMBRE_PRODUCTO }] },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion, images: [imagen] },
  };
}

// N4: el link puede llevar de dónde viene la persona (?o=instagram | qr | whatsapp | recomendado). Solo esos cuatro; cualquier otro texto no cuenta.
const ORIGENES = ["instagram", "qr", "whatsapp", "recomendado"];

export default async function HaceteSocio({ searchParams }: { searchParams: Promise<{ plan?: string; o?: string }> }) {
  const { d, error: fallo } = await datos();
  const { plan, o } = await searchParams;
  if (fallo) {
    // La base no respondió: la página lo dice con su salida (Probar de nuevo), nunca una pantalla de error genérica.
    return (
      <main className="mx-auto max-w-3xl px-4 pt-16 pb-24 space-y-4" data-alta-error>
        <h1 className="titular text-4xl">Crear mi cuenta</h1>
        <div className="tarjeta p-6 space-y-4" role="alert">
          <p className="text-lg">No pudimos abrir el formulario ahora. Probá de nuevo en unos segundos.</p>
          <p className="texto-tenue text-sm">{fallo}</p>
          <a href={plan ? `?plan=${encodeURIComponent(plan)}` : "?"} className="boton boton-principal" data-reintentar-alta><Icono nombre="repetir" /> Probar de nuevo</a>
        </div>
      </main>
    );
  }
  if (!d) notFound();
  const origen = ORIGENES.includes(String(o ?? "").toLowerCase()) ? String(o).toLowerCase() : "";
  const raiz = await raizDelGimnasio();
  const wa = linkWhatsapp(d.contacto.whatsapp, "Hola! Quiero hacerme socio.");
  return (
    <div {...propsMarca(d.marca)} className="min-h-dvh">
      <header className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between gap-3">
        <Link href={raiz} className="titulo text-xl truncate">← {d.marca.nombre}</Link>
        <a href="/ingresar?modo=socio" className="boton"><Icono nombre="llave" /> Ya soy socio, entrar</a>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 space-y-8">
        <div>
          <h1 className="titular text-5xl sm:text-6xl">Crear mi cuenta</h1>
          <p className="texto-suave text-lg mt-3">Dejá tus datos y creá tu cuenta gratis. Con tu mail y tu contraseña entrás a tu perfil, ves tu QR y todo lo del gimnasio.</p>
        </div>
        {d.abierta
          ? <FormAlta datos={d} planInicial={plan ?? d.plan_sugerido ?? null} origen={origen}
              avisoDatos={<p className="texto-suave text-sm">Ley 25.326: tus datos los guarda {d.marca.nombre}, solo para anotarte y cobrarte. Podés pedir verlos, corregirlos o borrarlos desde “Yo” en tu app, o en recepción. Leé la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline" data-politica>política de privacidad</a>.</p>} />
          : (
            // C9: lo que ve quien escanea el QR o abre el link con el registro apagado: dice que hoy no se puede y da el WhatsApp.
            <div className="tarjeta p-6 space-y-4" data-alta-cerrada>
              <p className="text-lg">Hoy no te podés anotar desde acá.</p>
              <p className="texto-suave">{wa ? "Escribinos por WhatsApp o pasá por el gimnasio y te anotamos." : "Pasá por el gimnasio y te anotamos."}</p>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton boton-principal" data-whatsapp-gimnasio><Icono nombre="mensaje" /> Consultanos por WhatsApp</a>}
            </div>
          )}
      </main>
    </div>
  );
}
