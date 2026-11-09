"use server";
import { headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { MiSesion } from "@/lib/panel/servidor";
import { TEXTO_CODIGO_MALO, TEXTO_DEMASIADOS_INTENTOS, TEXTO_SIN_CONEXION, demasiadosIntentos, destinoTrasEntrar, sinConexion } from "./destino";
import { exigirDesafio } from "./desafio";

// La acción devuelve a dónde ir y el navegador navega. Redirigiendo dentro de
// la acción, Next renderiza el destino en el mismo POST, sin los encabezados
// del gimnasio que pone el middleware para esa ruta.
export type EstadoIngreso = { error?: string; email?: string; destino?: string };

export async function ingresar(_: EstadoIngreso, form: FormData): Promise<EstadoIngreso> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(form.get("contrasena") ?? "");
  if (!email || !contrasena) return { error: "Escribí tu mail y tu contraseña", email };

  // BASE-8: pasado el tope de intentos fallidos (8 por mail, 20 por conexión cada 15 min) ni se prueba la contraseña.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const permitido = await clienteServicio().rpc("ingreso_permitido", { p_destino: email, p_ip: ip });
  if (!permitido.error && permitido.data === false) return { error: "Hiciste muchos intentos seguidos. Probá de nuevo en 15 minutos.", email };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (error) {
    if (!sinConexion(error) && !demasiadosIntentos(error)) await clienteServicio().rpc("registrar_ingreso_fallido", { p_destino: email, p_ip: ip });
    if (sinConexion(error)) return { error: TEXTO_SIN_CONEXION, email };
    if (demasiadosIntentos(error)) return { error: TEXTO_DEMASIADOS_INTENTOS, email };
    if ((error.status ?? 400) >= 500) return { error: "No pudimos iniciar sesión ahora. Probá de nuevo en un rato.", email };
    return { error: await textoCredencialesMalas(email), email };
  }
  const r = await destinoTrasEntrar(supabase, String(form.get("siguiente") ?? "") || null);
  return r.error ? { error: r.error, email } : r;
}

/**
 * F1.2 · Error con nombre: desde la dirección de un gimnasio, si el mail no tiene ficha ni usuario ahí, lo dice
 * ("Ese mail no tiene cuenta en Gimnasio X"). Solo se pregunta después de una contraseña mala, con el tope de intentos
 * fallidos ya aplicado (8 por mail y 20 por conexión cada 15 min). Si la cuenta existe, o la base no responde, o no es
 * la dirección de un gimnasio, queda el texto de siempre.
 */
async function textoCredencialesMalas(email: string): Promise<string> {
  const generico = "El mail o la contraseña no son correctos";
  const gimnasioId = (await headers()).get("x-gimnasio-id");
  if (!gimnasioId) return generico;
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { data, error } = await clienteServicio().rpc("mail_para_ingresar", { p_gimnasio_id: gimnasioId, p_email: email });
  const r = data as { gimnasio: string | null; existe: boolean | null } | null;
  if (error || !r?.gimnasio || r.existe !== false) return generico;
  return `Ese mail no tiene cuenta en ${r.gimnasio}. Revisalo, o pedile a la recepción que te anote con ese mail.`;
}

// ── Socios: entrar con el celular y un código ───────────────────────
/**
 * "387 15 555-1234" → "+5493875551234", con la misma regla que la ficha del
 * socio (privado.telefono_normalizado): si no, un socio cargado o importado
 * con otro formato no coincide y no puede entrar. null si no es un celular.
 */
async function normalizarCelular(t: string): Promise<string | null> {
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { data, error } = await clienteServicio().rpc("telefono_para_ingresar", { p_texto: t });
  if (error) {
    if (error.code === "22023") return null;
    throw new Error(`No pudimos leer el celular: ${error.message}`);
  }
  return data as string | null;
}


/** SEG-1: antes de mandar un código, la base cuenta los pedidos (5 por destino y 20 por IP en una hora). */
async function limiteCodigos(destino: string): Promise<string | null> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { error } = await clienteServicio().rpc("registrar_pedido_codigo", { p_destino: destino, p_ip: ip });
  return error ? error.message : null;
}

export type EstadoCodigo = { error?: string; telefono?: string; enviado?: boolean; destino?: string };

