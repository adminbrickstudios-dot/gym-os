import "server-only";
import { headers } from "next/headers";
import { clienteServicio } from "@/lib/supabase/servicio";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { demasiadosIntentos, elegirGimnasio, sinConexion, TEXTO_DEMASIADOS_INTENTOS, TEXTO_SIN_CONEXION } from "@/app/ingresar/destino";

/**
 * H3b · La cuenta del socio que se anota o reclama su ficha: se crea con el mail y la contraseña que él escribe, ya confirmada
 * (nunca un mail de confirmación) y con la sesión abierta. Sirve para el alta (/hacete-socio) y para reclamar una ficha cargada.
 *
 * - Mail sin cuenta: se crea. La sesión se abre recién cuando la ficha ya está vinculada (`abrirSesion`).
 * - Mail con cuenta: solo se sigue si la contraseña es la de esa cuenta (así nadie ata una ficha a la cuenta de otro). Cuenta como
 *   intento de ingreso para el tope de BASE-8.
 */
export type Cuenta = { usuarioId: string; creada: boolean; sesionAbierta: boolean };

export async function prepararCuenta(email: string, contrasena: string, nombre: string, telefono?: string): Promise<Cuenta | { error: string }> {
  const servicio = clienteServicio();
  const { data: existente, error: errBusca } = await servicio.rpc("usuario_por_mail", { p_email: email });
  if (errBusca) { console.error("[cuenta-socio] usuario_por_mail", errBusca.message); return { error: "No pudimos crear tu cuenta ahora. Probá de nuevo en un rato." }; }
  if (existente) {
    const abierta = await abrirSesion(email, contrasena);
    if (abierta) return { error: abierta === "clave"
      ? "Ese mail ya tiene una cuenta con otra contraseña. Escribí la contraseña de esa cuenta, o usá otro mail, o entrá desde “Ya soy socio, entrar”."
      : abierta };
    return { usuarioId: existente as string, creada: false, sesionAbierta: true };
  }
  // El celular queda en la misma cuenta: si después entra con el código por SMS, es ESTA cuenta y no una segunda sin ficha.
  // (Si ese celular ya es de otra cuenta, se crea sin él.)
  let celular: string | null = null;
  if (telefono) {
    const { data: normalizado } = await servicio.rpc("telefono_para_ingresar", { p_texto: telefono });
    if (typeof normalizado === "string" && normalizado) celular = normalizado;
  }
  const crear = (conCelular: boolean) => servicio.auth.admin.createUser({
    email, password: contrasena, email_confirm: true, user_metadata: { nombre },
    ...(conCelular && celular ? { phone: celular, phone_confirm: true } : {}),
  });
  let { data, error } = await crear(true);
  if (error && celular && /phone|telef|tel[eé]fono/i.test(error.message)) ({ data, error } = await crear(false));
  if (error || !data.user) {
    console.error("[cuenta-socio] createUser", error?.message);
    if (error && sinConexion(error)) return { error: TEXTO_SIN_CONEXION };
    if (error && /password/i.test(error.message)) return { error: "La contraseña es muy débil o muy corta: usá 8 letras o más." };
    return { error: "No pudimos crear tu cuenta ahora. Probá de nuevo en un rato." };
  }
  return { usuarioId: data.user.id, creada: true, sesionAbierta: false };
}

/** Abre la sesión del socio (cookies de @supabase/ssr). null si entró; si no, el texto para mostrar ("clave" = contraseña incorrecta). */
export async function abrirSesion(email: string, contrasena: string): Promise<null | "clave" | string> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const servicio = clienteServicio();
  const permitido = await servicio.rpc("ingreso_permitido", { p_destino: email, p_ip: ip });
  if (!permitido.error && permitido.data === false) return "Hiciste muchos intentos seguidos. Probá de nuevo en 15 minutos.";
  const { error } = await (await crearClienteServidor()).auth.signInWithPassword({ email, password: contrasena });
  if (!error) return null;
  if (sinConexion(error)) return TEXTO_SIN_CONEXION;
  if (demasiadosIntentos(error)) return TEXTO_DEMASIADOS_INTENTOS;
  await servicio.rpc("registrar_ingreso_fallido", { p_destino: email, p_ip: ip });
  return "clave";
}

/** Si el alta no se pudo hacer, la cuenta recién creada se borra: no queda un mail ocupado sin ficha. */
export async function deshacerCuenta(c: Cuenta) {
  if (!c.creada) return;
  const { error } = await clienteServicio().auth.admin.deleteUser(c.usuarioId);
  if (error) console.error("[cuenta-socio] no se pudo borrar la cuenta sobrante", error.message);
}

/** Deja la ficha vinculada a la cuenta (la base comprueba que la ficha exista y no tenga ya otra cuenta). */
export async function vincularCuenta(gimnasioId: string, socioId: string, usuarioId: string): Promise<string | null> {
  const { error } = await clienteServicio().rpc("vincular_cuenta_socio", { p_gimnasio_id: gimnasioId, p_socio_id: socioId, p_usuario_id: usuarioId });
  if (error) { console.error("[cuenta-socio] vincular", error.message); return "Se anotó tu ficha pero no pudimos vincularla a tu cuenta. Entrá con tu mail y tu contraseña, o pedile a la recepción que lo revise."; }
  return null;
}

/** Con la sesión abierta, el gimnasio queda elegido (cookie) para entrar a /app desde la dirección de la plataforma. */
export async function recordarGimnasio() {
  const slug = (await headers()).get("x-gimnasio-slug");
  if (slug) await elegirGimnasio(slug);
}

/** Un texto para la persona a partir de un error de la base: lo que escribimos nosotros (raise exception) se muestra; lo demás va al registro. */
export function textoDeError(e: { message?: string; code?: string } | null | undefined, generico = "No pudimos hacerlo ahora. Probá de nuevo en un rato."): string {
  if (e?.code === "P0001" && e.message) return e.message;
  console.error("[cuenta-socio] error de la base", e?.code, e?.message);
  return generico;
}
