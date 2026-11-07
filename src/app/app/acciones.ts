"use server";
import { notificarDespues } from "@/lib/push";
import { headers } from "next/headers";
import { crearPreferencia } from "@/lib/mercadopago";
import { clienteServicio } from "@/lib/supabase/servicio";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

const r = async (f: () => Promise<unknown>) => {
  try { await f(); revalidatePath("/app"); revalidatePath("/app/clases"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};
/** VD-46D: el socio dice "entendido" a un aviso (queda la constancia de que lo vio). */
export const marcarAvisoLeido = async (avisoId: string) => r(() => rpc("marcar_aviso_leido", { p_aviso_id: avisoId }));
export const reservarClase =async (claseId: string, socioId: string) => r(() => rpc("reservar", { p_clase_id: claseId, p_socio_id: socioId }));
/** VD-24: si al cancelar subió alguien de la lista de espera, la base devuelve su reserva y se le manda el push. */
export const cancelarReserva = async (reservaId: string) => r(async () => {
  const subio = await rpc<string | null>("cancelar_reserva", { p_reserva_id: reservaId });
  notificarDespues("lugar_liberado", subio);
});
/** El comprobante ya está subido al bucket (desde el navegador, a la carpeta del socio): acá se informa el pago. */
export const informarPago = async (socioId: string, path: string, clave?: string) => r(async () => {
  // VD-34: con la misma clave, un segundo toque devuelve el pago ya informado (no se crea otro ni da error).
  const x = await rpc<{ pago_id: string; repetida?: boolean }>("informar_transferencia", { p_socio_id: socioId, p_comprobante_path: path, p_cuotas: 1, p_clave_operacion: clave ?? null });
  if (!x?.repetida) notificarDespues("comprobante", x?.pago_id);   // PUSH-1: a quien lo revisa
});

/** VD-39: lo que pasa si elige ese plan o pase (D6 para una membresía: los días a favor los calcula la base). */
export type VistaCompra = {
  plan_id: string; nombre: string; tipo: "membresia" | "pase_diario" | "pack"; cambia_plan: boolean;
  plan_viejo?: string | null; dias_a_favor?: number; hasta?: string | null; congelado?: boolean;
  cantidad_clases?: number | null; validez_dias?: number | null;
  precio_transferencia: number | null; precio_mercadopago: number | null;
};
export async function vistaCompraApp(socioId: string, planId: string): Promise<{ vista?: VistaCompra; error?: string }> {
  try { return { vista: await rpc<VistaCompra>("vista_compra_app", { p_socio_id: socioId, p_plan_id: planId }, { lectura: true }) }; }
  catch (e) { return { error: (e as Error).message }; }
}
/** VD-39: el socio informa su transferencia por un plan o pase (el comprobante ya está en su carpeta). */
export const informarCompraApp = async (socioId: string, planId: string, path: string, clave: string) => r(async () => {
  const x = await rpc<{ pago_id: string; repetida?: boolean }>("informar_compra_app", { p_socio_id: socioId, p_plan_id: planId, p_comprobante_path: path, p_clave_operacion: clave });
  if (!x?.repetida) notificarDespues("comprobante", x?.pago_id);
  revalidatePath("/app/plan");
});

/** El QR de entrada (ENT-2): lo arma y lo firma la base; cambia cada 30 segundos. */
export async function codigoQR(gimnasioId: string, socioId: string): Promise<{ codigo?: string; vence_en?: string; error?: string }> {
  try { return await rpc<{ codigo: string; vence_en: string }>("mi_qr", { p_gimnasio_id: gimnasioId, p_socio_id: socioId }); }
  catch (e) { return { error: (e as Error).message }; }
}

/** El socio escaneó el QR de la tablet de la entrada (ENT-6): la base valida el código y anota la entrada. */
export async function escanearEntrada(gimnasioId: string, socioId: string, codigo: string): Promise<{ resultado?: string; color?: string; texto?: string; error?: string }> {
  try {
    const r = await rpc<{ resultado: string; color: string; texto: string }>("entrar_por_qr_pared", { p_gimnasio_id: gimnasioId, p_socio_id: socioId, p_codigo: codigo });
    revalidatePath("/app");
    return r;
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-48 · "Me voy": el socio escanea el mismo QR de la tablet para marcar su salida (la base valida el código y si había entrada abierta). */
export async function escanearSalida(gimnasioId: string, socioId: string, codigo: string): Promise<{ registrada?: boolean; texto?: string; error?: string }> {
  try {
    const r = await rpc<{ registrada: boolean; texto: string }>("salir_por_qr_pared", { p_gimnasio_id: gimnasioId, p_socio_id: socioId, p_codigo: codigo });
    revalidatePath("/app");
    return r;
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-23: el socio vio (o salteó) la bienvenida de la primera vez; queda anotado en la base. */
export async function marcarBienvenida(socioId: string): Promise<{ error?: string }> {
  try { await rpc("marcar_bienvenida", { p_socio_id: socioId }); revalidatePath("/app"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Invitar a alguien hoy (INV-1): la recepción confirma cuando llega. */
export async function invitarHoy(gimnasioId: string, socioId: string, nombre: string, dni: string): Promise<{ error?: string }> {
  try { await rpc("invitar", { p_gimnasio_id: gimnasioId, p_socio_id: socioId, p_nombre: nombre, p_dni: dni }); revalidatePath("/app"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/**
 * PAY-1: la base arma la venta y el pago pendiente (al precio de MercadoPago);
 * acá se crea el checkout con el token del gimnasio (de Vault, con la clave de
 * servicio) y se devuelve a dónde ir. El aviso de MercadoPago es el que acredita.
 */
export async function pagarConMercadoPago(socioId: string, clave?: string, planId?: string): Promise<{ url?: string; error?: string }> {
  try {
    // Sin plan: la cuota de siempre. Con plan (VD-39): cambio de plan o pase/pack. Ambas con la clave de operación (VD-34).
    const p = planId
      ? await rpc<{ pago_id: string; gimnasio_id: string; monto: number; descripcion: string }>("iniciar_compra_online", { p_socio_id: socioId, p_plan_id: planId, p_clave_operacion: clave ?? null })
      : await rpc<{ pago_id: string; gimnasio_id: string; monto: number; descripcion: string }>("iniciar_pago_online", { p_socio_id: socioId, p_clave_operacion: clave ?? null });
    const { data, error } = await clienteServicio().rpc("credenciales_mp", { p_gimnasio_id: p.gimnasio_id });
    if (error) return { error: error.message };
    const c = data as { token: string; modo: string } | null;
    if (!c?.token) return { error: "El gimnasio no tiene MercadoPago conectado" };
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.|[^.]+\.localhost)/.test(host) ? "http" : "https");
    const origen = `${proto}://${host}`;
    const pref = await crearPreferencia(c.token, {
      pagoId: p.pago_id, titulo: p.descripcion, monto: Number(p.monto),
      volver: `${origen}/app/pago?pago=${p.pago_id}`,
      avisar: `${origen}/api/webhooks/mercadopago?g=${p.gimnasio_id}`,
    });
    return { url: c.modo === "prueba" && pref.sandbox_init_point ? pref.sandbox_init_point : pref.init_point };
  } catch (e) { return { error: (e as Error).message }; }
}

/** "Confirmando tu pago…": cómo va (lo pregunta la pantalla cada pocos segundos). */
export async function estadoPagoOnline(pagoId: string): Promise<{ estado?: string; motivo?: string | null; error?: string }> {
  try {
    const r = await rpc<{ estado: string; rechazado_motivo: string | null }>("pago_online", { p_pago_id: pagoId });
    if (r.estado !== "pendiente") revalidatePath("/app");
    return { estado: r.estado, motivo: r.rechazado_motivo };
  } catch (e) { return { error: (e as Error).message }; }
}

/** APP-8: el socio pide una pausa (la aprueba el gimnasio) o la baja (la da el gimnasio). */
export const pedirPausaSocio = async (socioId: string, desde: string, hasta: string, categoria: string, nota: string) =>
  r(async () => { await rpc("pedir_pausa_socio", { p_socio_id: socioId, p_desde: desde, p_hasta: hasta, p_categoria: categoria, p_nota: nota || null }); revalidatePath("/app/cuenta"); });
/** VD-46E: devuelve el código de baja (la constancia) para mostrarlo al instante. */
export const pedirBajaSocio = async (socioId: string, motivo: string, nota: string): Promise<{ error?: string; codigo?: string }> => {
  try {
    await rpc("pedir_baja_socio", { p_socio_id: socioId, p_motivo: motivo, p_nota: nota || null });
    const c = await rpc<{ codigo: string } | null>("constancia_baja", { p_socio_id: socioId });
    revalidatePath("/app/cuenta");
    return { codigo: c?.codigo };
  } catch (e) { return { error: (e as Error).message }; }
};

/** APP-9: el socio crea (o cambia) su contraseña para entrar con su mail. */
export async function crearContrasena(clave: string, actual?: string): Promise<{ error?: string }> {
  if (clave.length < 8) return { error: "La contraseña: 8 letras o más." };
  const { crearClienteServidor } = await import("@/lib/supabase/servidor");
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return { error: "Para entrar con contraseña, entrá una vez con tu mail." };
  // VD-33b: si ya tenía contraseña, se pide la actual.
  const { cambiarContrasenaCuenta } = await import("@/lib/cuenta/acciones");
  return cambiarContrasenaCuenta(clave, actual);
}

/** RUT-2: el socio anota peso y repeticiones de un ejercicio de su rutina. */
export async function anotarEjercicio(socioId: string, ejercicioId: string, peso: number | null, repeticiones: number | null): Promise<{ error?: string }> {
  try {
    await rpc("anotar_ejercicio", { p_socio_id: socioId, p_ejercicio_id: ejercicioId, p_peso: peso, p_repeticiones: repeticiones });
    revalidatePath("/app/rutina");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** COM-10: la respuesta a "del 0 al 10, ¿cuánto nos recomendarías?" (la base sabe si es su socio). */
export async function responderEncuesta(socioId: string, puntaje: number): Promise<{ r?: { promotor: boolean; link_resena: string | null }; error?: string }> {
  try { return { r: await rpc("responder_encuesta", { p_socio_id: socioId, p_puntaje: puntaje }) }; }
  catch (e) { return { error: (e as Error).message }; }
}
/** COM-12: elegir (o soltar, con null) el lugar en la sala de una clase reservada. */
export const elegirLugar = async (reservaId: string, lugar: number | null) => r(() => rpc("elegir_lugar", { p_reserva_id: reservaId, p_lugar: lugar }));
