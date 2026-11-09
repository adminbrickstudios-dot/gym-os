import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { propsMarca } from "@/lib/marca";
import { linkWhatsapp } from "@/lib/landing-textos";
import type { Marca, PlanPublico } from "@/lib/landing";
import { FormAlta } from "./FormAlta";
import type { Transferencia } from "./acciones";

export type DatosAlta = {
  abierta: boolean; marca: Marca; contacto: { whatsapp: string | null; mensaje_whatsapp?: string };
  mostrar_precios?: boolean; planes?: PlanPublico[]; reglamento?: { version: number; texto: string } | null; transferencia?: Transferencia | null;
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

export async function generateMetadata(): Promise<Metadata> {
  const d = await datos();
  return { title: { absolute: d ? `Quiero ser socio · ${d.marca.nombre}` : "Quiero ser socio" } };
}

export default async function HaceteSocio({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const d = await datos();
  if (!d) notFound();
  const { plan } = await searchParams;
  const wa = linkWhatsapp(d.contacto.whatsapp, "Hola! Quiero hacerme socio.");
  return (
    <div {...propsMarca(d.marca)} className="min-h-dvh">
      <header className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="titulo text-xl truncate">← {d.marca.nombre}</Link>
        <a href="/ingresar?modo=socio" className="boton">💪 Soy socio</a>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 space-y-8">
        <div>
          <h1 className="titular text-5xl sm:text-6xl">💪 Quiero ser socio</h1>
          <p className="texto-suave text-lg mt-3">Elegí tu plan, dejá tus datos y empezá a entrenar.</p>
        </div>
        {d.abierta && d.planes?.length && d.reglamento
          ? <FormAlta datos={d} planInicial={plan ?? null} />
          : (
            <div className="tarjeta p-6 space-y-4" data-alta-cerrada>
              <p className="text-lg">Por ahora el alta se hace en el gimnasio o por WhatsApp.</p>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton boton-principal">💬 Consultanos por WhatsApp</a>}
            </div>
          )}
      </main>
    </div>
  );
}