export async function pedirCodigo(_: EstadoCodigo, form: FormData): Promise<EstadoCodigo> {
  const telefono = await normalizarCelular(String(form.get("telefono") ?? ""));
  if (!telefono) return { error: "Escribí tu celular con código de área (ej: 387 555-1234)" };
  // VD-33c: con Turnstile prendido, sin el desafío resuelto no sale el SMS.
  const desafio = await exigirDesafio(form, telefono);
  if (desafio) return { error: desafio, telefono };
  const limite = await limiteCodigos(telefono);
  if (limite) return { error: limite, telefono };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({ phone: telefono });
  if (error) return { error: sinConexion(error) ? TEXTO_SIN_CONEXION : demasiadosIntentos(error) ? TEXTO_DEMASIADOS_INTENTOS : `No pudimos mandarte el código: ${error.message}`, telefono };
  return { enviado: true, telefono };
}

/**
 * Verifica el código y vincula la cuenta a los socios de ESTE gimnasio con
 * ese celular (lo hace el servidor: un usuario no se vincula solo).
 */
export async function verificarCodigo(_: EstadoCodigo, form: FormData): Promise<EstadoCodigo> {
  const telefono = String(form.get("telefono") ?? "");
  const codigo = String(form.get("codigo") ?? "").replace(/\D/g, "");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.verifyOtp({ phone: telefono, token: codigo, type: "sms" });
  if (error && sinConexion(error)) return { error: TEXTO_SIN_CONEXION, telefono, enviado: true };
  if (error || !data.user) return { error: demasiadosIntentos(error) ? TEXTO_DEMASIADOS_INTENTOS : TEXTO_CODIGO_MALO, telefono, enviado: true };

  const gimnasioId = (await headers()).get("x-gimnasio-id");
  if (!gimnasioId) return { error: "Entrá desde la dirección de tu gimnasio", telefono };
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { error: errVincula } = await clienteServicio().rpc("vincular_socios_por_telefono", { p_gimnasio_id: gimnasioId, p_usuario_id: data.user.id });
  if (errVincula) return { error: `No pudimos vincular tu cuenta: ${errVincula.message}`, telefono };

  const { data: sesion } = await supabase.rpc("mi_sesion");
  if ((sesion as MiSesion | null)?.socios.some((s) => s.gimnasio_id === gimnasioId)) return { destino: "/app" };
  await supabase.auth.signOut();
  return { error: "Tu celular no está cargado en este gimnasio. Pedile a recepción que lo agregue a tu ficha.", telefono };
}

// ── Socios: entrar con el mail y un código (APP-9) ─────────────────
export type EstadoCodigoMail = { error?: string; email?: string; enviado?: boolean; destino?: string };

export async function pedirCodigoMail(_: EstadoCodigoMail, form: FormData): Promise<EstadoCodigoMail> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribí tu mail (el que diste en el gimnasio)", email };
  const desafio = await exigirDesafio(form, email);
  if (desafio) return { error: desafio, email };
  const limite = await limiteCodigos(email);
  if (limite) return { error: limite, email };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return { error: sinConexion(error) ? TEXTO_SIN_CONEXION : demasiadosIntentos(error) ? TEXTO_DEMASIADOS_INTENTOS : `No pudimos mandarte el código: ${error.message}`, email };
  return { enviado: true, email };
}

/** Verifica el código del mail y vincula la cuenta a los socios de ESTE gimnasio con ese mail (lo hace el servidor). */
export async function verificarCodigoMail(_: EstadoCodigoMail, form: FormData): Promise<EstadoCodigoMail> {
  const email = String(form.get("email") ?? "");
  const codigo = String(form.get("codigo") ?? "").replace(/\D/g, "");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: codigo, type: "email" });
  if (error && sinConexion(error)) return { error: TEXTO_SIN_CONEXION, email, enviado: true };
  if (error || !data.user) return { error: demasiadosIntentos(error) ? TEXTO_DEMASIADOS_INTENTOS : TEXTO_CODIGO_MALO, email, enviado: true };

  const gimnasioId = (await headers()).get("x-gimnasio-id");
  if (!gimnasioId) return { error: "Entrá desde la dirección de tu gimnasio", email };
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { data: v, error: errVincula } = await clienteServicio().rpc("vincular_socios_por_email", { p_gimnasio_id: gimnasioId, p_usuario_id: data.user.id });
  if (errVincula) return { error: `No pudimos vincular tu cuenta: ${errVincula.message}`, email };

  const { data: sesion } = await supabase.rpc("mi_sesion");
  if ((sesion as MiSesion | null)?.socios.some((s) => s.gimnasio_id === gimnasioId)) return { destino: "/app" };
  await supabase.auth.signOut();
  if ((v as { ya_vinculado?: boolean } | null)?.ya_vinculado) return { error: "Ya entrás a este gimnasio con tu celular: entrá con el celular.", email };
  return { error: "Tu mail no está cargado en este gimnasio. Pedile a recepción que lo agregue a tu ficha, o entrá con tu celular.", email };
}

