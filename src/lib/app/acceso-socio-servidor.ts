import "server-only";
import { randomBytes } from "node:crypto";
import { clienteServicio } from "@/lib/supabase/servicio";
import { mailValido } from "@/lib/cuentas";
import { traducirErrorSupabase } from "@/lib/admin/errores-supabase";
import { linkCrearContrasena, textoLinkContrasena } from "./acceso-socio";

/**
 * Deja lista la cuenta del socio. Nunca manda un mail: la cuenta se crea acá, ya confirmada.
 *  - Con `contrasena` (U2: la escribe quien lo da de alta): la cuenta se crea con ESA contraseña y la ficha se vincula al toque
 *    (con `gimnasioId`), así el socio entra con su mail y esa contraseña sin pasar por ningún código.
 *  - Sin `contrasena`: la cuenta se crea con una al azar que nadie ve, y el socio elige la suya con el link (código al mail que
 *    él mismo pide). Ahí la ficha se vincula cuando verifica ese código (vincular_socios_por_email).
 * Devuelve el link y el texto listo para copiar o mandar por wa.me. Quien llama YA validó en la base que puede dar de alta a ese socio.
 */
export async function prepararLinkContrasenaSocio(datos: {
  email: string; nombre: string; gimnasio: string; origen: string; contrasena?: string; gimnasioId?: string;
}): Promise<{ link: string; texto: string; conContrasena: boolean }> {
  const email = datos.email.trim().toLowerCase();
  if (!mailValido(email)) throw new Error("El mail del socio no es válido");
  if (datos.contrasena !== undefined && datos.contrasena.length < 8) throw new Error("La contraseña tiene que tener 8 letras o más");
  try {
    const servicio = clienteServicio();
    const { data: existente, error: errBusca } = await servicio.rpc("usuario_por_mail", { p_email: email });
    if (errBusca) throw new Error(`No se pudo buscar la cuenta: ${errBusca.message}`);
    let usuarioId = existente as string | null;
    let creada = false;
    if (!usuarioId) {
      const { data, error } = await servicio.auth.admin.createUser({
        email, password: datos.contrasena ?? randomBytes(24).toString("base64url"), email_confirm: true, user_metadata: { nombre: datos.nombre },
      });
      if (error || !data.user) throw new Error(`No se pudo crear la cuenta: ${error?.message ?? "no devolvió la cuenta"}`);
      usuarioId = data.user.id; creada = true;
    }
    if (creada && datos.contrasena && datos.gimnasioId) {
      const { error } = await servicio.rpc("vincular_socios_por_email", { p_gimnasio_id: datos.gimnasioId, p_usuario_id: usuarioId });
      if (error) throw new Error(`No se pudo vincular la cuenta a su ficha: ${error.message}`);
    }
    const link = linkCrearContrasena(datos.origen, email);
    return { link, texto: textoLinkContrasena({ gimnasio: datos.gimnasio, nombre: datos.nombre, link }), conContrasena: creada && !!datos.contrasena };
  } catch (e) {
    throw new Error(traducirErrorSupabase((e as Error).message));
  }
}
