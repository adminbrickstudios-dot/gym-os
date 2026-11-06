"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";

export type Veredicto = {
  puede: boolean; color: string; via: string; motivo: string; texto: string; vence_en: string | null;
  para_regularizar: number | null; pack_restantes: number | null; avisos: string[] | null; modo_aviso: boolean;
};
/** VD-2: lo que la recepción necesita para actuar en cada situación (lo calcula la base: guia_entrada). */
export type Guia = {
  situacion: string; color: string; puede: boolean;
  boton: "anotar" | "cobrar" | "cobrar_pack" | "dejar_pasar" | "volver_antes" | "volver_alta" | "ficha"; boton_texto: string;
  segundo: "anotar" | "cobrar" | null; segundo_texto: string | null;
  solo_encargado: boolean; decile: string; falta: string | null; entradas_mes: number;
  chips: { clave: string; emoji: string; texto: string; href?: string }[];
};
/** VD-3: si es un repetido, `texto` dice a qué hora entró; con `alerta_prestamo` llegó por otra vía hace pocos minutos (amarillo). */
export type ResultadoIngreso = { ingreso_id: string; repetido: boolean; resultado: string; texto?: string; color?: string; alerta_prestamo?: boolean; veredicto?: Veredicto };

type Apto = { pide: boolean; apto?: { vence: string; vigente: boolean } | null };

/** El veredicto de la puerta, y aparte lo que el mostrador tiene que saber (no cambia si entra): el apto físico, si el gimnasio lo pide. */
export async function veredicto(socioId: string, sedeId: string): Promise<{ v?: Veredicto; guia?: Guia; apto?: string | null; firmar?: string | null; eventosHoy?: EventoHoy[]; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, sedeId);
    const [v, a, docs, guia, eventosHoy] = await Promise.all([
      rpc<Veredicto>("estado_acceso", { p_socio_id: socioId, p_sede_id: sede.id }),
      rpc<Apto>("apto_socio", { p_socio_id: socioId }),
      // COM-6: lo que le falta firmar (un aviso: no cambia si entra).
      rpc<{ pendientes: { titulo: string }[] }>("documentos_socio", { p_socio_id: socioId }),
      rpc<Guia>("guia_entrada", { p_socio_id: socioId, p_sede_id: sede.id }),
      // VD-19: si está anotado en un evento de hoy, la ventana lo ofrece (un aviso: nunca cambia si entra ni rompe el veredicto).
      rpc<EventoHoy[]>("eventos_del_dia_socio", { p_socio_id: socioId }).catch((): EventoHoy[] => []),
    ]);
    const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const apto = !a.pide ? null : !a.apto ? "🩺 No presentó el apto físico" : !a.apto.vigente ? `🩺 El apto físico venció el ${dia(a.apto.vence)}` : null;
    const firmar = docs.pendientes.length ? `✍️ Falta firmar: ${docs.pendientes.map((d) => d.titulo).join(", ")}` : null;
    return { v, guia, apto, firmar, eventosHoy };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-19: un evento de hoy en el que está anotado el socio que está en la puerta. */
export type EventoHoy = { evento_id: string; nombre: string; espera: boolean; presente: boolean; inscripcion_id: string | null };

