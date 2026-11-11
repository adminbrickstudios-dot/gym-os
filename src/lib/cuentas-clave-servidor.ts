import "server-only";
import { headers } from "next/headers";
import { clienteServicio } from "@/lib/supabase/servicio";
import { traducirErrorSupabase } from "@/lib/admin/errores-supabase";
import { urlDeHost } from "@/lib/urls";
import { contrasenaProvisoria, nuevaContrasena } from "@/lib/cuentas";

// C1 · Nueva clave sin mails. Quien llama YA pasó por la base (cuenta_para_clave_socio / cuenta_para_nueva_clave):
// acá solo se ejecuta lo que la base autorizó, con la clave de servicio.

/** El dominio desde el que se pidió (el del propio gimnasio): el link del mensaje lleva su marca. */
export async function origenDePeticion(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return urlDeHost(host);
}

export type CuentaSocio = { socio_id: string; gimnasio_id: string; gimnasio: string; nombre: string; email: string; usuario_id: string | null; crear: boolean };

/**
 * Deja al socio con una clave provisoria. Con cuenta: la cambia. Sin cuenta: la crea con su mail, ya confirmada
 * (no se manda ningún mail) y la vincula a su ficha. Si no se pudo vincular, la cuenta nueva se borra: no queda nada a medias.
 */
export async function aplicarClaveSocio(c: CuentaSocio): Promise<{ contrasena: string; creada: boolean }> {
  try {
    if (!c.crear) {
      if (!c.usuario_id) throw new Error("La base no devolvió la cuenta del socio");
      return { contrasena: await nuevaContrasena(c.usuario_id), creada: false };
    }
    const servicio = clienteServicio();
    const contrasena = contrasenaProvisoria();
    const { data, error } = await servicio.auth.admin.createUser({ email: c.email, password: contrasena, email_confirm: true, user_metadata: { nombre: c.nombre } });
    if (error || !data.user) throw new Error(`No se pudo crear la cuenta: ${error?.message ?? "no devolvió la cuenta"}`);
    const { data: r, error: errVincula } = await servicio.rpc("vincular_socios_por_email", { p_gimnasio_id: c.gimnasio_id, p_usuario_id: data.user.id });
    const vinculados = Number((r as { vinculados?: number } | null)?.vinculados ?? 0);
    if (errVincula || vinculados < 1) {
      await servicio.auth.admin.deleteUser(data.user.id);
      throw new Error(`No se pudo vincular la cuenta a su ficha${errVincula ? `: ${errVincula.message}` : ""}`);
    }
    return { contrasena, creada: true };
  } catch (e) {
    throw new Error(traducirErrorSupabase((e as Error).message));
  }
}
