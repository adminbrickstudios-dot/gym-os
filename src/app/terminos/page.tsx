import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { traerLanding } from "@/lib/landing";
import { propsMarca } from "@/lib/marca";

export const metadata: Metadata = { title: "Términos y condiciones" };

type Terminos = { gimnasio: string; texto: string; actualizada_en: string };

/** WEB-06: los términos del gimnasio, solo si el dueño los publicó. Sin publicar: la página no existe. */
export default async function PaginaTerminos() {
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) notFound();
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("terminos_publicos", { p_host: host });
  if (error) throw new Error(`No se pudieron leer los términos: ${error.message}`);
  const p = data as Terminos | null;
  if (!p) notFound();
  const landing = await traerLanding(host).catch(() => null);
  const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(p.actualizada_en));
  return (
    <div {...(landing ? propsMarca(landing.marca) : {})} className="min-h-dvh">
      <header className="mx-auto max-w-3xl px-4 h-16 flex items-center">
        <Link href="/" className="titulo text-xl truncate">← {p.gimnasio}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 space-y-6" data-terminos>
        <h1 className="titular text-5xl">Términos y condiciones</h1>
        <p className="texto-suave">{p.gimnasio} · actualizados el {fecha}</p>
        <div className="space-y-4 text-lg">{p.texto.split(/\n+/).map((t, i) => <p key={i}>{t}</p>)}</div>
      </main>
    </div>
  );
}
