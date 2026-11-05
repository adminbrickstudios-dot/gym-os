"use server";
import { cookies, headers } from "next/headers";
import { COOKIE_GIMNASIO, OPCIONES_COOKIE_GIMNASIO } from "@/lib/cookie-gimnasio";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { MiSesion } from "@/lib/panel/servidor";

// La acción devuelve a dónde ir y el navegador navega. Redirigiendo dentro de
// la acción, Next renderiza el destino en el mismo POST, sin los encabezados
// del gimnasio que pone el middleware para esa ruta.
export type EstadoIngreso = { error?: string; email?: string; destino?: string };

/** Solo rutas internas: un "siguiente" que apunta afuera se ignora (y se dice en el código, no en silencio). */
function destinoSeguro(siguiente: string | null, porDefecto: string) {
  if (siguiente && /^\/(?!\/)[\w\-/?=&%.]*$/.test(siguiente)) return siguiente;
  return porDefecto;
}

export async function ingresar(_: EstadoIngreso, form: FormData): Promise<EstadoIngreso> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(form.get("contrasena") ?? "");
  if (!email || !contrasena) return { error: "Escribí tu mail y tu contraseña", email };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (error) {
    return { error: /invalid/i.test(error.message) ? "El mail o la contraseña no son correctos" : `No pudimos iniciar sesión: ${error.message}`, email };
  }

  const { data: sesion, error: errSesion } = await supabase.rpc("mi_sesion");
  if (errSesion) return { error: `Entraste, pero no pudimos leer tu cuenta: ${errSesion.message}`, email };
  const yo = sesion as MiSesion;

  const h = await headers();
  const gimnasioId = h.get("x-gimnasio-id");
  const siguiente = String(form.get("siguiente") ?? "") || null;

  if (h.get("x-gymos-contexto") === "plataforma") {
    // Desde la dirección de Gym OS: el admin va al super admin; el equipo de
    // un gimnasio, a su panel (el gimnasio queda en una cookie; los permisos
    // los valida la base en cada pantalla).
    if (yo.es_admin && !siguiente?.startsWith("/panel")) return { destino: destinoSeguro(siguiente, "/admin") };
    if (yo.equipo.length === 1) {
      await elegirGimnasio(yo.equipo[0].slug);
      return { destino: "/panel" };
    }
    if (yo.equipo.length > 1) return { destino: "/elegir" };
    if (yo.es_admin) return { destino: "/admin" };
    await supabase.auth.signOut();
    return {
      error: yo.socios.length
        ? "Sos socio: entrá desde la app de tu gimnasio."
        : "Tu cuenta no tiene ningún gimnasio. Pedile acceso al dueño.",
      email,
    };
  }
  if (yo.equipo.some((e) => e.gimnasio_id === gimnasioId)) return { destino: destinoSeguro(siguiente, "/panel") };
  if (yo.socios.some((s) => s.gimnasio_id === gimnasioId)) return { destino: "/app" };
  await supabase.auth.signOut();
  return { error: "Tu usuario no es de este gimnasio. Revisá la dirección o pedile acceso al dueño.", email };
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
  const limite = await limiteCodigos(telefono);
  if (limite) return { error: limite, telefono };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({ phone: telefono });
  if (error) return { error: `No pudimos mandarte el código: ${error.message}`, telefono };
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
  if (error || !data.user) return { error: "El código no es correcto o venció. Pedí uno nuevo.", telefono, enviado: true };

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

/** Recuerda en qué gimnasio trabaja la persona cuando entra desde la dirección de la plataforma. */
async function elegirGimnasio(slug: string) {
  (await cookies()).set(COOKIE_GIMNASIO, slug, OPCIONES_COOKIE_GIMNASIO);
}

// ── Socios: entrar con el mail y un código (APP-9) ─────────────────
export type EstadoCodigoMail = { error?: string; email?: string; enviado?: boolean; destino?: string };

export async function pedirCodigoMail(_: EstadoCodigoMail, form: FormData): Promise<EstadoCodigoMail> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribí tu mail (el que diste en el gimnasio)", email };
  const limite = await limiteCodigos(email);
  if (limite) return { error: limite, email };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return { error: `No pudimos mandarte el código: ${error.message}`, email };
  return { enviado: true, email };
}

/** Verifica el código del mail y vincula la cuenta a los socios de ESTE gimnasio con ese mail (lo hace el servidor). */
export async function verificarCodigoMail(_: EstadoCodigoMail, form: FormData): Promise<EstadoCodigoMail> {
  const email = String(form.get("email") ?? "");
  const codigo = String(form.get("codigo") ?? "").replace(/\D/g, "");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: codigo, type: "email" });
  if (error || !data.user) return { error: "El código no es correcto o venció. Pedí uno nuevo.", email, enviado: true };

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
