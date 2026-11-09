import "server-only";
import { randomBytes } from "node:crypto";
import { clienteServicio } from "@/lib/supabase/servicio";
import { mailValido } from "@/lib/cuentas";
import { linkCrearContrasena, textoLinkContrasena } from "./acceso-socio";

/**
 * Deja lista la cuenta del socio para que cree su contraseña: si ese mail no tiene cuenta, la crea con una contraseña
 * al azar que nadie ve (el socio elige la suya con el código que le llega al mail). Devuelve el link y el texto listo
 * para copiar o mandar por wa.me. Quien llama YA validó en la base que puede dar de alta a ese socio.
 * No vincula la ficha: eso lo hace el servidor cuando el socio verifica el código de su mail (vincular_socios_por_email).
 */
export async function prepararLinkContrasenaSocio(datos: { email: string; nombre: string; gimnasio: string; origen: string }): Promise<{ link: string; texto: string }> {
  const email = datos.email.trim().toLowerCase();
  if (!mailValido(email)) throw new Error("El mail del socio no es válido");
  const servicio = clienteServicio();
  const { data: existente, error: errBusca } = await servicio.rpc("usuario_por_mail", { p_email: email });
  if (errBusca) throw new Error(`No se pudo buscar la cuenta: ${errBusca.message}`);
  if (!existente) {
    const { error } = await servicio.auth.admin.createUser({ email, password: randomBytes(24).toString("base64url"), email_confirm: true, user_metadata: { nombre: datos.nombre } });
    if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
  }
  const link = linkCrearContrasena(datos.origen, email);
  return { link, texto: textoLinkContrasena({ gimnasio: datos.gimnasio, nombre: datos.nombre, link }) };
}
