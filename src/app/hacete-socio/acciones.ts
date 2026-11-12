"use server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { frenarEnvioPublico } from "@/lib/seguridad/envio-publico";
import { deshacerCuenta, prepararCuenta, recordarGimnasio, textoDeError, vincularCuenta, abrirSesion } from "@/lib/app/cuenta-socio-servidor";

export type Transferencia = { alias: string | null; cbu: string | null; titular: string | null; banco: string | null };
export type ResultadoAlta = {
  error?: string; campo?: string; ya_socio?: boolean; por?: "dni" | "telefono"; listo?: boolean; nombre?: string; plan?: string; precio?: number | string | null;
  medio?: "transferencia" | "mostrador"; transferencia?: Transferencia | null; datos?: Record<string, string>;
  dni?: string; menor?: boolean; pagoOnline?: boolean; sesion?: boolean;
};

const CAMPOS = ["origen", "plan", "nombre", "apellido", "dni", "telefono", "email", "contrasena", "fecha_nacimiento", "responsable_nombre", "responsable_telefono", "medio", "version", "acepto"] as const;

/**
 * Hacerse socio (SOCIO-FLUJO §2): crea la cuenta con el mail y la contraseña que escribe (ya confirmada, sin mails), la ficha del socio
 * y deja la sesión abierta. Queda socio SIN PAGAR (D26): la puerta dice que debe, nunca entra gratis. Lo decide la base
 * (altas prendidas, plan válido, reglamento vigente, DNI sin duplicar). Sin contraseña no hay cuenta, así que es obligatoria.
 */
export async function altaOnline(_: ResultadoAlta, form: FormData): Promise<ResultadoAlta> {
  const datos = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "").trim()])) as Record<(typeof CAMPOS)[number], string>;
  const ocultar = { ...datos, contrasena: "" };   // la contraseña nunca vuelve al navegador
  const falla = (error: string, campo?: string): ResultadoAlta => ({ error, campo, datos: ocultar });
  if (String(form.get("sitio") ?? "")) return { listo: true, nombre: datos.nombre };   // robots
  datos.dni = datos.dni.replace(/\D/g, "");
  datos.email = datos.email.toLowerCase();
  if (!datos.plan) return falla("Elegí un plan.", "plan");
  if (!/^[0-9]{7,8}$/.test(datos.dni)) return falla("El DNI tiene que tener 7 u 8 números, sin puntos.", "dni");
  if (!datos.fecha_nacimiento) return falla("Escribí tu fecha de nacimiento.", "fecha_nacimiento");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email)) return falla("Escribí tu mail: con él y tu contraseña entrás a tu perfil.", "email");
  if (datos.contrasena.length < 8) return falla("La contraseña tiene que tener 8 letras o más.", "contrasena");
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  const gimnasioId = h.get("x-gimnasio-id");
  if (!host || !gimnasioId) return falla("No se pudo saber de qué gimnasio es esta página.");
  // BASE-8 · D49: campo trampa, tiempo mínimo y tope de envíos (10 por hora por conexión, 3 por hora por persona).
  const freno = await frenarEnvioPublico(form, "alta_online", datos.dni || datos.email || null);
  if (freno.robot) return { listo: true, nombre: datos.nombre };
  if (freno.error) return falla(freno.error);

  // 1) La cuenta (la contraseña la escribe él). Si el mail ya tiene cuenta, solo sigue con su contraseña.
  const cuenta = await prepararCuenta(datos.email, datos.contrasena, datos.nombre, datos.responsable_telefono || datos.telefono);
  if ("error" in cuenta) return falla(cuenta.error, "contrasena");

  // 2) La ficha: la base decide. Si no se puede, la cuenta recién creada se borra.
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("alta_online", {
    p_host: host, p_plan_id: datos.plan, p_version: Number(datos.version) || 0, p_medio: datos.medio,
    p_datos: {
      nombre: datos.nombre, apellido: datos.apellido, dni: datos.dni, telefono: datos.telefono, email: datos.email, fecha_nacimiento: datos.fecha_nacimiento,
      responsable_nombre: datos.responsable_nombre, responsable_telefono: datos.responsable_telefono,
    },
  });
  if (error) { await deshacerCuenta(cuenta); return falla(textoDeError(error)); }
  const r = data as { ya_socio: boolean; por?: "dni" | "telefono"; socio_id?: string; plan?: string; precio?: number | string | null; menor?: boolean; medio?: "transferencia" | "mostrador"; transferencia?: Transferencia | null };
  if (r.ya_socio) { await deshacerCuenta(cuenta); return { ya_socio: true, por: r.por, nombre: datos.nombre, datos: ocultar }; }

  // 3) La ficha queda vinculada a la cuenta y la sesión se abre.
  const noVinculo = await vincularCuenta(gimnasioId, r.socio_id!, cuenta.usuarioId);
  if (noVinculo) return { error: noVinculo, datos: ocultar };
  let sesion = cuenta.sesionAbierta;
  if (!sesion) sesion = (await abrirSesion(datos.email, datos.contrasena)) === null;
  if (sesion) await recordarGimnasio();
  // N4: de dónde llegó (si el gimnasio prendió la función; si no, la base no anota nada). Nunca frena el alta.
  if (sesion && datos.origen) {
    try { const { rpc } = await import("@/lib/panel/servidor"); await rpc("anotar_origen_alta", { p_socio_id: r.socio_id, p_canal: datos.origen }); } catch { /* el origen no es parte del alta */ }
  }
  // "Pagar online" solo si el gimnasio conectó MercadoPago (lo dice la base; si falla, no se muestra).
  let pagoOnline = false;
  if (sesion) {
    try {
      const { rpc } = await import("@/lib/panel/servidor");
      pagoOnline = !!(await rpc<{ disponible: boolean }>("pago_online_disponible", { p_socio_id: r.socio_id })).disponible;
    } catch { pagoOnline = false; }
  }
  return { listo: true, nombre: datos.nombre, plan: r.plan, precio: r.precio, medio: r.medio, transferencia: r.transferencia, dni: datos.dni, menor: r.menor, pagoOnline, sesion };
}
