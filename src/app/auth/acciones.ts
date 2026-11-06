"use server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { requerir, supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { crearPase, paseValido } from "@/lib/turnstile";
import { googleActivo } from "@/lib/google";
import { TEXTO_SIN_CONEXION, sinConexion } from "@/app/ingresar/destino";
import { exigirDesafio } from "@/app/ingresar/desafio";

// VD-22 · Vincular un Google a un socio: DNI + un código al celular (o mail) que el gimnasio ya tiene cargado.
// Todo lo decide el servidor: el DNI busca al socio, el código se verifica contra SU contacto (nunca uno que mande
// el navegador) y la base vuelve a comprobar la prueba antes de guardar el vínculo (vincular_google).

export type EstadoVinculo = {
  error?: string;
  enviado?: boolean;
  dni?: string;
  destino?: string;
  /** El vínculo necesita un "sí": este Google ya tiene a otra persona, o el socio ya tenía otro Google. */
  confirmar?: { socio: string; otros: string[]; otraCuenta: boolean; verificado: string; prueba: string };
};

const MENSAJE_GENERICO = "El DNI o el código no son correctos. Si el problema sigue, pedile a recepción que revise tus datos.";
type Contacto = { socio_id: string; telefono: string | null; email: string | null };

const soloDni = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\D/g, "");
const secreto = () => requerir("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
const claveDeLaPrueba = (usuario: string, gimnasio: string, dni: string, verificado: string) => `google|${usuario}|${gimnasio}|${dni}|${verificado}`;

/** Quién está pidiendo: una sesión de Google de ESTE gimnasio. Sin eso, no hay nada que vincular. */
async function contexto() {
  if (!googleActivo()) return { error: "Entrar con Google no está disponible." } as const;
  const gimnasioId = (await headers()).get("x-gimnasio-id");
  if (!gimnasioId) return { error: "Entrá desde la dirección de tu gimnasio" } as const;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Se cerró tu sesión. Volvé a entrar con Google." } as const;
  return { gimnasioId, usuarioId: data.user.id, supabase } as const;
}

async function contactoDelDni(gimnasioId: string, dni: string): Promise<Contacto | null> {
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { data, error } = await clienteServicio().rpc("socio_para_vincular_google", { p_gimnasio_id: gimnasioId, p_dni: dni });
  if (error) throw new Error(`No pudimos buscar el DNI: ${error.message}`);
  return data as Contacto | null;
}

/** Cliente aparte, sin cookies: verificar el código de un celular no puede cambiar la sesión de Google de la persona. */
const clienteDeCodigo = () => createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false, autoRefreshToken: false } });

/** Paso 1: el DNI. Mismo resultado exista o no el socio: no se averigua quién es socio. */
export async function pedirCodigoGoogle(_: EstadoVinculo, form: FormData): Promise<EstadoVinculo> {
  const c = await contexto();
  if ("error" in c) return { error: c.error };
  const dni = soloDni(form.get("dni"));
  if (!/^[0-9]{6,9}$/.test(dni)) return { error: "Escribí tu DNI, solo los números (sin puntos).", dni };
  const desafio = await exigirDesafio(form, `dni:${c.gimnasioId}:${dni}`);
  if (desafio) return { error: desafio, dni };

  const contacto = await contactoDelDni(c.gimnasioId, dni);
  const destino = contacto?.telefono ?? contacto?.email ?? null;
  // SEG-1: el mismo límite de pedidos por destino y por IP. Sin socio (o sin contacto) se cuenta contra el DNI.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { error: limite } = await clienteServicio().rpc("registrar_pedido_codigo", { p_destino: destino ?? `dni:${c.gimnasioId}:${dni}`, p_ip: ip });
  if (limite) return { error: limite.message, dni };

  if (destino) {
    const auth = clienteDeCodigo().auth;
    const { error } = contacto?.telefono
      ? await auth.signInWithOtp({ phone: contacto.telefono })
      : await auth.signInWithOtp({ email: destino, options: { shouldCreateUser: true } });
    if (error) return { error: sinConexion(error) ? TEXTO_SIN_CONEXION : `No pudimos mandarte el código: ${error.message}`, dni };
  }
  return { enviado: true, dni };
}

/** Paso 2: el código. Si cierra, la base guarda el vínculo (o pide confirmar). */
export async function verificarCodigoGoogle(_: EstadoVinculo, form: FormData): Promise<EstadoVinculo> {
  const c = await contexto();
  if ("error" in c) return { error: c.error };
  const dni = soloDni(form.get("dni"));
  const codigo = String(form.get("codigo") ?? "").replace(/\D/g, "");
  const contacto = /^[0-9]{6,9}$/.test(dni) ? await contactoDelDni(c.gimnasioId, dni) : null;
  const mal = { error: MENSAJE_GENERICO, enviado: true, dni };
  if (!contacto || (!contacto.telefono && !contacto.email)) return mal;

  const verificador = clienteDeCodigo();
  const { data, error } = contacto.telefono
    ? await verificador.auth.verifyOtp({ phone: contacto.telefono, token: codigo, type: "sms" })
    : await verificador.auth.verifyOtp({ email: contacto.email!, token: codigo, type: "email" });
  if (error && sinConexion(error)) return { error: TEXTO_SIN_CONEXION, enviado: true, dni };
  if (error || !data.user) return mal;
  await verificador.auth.signOut({ scope: "local" }).catch(() => {});   // esa sesión solo servía para probar el código
  return guardarVinculo(c.gimnasioId, c.usuarioId, dni, data.user.id, false);
}

/** Paso 3 (solo si hizo falta): la persona dijo "sí, vincular". Vale con la prueba que firmó el servidor en el paso 2. */
export async function confirmarVinculoGoogle(_: EstadoVinculo, form: FormData): Promise<EstadoVinculo> {
  const c = await contexto();
  if ("error" in c) return { error: c.error };
  const dni = soloDni(form.get("dni"));
  const verificado = String(form.get("verificado") ?? "");
  const prueba = String(form.get("prueba") ?? "");
  if (!paseValido(prueba, secreto(), claveDeLaPrueba(c.usuarioId, c.gimnasioId, dni, verificado))) {
    return { error: "Pasó mucho tiempo. Volvé a pedir el código.", dni };
  }
  return guardarVinculo(c.gimnasioId, c.usuarioId, dni, verificado, true);
}

async function guardarVinculo(gimnasioId: string, usuarioId: string, dni: string, verificadoId: string, confirmar: boolean): Promise<EstadoVinculo> {
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { data, error } = await clienteServicio().rpc("vincular_google", {
    p_gimnasio_id: gimnasioId, p_usuario_id: usuarioId, p_dni: dni, p_verificado_id: verificadoId, p_confirmar: confirmar,
  });
  if (error) return { error: error.code === "P0001" ? MENSAJE_GENERICO : `No pudimos vincular tu cuenta: ${error.message}`, enviado: true, dni };
  const r = data as { estado: "vinculado" | "confirmar"; socio?: string; otros?: string[]; otra_cuenta?: boolean };
  if (r.estado === "confirmar") {
    return {
      enviado: true, dni,
      confirmar: {
        socio: r.socio ?? "", otros: r.otros ?? [], otraCuenta: !!r.otra_cuenta, verificado: verificadoId,
        prueba: crearPase(secreto(), claveDeLaPrueba(usuarioId, gimnasioId, dni, verificadoId)),
      },
    };
  }
  return { destino: "/app" };
}