// ── "Olvidé mi contraseña": código al mail → contraseña nueva ───────
// Funciona para cualquiera con cuenta (equipo, dueño, socio). Nunca dice si
// el mail tiene cuenta: siempre "si está registrado, te llegó un código", y el
// código que no sirve da el mismo error exista o no la cuenta.
export type EstadoRecuperar = { error?: string; email?: string; enviado?: boolean; verificado?: boolean; destino?: string };

export async function pedirRecuperacion(_: EstadoRecuperar, form: FormData): Promise<EstadoRecuperar> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribí el mail de tu cuenta", email };
  const desafio = await exigirDesafio(form, email);
  if (desafio) return { error: desafio, email };
  const limite = await limiteCodigos(email);
  if (limite) return { error: limite, email };
  const supabase = await crearClienteServidor();
  // shouldCreateUser:false → no crea cuentas. Si el mail no tiene cuenta Supabase responde con un error:
  // se traga a propósito (solo quedan visibles la falta de conexión y el límite de envíos).
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error && sinConexion(error)) return { error: TEXTO_SIN_CONEXION, email };
  if (error && demasiadosIntentos(error)) return { error: TEXTO_DEMASIADOS_INTENTOS, email };
  return { enviado: true, email };
}

export async function verificarRecuperacion(_: EstadoRecuperar, form: FormData): Promise<EstadoRecuperar> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const codigo = String(form.get("codigo") ?? "").replace(/\D/g, "");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: codigo, type: "email" });
  if (error && sinConexion(error)) return { error: TEXTO_SIN_CONEXION, email, enviado: true };
  if (error || !data.user) return { error: demasiadosIntentos(error) ? TEXTO_DEMASIADOS_INTENTOS : TEXTO_CODIGO_MALO, email, enviado: true };
  // F1.2: el socio dado de alta con mail recibe el link para crear su contraseña. El código que acaba de verificar prueba
  // que el mail es suyo: ahí se vincula su cuenta a la ficha de ESTE gimnasio (igual que al entrar con el código del mail).
  const gimnasioId = (await headers()).get("x-gimnasio-id");
  if (gimnasioId) {
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const { error: errVincula } = await clienteServicio().rpc("vincular_socios_por_email", { p_gimnasio_id: gimnasioId, p_usuario_id: data.user.id });
    if (errVincula) return { error: `No pudimos vincular tu cuenta: ${errVincula.message}`, email, enviado: true };
  }
  return { email, enviado: true, verificado: true };
}

export async function guardarContrasenaNueva(_: EstadoRecuperar, form: FormData): Promise<EstadoRecuperar> {
  const nueva = String(form.get("contrasena") ?? "");
  const repetida = String(form.get("repetir") ?? "");
  const aviso = { email: String(form.get("email") ?? ""), enviado: true, verificado: true };
  if (nueva.length < 8) return { ...aviso, error: "Tiene que tener al menos 8 caracteres" };
  if (nueva !== repetida) return { ...aviso, error: "Las dos contraseñas tienen que ser iguales" };
  const supabase = await crearClienteServidor();
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) return { error: "Se venció el código. Empezá de nuevo desde “Olvidé mi contraseña”." };
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) return { ...aviso, error: sinConexion(error) ? TEXTO_SIN_CONEXION : `No se pudo cambiar: ${error.message}` };
  const r = await destinoTrasEntrar(supabase, String(form.get("siguiente") ?? "") || null);
  return r.error ? { ...aviso, verificado: false, enviado: false, error: `Tu contraseña quedó cambiada. ${r.error}` } : r;
}
