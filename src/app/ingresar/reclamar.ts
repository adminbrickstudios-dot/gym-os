"use server";
import { headers } from "next/headers";
import { frenarEnvioPublico } from "@/lib/seguridad/envio-publico";
import { clienteServicio } from "@/lib/supabase/servicio";
import { abrirSesion, deshacerCuenta, prepararCuenta, recordarGimnasio, textoDeError, vincularCuenta } from "@/lib/app/cuenta-socio-servidor";

export type EstadoReclamo = { error?: string; destino?: string; ficha?: boolean; datos?: Record<string, string> };

const TEXTO_NO_COINCIDE = "No encontramos una ficha con ese DNI y ese celular. Pedile a la recepción que revise tus datos.";

/**
 * SOCIO-FLUJO §6 · El socio que ya estaba cargado (importado o dado de alta por la recepción) reclama su ficha: con su DNI y su
 * celular crea su contraseña y queda vinculado a ESA ficha, con su plan y sus pagos. Nunca se crea un socio nuevo: no se toca la
 * tabla de socios, solo se vincula la cuenta. Si algo no coincide, un solo mensaje (no se revela si el DNI existe).
 */
export async function reclamarFicha(_: EstadoReclamo, form: FormData): Promise<EstadoReclamo> {
  const datos = { dni: String(form.get("dni") ?? "").replace(/\D/g, ""), telefono: String(form.get("telefono") ?? "").trim(), email: String(form.get("email") ?? "").trim().toLowerCase() };
  const falla = (error: string): EstadoReclamo => ({ error, datos });
  if (String(form.get("sitio") ?? "")) return falla(TEXTO_NO_COINCIDE);   // robots
  const contrasena = String(form.get("contrasena") ?? "");
  if (!/^[0-9]{7,8}$/.test(datos.dni)) return falla("El DNI tiene que tener 7 u 8 números, sin puntos.");
  if (!datos.telefono) return falla("Escribí el celular que tiene el gimnasio de vos.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email)) return falla("Escribí tu mail: con él y tu contraseña vas a entrar.");
  if (contrasena.length < 8) return falla("La contraseña tiene que tener 8 letras o más.");
  const gimnasioId = (await headers()).get("x-gimnasio-id");
  if (!gimnasioId) return falla("Entrá desde la dirección de tu gimnasio.");
  const freno = await frenarEnvioPublico(form, "otro", datos.dni);
  if (freno.robot) return falla(TEXTO_NO_COINCIDE);
  if (freno.error) return falla(freno.error);

  const { data, error } = await clienteServicio().rpc("socio_para_reclamar", { p_gimnasio_id: gimnasioId, p_dni: datos.dni, p_telefono: datos.telefono });
  if (error) return falla(textoDeError(error));
  const r = data as { estado: "ok" | "no_coincide" | "ya_tiene_cuenta"; socio_id?: string; nombre?: string };
  if (r.estado === "no_coincide") return falla(TEXTO_NO_COINCIDE);
  if (r.estado === "ya_tiene_cuenta") return falla("Esa ficha ya tiene una cuenta. Entrá con tu mail y tu contraseña; si no te acordás, tocá “¿Te olvidaste la contraseña?”.");

  const cuenta = await prepararCuenta(datos.email, contrasena, r.nombre ?? "", datos.telefono);
  if ("error" in cuenta) return falla(cuenta.error);
  const noVinculo = await vincularCuenta(gimnasioId, r.socio_id!, cuenta.usuarioId);
  if (noVinculo) { await deshacerCuenta(cuenta); return falla(noVinculo); }
  if (!cuenta.sesionAbierta) {
    const abierta = await abrirSesion(datos.email, contrasena);
    if (abierta) return falla("Tu ficha quedó vinculada, pero no pudimos abrir la sesión. Entrá con tu mail y tu contraseña.");
  }
  await recordarGimnasio();
  return { destino: "/app" };
}
