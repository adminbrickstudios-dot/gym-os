import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { traerLanding } from "@/lib/landing";
import { propsMarca } from "@/lib/marca";

export const metadata: Metadata = { title: "Política de privacidad" };

type Politica = { gimnasio: string; texto: string | null; actualizada_en: string | null };

/** Modelo para cuando el dueño todavía no escribió la suya (Ley 25.326). Es un borrador: el dueño lo reemplaza desde Datos personales. */
const MODELO = [
  "Guardamos los datos que nos das al anotarte (nombre, DNI, fecha de nacimiento, celular, mail) y lo que pasa en el gimnasio (entradas, pagos, clases).",
  "Los usamos para saber si podés entrar, cobrar tu cuota, avisarte de tu plan y organizar las clases. No los vendemos ni los compartimos con terceros, salvo los servicios que hacen falta para operar (por ejemplo el cobro online).",
  "No guardamos datos de salud: solo asistencia y los pesos que vos anotás.",
  "Podés pedir ver, corregir o borrar tus datos desde la app, en “Yo → Pedir mis datos”, o en la recepción. Tenés derecho a acceder a ellos en forma gratuita (Ley 25.326).",
];

export default async function Privacidad() {
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) notFound();
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("politica_privacidad_publica", { p_host: host });
  if (error) throw new Error(`No se pudo leer la política de privacidad: ${error.message}`);
  const p = data as Politica | null;
  if (!p) notFound();
  const landing = await traerLanding(host).catch(() => null);
  const fecha = p.actualizada_en ? new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(p.actualizada_en)) : null;
  const parrafos = p.texto ? p.texto.split(/\n{2,}/) : MODELO;
  return (
    <div {...(landing ? propsMarca(landing.marca) : {})} className="min-h-dvh">
      <header className="mx-auto max-w-3xl px-4 h-16 flex items-center">
        <Link href="/" className="titulo text-xl truncate">← {p.gimnasio}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 space-y-6" data-privacidad={p.texto ? "propia" : "modelo"}>
        <h1 className="titular text-[28px]">Política de privacidad</h1>
        <p className="texto-suave">{p.gimnasio}{fecha ? ` · actualizada el ${fecha}` : ""}</p>
        <div className="space-y-4 text-lg">{parrafos.map((t) => <p key={t} className="whitespace-pre-line">{t}</p>)}</div>
      </main>
    </div>
  );
}
