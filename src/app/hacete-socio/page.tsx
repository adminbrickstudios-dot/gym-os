import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { propsMarca } from "@/lib/marca";
import { linkWhatsapp } from "@/lib/landing-textos";
import { traerLanding, type Marca, type PlanPublico } from "@/lib/landing";
import { FormAlta } from "./FormAlta";
import type { Transferencia } from "./acciones";
import { Icono } from "@/components/ui/Icono";
import { raizDelGimnasio } from "@/lib/app/raiz-gimnasio";

export type DatosAlta = {
  abierta: boolean; marca: Marca; contacto: { whatsapp: string | null; mensaje_whatsapp?: string };
  mostrar_precios?: boolean; planes?: PlanPublico[]; plan_sugerido?: string | null; reglamento?: { version: number; texto: string } | null; transferencia?: Transferencia | null;
};

async function datos(): Promise<DatosAlta | null> {
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) return null;
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("alta_publica", { p_host: host });
  if (error) throw new Error(`No se pudo abrir el alta: ${error.message}`);
  return data as DatosAlta | null;
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
  return {
    title: { absolute: nombre ? `Quiero ser socio · ${nombre}` : "Quiero ser socio" },
    // SEO: toda página pública lleva su descripción.
    description: nombre ? `Hacete socio de ${nombre}: elegí tu plan, dejá tus datos y empezá a entrenar.` : "Hacete socio: elegí tu plan, dejá tus datos y empezá a entrenar.",
  };
}

export default async function HaceteSocio({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const d = await datos();
  if (!d) notFound();
  const { plan } = await searchParams;
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
          <h1 className="titular text-5xl sm:text-6xl">Quiero ser socio</h1>
          <p className="texto-suave text-lg mt-3">Elegí tu plan, dejá tus datos y creá tu cuenta. Con tu mail y tu contraseña entrás a tu perfil.</p>
        </div>
        {d.abierta && d.planes?.length
          ? <FormAlta datos={d} planInicial={plan ?? d.plan_sugerido ?? null} />
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
