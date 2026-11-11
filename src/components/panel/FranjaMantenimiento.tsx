import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { Icono } from "@/components/ui/Icono";

type Mantenimiento = { desde: string; hasta: string; texto: string | null; ahora: boolean } | null;

// Información pública y igual para todos (la carga BRIK desde el super admin): se guarda 60 s. Si no se puede preguntar, no hay franja (nunca frena una pantalla).
const traer = unstable_cache(async (): Promise<Mantenimiento> => {
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("mantenimiento_vigente");
  if (error) return null;
  return (data as Mantenimiento) ?? null;
}, ["mantenimiento_vigente"], { revalidate: 60 });

const cuando = (iso: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** Franja de mantenimiento programado: aparece hasta 48 h antes y mientras dura. Va arriba de cada pantalla del panel y de la app del socio. */
export async function FranjaMantenimiento() {
  const m = await traer().catch(() => null);
  if (!m) return null;
  return (
    <div role="status" data-mantenimiento className="mb-6 rounded-[var(--radio)] border border-[var(--amarillo)] bg-[color-mix(in_oklab,var(--amarillo)_12%,transparent)] px-4 py-3 flex gap-3 items-start">
      <Icono nombre="reloj" />
      <p className="text-sm break-words">
        <strong>{m.ahora ? "Estamos en mantenimiento." : "Mantenimiento programado."}</strong>{" "}
        {m.ahora ? `Hasta ${cuando(m.hasta)}.` : `Desde ${cuando(m.desde)} hasta ${cuando(m.hasta)}.`}
        {m.texto ? ` ${m.texto}` : " Puede que algunas pantallas tarden o no respondan."}
      </p>
    </div>
  );
}
