import "server-only";
import { cookies, headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { MiSesion } from "@/lib/panel/servidor";

export type SesionEnGimnasio = { nombre: string | null; esSocio: boolean; esEquipo: boolean };

/**
 * H3b · ¿Hay una sesión abierta y es de ESTE gimnasio (el de la dirección)? Para la landing ("Hola, Juan · Ir a mi perfil") y para
 * /ingresar (con la sesión abierta no se muestra el login). Sin cookie de sesión no se pregunta nada (las visitas anónimas no cuestan
 * ninguna llamada). Quién es lo dice la base (`mi_sesion`); si falla, es como no tener sesión: nunca un error en una página pública.
 */
export async function sesionEnEsteGimnasio(): Promise<SesionEnGimnasio | null> {
  const h = await headers();
  const gimnasioId = h.get("x-gimnasio-id");
  if (!gimnasioId) return null;
  if (!(await cookies()).getAll().some((c) => c.name.startsWith("sb-"))) return null;
  try {
    const supabase = await crearClienteServidor();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase.rpc("mi_sesion");
    if (error) return null;
    const yo = data as MiSesion;
    const socio = yo.socios.find((s) => s.gimnasio_id === gimnasioId);
    const equipo = yo.equipo.find((e) => e.gimnasio_id === gimnasioId);
    if (!socio && !equipo) return null;
    const completo = socio?.nombre ?? equipo?.nombre ?? null;
    return { nombre: completo ? completo.trim().split(/\s+/)[0] : null, esSocio: !!socio, esEquipo: !!equipo };
  } catch {
    return null;
  }
}