/** VD-19: check-in en el evento desde la ventana de Entrada (la base verifica que hoy sea día del evento y que tenga lugar). */
export async function presenteEnEvento(eventoId: string, socioId: string, quitar = false): Promise<{ error?: string }> {
  try {
    await rpc(quitar ? "evento_quitar_presente" : "evento_marcar_presente", { p_evento_id: eventoId, p_socio_id: socioId });
    revalidatePath("/panel/eventos");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** Volvió antes de la pausa: termina hoy (desde hoy entra) y devuelve el veredicto nuevo. */
export async function terminarPausa(socioId: string, sedeId: string): Promise<{ v?: Veredicto; error?: string }> {
  try {
    const p = await rpc<{ pausas: { id: string; estado: string }[] }>("pausas_socio", { p_socio_id: socioId });
    const enCurso = p.pausas.find((x) => x.estado === "en_curso");
    if (!enCurso) return { error: "No tiene una pausa en curso." };
    await rpc("descongelar", { p_congelamiento_id: enCurso.id });
    revalidatePath(`/panel/socios/${socioId}`);
    const r = await veredicto(socioId, sedeId);
    return { v: r.v, error: r.error };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Un QR de socio (cámara o lector): la base dice de quién es, si vale y si ya se usó. */
export async function leerQR(codigo: string): Promise<{ socio?: { socio_id: string; nombre: string; numero: number }; error?: string }> {
  const panel = await contextoPanel();
  try { return { socio: await rpc("leer_qr", { p_gimnasio_id: panel.gimnasio.id, p_codigo: codigo }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Lo que escribió el lector de llaveros: el socio de ese llavero, o nada (ENT-7). */
export async function leerLlavero(codigo: string): Promise<{ socio?: { socio_id: string; nombre: string; numero: number } | null; error?: string }> {
  const panel = await contextoPanel();
  try { return { socio: await rpc("leer_llavero", { p_gimnasio_id: panel.gimnasio.id, p_codigo: codigo }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

/** VD-8 (D19): lo que acompaña a "dejar pasar sin pagar": el día que promete pagar y, si hace falta, el PIN del dueño o el encargado. */
export type PromesaPago = { prometePagarEl?: string | null; pin?: string | null };

export async function registrarEntrada(socioId: string, sedeId: string, forzarMotivo?: string, via: "recepcion" | "qr_socio" | "nfc" = "recepcion", promesa?: PromesaPago): Promise<{ r?: ResultadoIngreso; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, sedeId);
    // El PIN autoriza SOLO esta entrada: se canjea por un token y se manda en esta llamada, no queda en la cookie de la compu.
    let operador: string | undefined;
    const pin = promesa?.pin?.trim();
    if (pin) {
      if (!/^\d{4}$/.test(pin)) return { error: "El PIN son 4 números" };
      const p = await rpc<{ token?: string; error?: string; quedan?: number }>("entrar_con_pin", { p_gimnasio_id: panel.gimnasio.id, p_pin: pin });
      if (p.error || !p.token) return { error: p.quedan ? `${p.error ?? "PIN equivocado"}: te quedan ${p.quedan} intento${p.quedan === 1 ? "" : "s"}` : `${p.error ?? "PIN equivocado"}: esperá 10 minutos` };
      operador = p.token;
    }
    const r = await rpc<ResultadoIngreso>("registrar_ingreso", {
      p_socio_id: socioId, p_sede_id: sede.id, p_via_acceso: via, p_forzar_motivo: forzarMotivo?.trim() || null,
      p_promete_pagar_el: promesa?.prometePagarEl || null,
    }, { operador });
    revalidatePath("/panel/entrada");
    revalidatePath("/panel");
    return { r };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function anularEntrada(ingresoId: string, motivo: string): Promise<{ error?: string }> {
  try {
    await rpc("anular_ingreso", { p_ingreso_id: ingresoId, p_motivo: motivo });
    revalidatePath("/panel/entrada");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** Cuántas veces puede dejar pasar hoy quien está en la recepción (el tope lo pone el dueño; D1). */
export type CupoDejarPasar = {
  sin_tope: boolean; tope: number; usados: number;
  /** VD-8: cómo se deja pasar sin pagar en este gimnasio, hasta cuántos días decide la recepción y si hay un PIN de dueño o encargado cargado. */
  modo?: "recepcion_hasta_dias" | "siempre_pin" | "libre"; dias_max?: number; hay_pines?: boolean;
};
export async function cupoDejarPasar(): Promise<CupoDejarPasar | null> {
  const panel = await contextoPanel();
  try { return await rpc("cupo_dejar_pasar", { p_gimnasio_id: panel.gimnasio.id }); } catch { return null; }
}

// ── Invitados (INV-1) ───────────────────────────────────────────────
export type Invitado = { id: string; nombre: string; dni: string; socio_id: string; socio: string; entro_en: string | null; desde_la_app: boolean };
const invitadosHoy = async () => { const panel = await contextoPanel(); return rpc<Invitado[]>("invitados_de_hoy", { p_gimnasio_id: panel.gimnasio.id }); };
export async function registrarInvitado(sedeId: string, socioId: string, nombre: string, dni: string): Promise<{ error?: string; invitados?: Invitado[] }> {
  try {
    const panel = await contextoPanel();
    const { sede } = sedeActiva(panel, sedeId);
    await rpc("registrar_invitado", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sede.id, p_socio_id: socioId, p_nombre: nombre, p_dni: dni });
    revalidatePath("/panel");
    return { invitados: await invitadosHoy() };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function confirmarInvitado(id: string, sedeId: string): Promise<{ error?: string; invitados?: Invitado[] }> {
  try {
    const panel = await contextoPanel();
    const { sede } = sedeActiva(panel, sedeId);
    await rpc("confirmar_invitado", { p_invitado_id: id, p_sede_id: sede.id });
    return { invitados: await invitadosHoy() };
  } catch (e) { return { error: (e as Error).message }; }
}

/** SEG-5: la copia de quién puede entrar hoy (la calcula la base), para cuando se corte internet. */
export type CopiaEntrada = { generada_en: string; valida_hasta: string; socios: { s: string; n: string; num: number; dni: string | null; p: boolean; c: string; t: string }[] };
export async function copiaEntrada(sedeId: string): Promise<{ copia?: CopiaEntrada; error?: string }> {
  try { return { copia: await rpc<CopiaEntrada>("copia_entrada", { p_sede_id: sedeId }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

/** SEG-5: lo anotado sin internet. La base vuelve a decidir con la hora en que pasó; reintentar no duplica. */
export type EntradaSinInternet = { id_local: string; socio_id: string; momento: string; nombre: string };
export type Sincronizada = { id_local: string; nombre: string; resultado: string; color: string; texto: string; ya_estaba: boolean };
export async function sincronizarSinInternet(sedeId: string, entradas: EntradaSinInternet[]): Promise<{ r?: Sincronizada[]; error?: string }> {
  try {
    const r = await rpc<Sincronizada[]>("sincronizar_sin_internet", {
      p_sede_id: sedeId, p_entradas: entradas.map(({ id_local, socio_id, momento }) => ({ id_local, socio_id, momento })),
    });
    revalidatePath("/panel/entrada");
    return { r };
  } catch (e) { return { error: (e as Error).message }; }
}
