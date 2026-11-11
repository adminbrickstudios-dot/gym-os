// ESC-06 · "¿Responde?": lo mira el chequeo programado (.github/workflows/chequeo-salud.yml) y cualquier monitor de afuera (UptimeRobot, etc.).
// Pública a propósito y sin datos de nadie: dice si la app anda y si la base contesta, con el tiempo de cada una. 200 = todo bien, 503 = algo no responde.
// Nunca devuelve claves, nombres ni variables: solo "ok", milisegundos y el commit publicado.
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = performance.now();
  let base: { ok: boolean; ms: number; detalle?: string };
  try {
    // Una consulta liviana y pública: la misma que usa el proxy para resolver una dirección. Si responde, PostgREST y la base están arriba.
    const r = await fetch(`${supabaseUrl()}/rest/v1/rpc/gimnasio_por_slug`, {
      method: "POST", headers: { apikey: supabaseAnon(), Authorization: `Bearer ${supabaseAnon()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: "chequeo-de-salud" }), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    base = { ok: r.ok, ms: Math.round(performance.now() - t0), ...(r.ok ? {} : { detalle: `HTTP ${r.status}` }) };
  } catch (e) {
    base = { ok: false, ms: Math.round(performance.now() - t0), detalle: (e as Error).name === "TimeoutError" ? "la base no contestó en 8 s" : "no se pudo conectar con la base" };
  }
  const cuerpo = { ok: base.ok, app: true, base, commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null, entorno: process.env.VERCEL_ENV ?? "local" };
  return Response.json(cuerpo, { status: base.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
