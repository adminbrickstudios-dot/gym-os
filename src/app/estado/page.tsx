import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";

export const metadata: Metadata = { title: "Estado del servicio", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * FA-20: la página pública de estado. Dice si la base responde y qué versión está publicada. Sin datos de nadie: ni gimnasios,
 * ni socios, ni mails. Pregunta algo que cualquiera puede preguntar (los planes públicos de Base) y mide cuánto tarda.
 */
async function medirBase(): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await supabase.rpc("planes_brik_publicos");
    return { ok: !error, ms: Date.now() - t0 };
  } catch { return { ok: false, ms: Date.now() - t0 }; }
}

export default async function Estado() {
  const base = await medirBase();
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const entorno = process.env.VERCEL_ENV ?? "local";
  const ahora = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "medium" });
  return (
    <main className="mx-auto max-w-xl px-4 py-12 space-y-6" data-estado={base.ok ? "ok" : "falla"}>
      <h1 className="titular text-[28px]">Estado de Base</h1>
      <p className={`pildora ${base.ok ? "pildora-verde" : "pildora-rojo"} !text-lg`} role="status">{base.ok ? "Todo funciona" : "Hay un problema: estamos viendo qué pasa"}</p>
      <dl className="tarjeta divide-y divide-[var(--borde)]">
        <div className="flex justify-between gap-4 px-4 py-3"><dt>La base de datos</dt><dd data-base>{base.ok ? `responde (${base.ms} ms)` : "no responde"}</dd></div>
        <div className="flex justify-between gap-4 px-4 py-3"><dt>Versión publicada</dt><dd data-version>{version ?? "desarrollo local"} · {entorno}</dd></div>
        <div className="flex justify-between gap-4 px-4 py-3"><dt>Medido</dt><dd>{ahora}</dd></div>
      </dl>
      <p className="texto-tenue text-sm">Esta página no muestra datos de ningún gimnasio ni de ninguna persona.</p>
    </main>
  );
}
