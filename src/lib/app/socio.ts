import "server-only";
import { redirect } from "next/navigation";
import { crearClienteServidor, gimnasioActual } from "@/lib/supabase/servidor";
import { rpc } from "@/lib/panel/servidor";
import type { MiSocio } from "@/app/app/datos";

/** Lo del socio logueado en este gimnasio. Sin sesión → /ingresar. */
export async function miSocio(socioId?: string | null) {
  const g = await gimnasioActual();
  const { data } = await (await crearClienteServidor()).auth.getUser();
  if (!data.user) redirect("/ingresar?modo=socio&siguiente=/app");
  const yo = await rpc<MiSocio>("mi_socio", { p_gimnasio_id: g.id, p_socio_id: socioId ?? null });
  return { g, yo };
}
