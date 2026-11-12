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
  /** VD-46M: la puerta está en emergencia y a este socio se lo anota igual (queda marcado). */
  emergencia?: boolean;
};
/** VD-3: si es un repetido, `texto` dice a qué hora entró; con `alerta_prestamo` llegó por otra vía hace pocos minutos (amarillo). */
export type ResultadoIngreso = {
  ingreso_id: string; repetido: boolean; resultado: string; texto?: string; color?: string; alerta_prestamo?: boolean; emergencia?: boolean; veredicto?: Veredicto;
  /** VD-48: el gimnasio registra la salida (se ofrece "Marcar salida"); con `avisar_salida` (obligatoria) además se le dice a la recepción que no la marcó. */
  puede_salir?: boolean; avisar_salida?: boolean; reingreso?: boolean;
};
/** VD-48: lo que contesta la base al marcar la salida: "Chau Juan, estuviste 1 h 20" o "No tenía entrada abierta" (sin error). */
export type ResultadoSalida = { registrada: boolean; texto: string; nombre?: string; minutos?: number };

/** VD-51 · La prueba gratis desde la Entrada. La base decide todo: si el gimnasio la da, una vez por DNI, solo a quien nunca fue socio. */
export type PruebaDni = { modo: "no" | "dia" | "clase"; existe: boolean; nombre?: string; telefono?: string | null; reservada?: boolean; usada?: boolean; dia?: string; clase?: string | null };
export async function modoPrueba(): Promise<{ modo?: "no" | "dia" | "clase"; error?: string }> {
  try {
    const panel = await contextoPanel();
    return { modo: (await rpc<{ modo: "no" | "dia" | "clase" }>("config_prueba_gratis", { p_gimnasio_id: panel.gimnasio.id })).modo };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function pruebaPorDni(dni: string): Promise<{ p?: PruebaDni; error?: string }> {
  try {
    const panel = await contextoPanel();
    return { p: await rpc<PruebaDni>("prueba_por_dni", { p_gimnasio_id: panel.gimnasio.id, p_dni: dni }) };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function darPruebaGratis(sedeId: string, datos: { dni?: string; nombre?: string; apellido?: string; telefono?: string; socioId?: string }):
  Promise<{ socioId?: string; numero?: number | null; nombre?: string; error?: string }> {
  try {
    const panel = await contextoPanel();
    const { sede } = sedeActiva(panel, sedeId);
    const r = await rpc<{ socio_id: string; numero: number | null; nombre: string }>("dar_prueba_gratis", {
      p_gimnasio_id: panel.gimnasio.id, p_sede_id: sede.id, p_dni: datos.dni?.trim() || null, p_nombre: datos.nombre?.trim() || null,
      p_apellido: datos.apellido?.trim() || null, p_telefono: datos.telefono?.trim() || null, p_socio_id: datos.socioId ?? null,
    });
    revalidatePath("/panel/socios");
    revalidatePath("/panel/prospectos");
    return { socioId: r.socio_id, numero: r.numero, nombre: r.nombre };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-48 · Marcar la salida de un socio (la ventana de Entrada: DNI + S). La base decide si el gimnasio la registra y si había entrada abierta. */
export async function registrarSalida(socioId: string, sedeId: string): Promise<{ r?: ResultadoSalida; error?: string }> {
  try {
    const panel = await contextoPanel();
    const { sede } = sedeActiva(panel, sedeId);
    const r = await rpc<ResultadoSalida>("registrar_salida", { p_socio_id: socioId, p_sede_id: sede.id, p_via_acceso: "recepcion" });
    revalidatePath("/panel/entrada");
    revalidatePath("/panel");
    return { r };
  } catch (e) { return { error: (e as Error).message }; }
}

type Apto = { pide: boolean; apto?: { vence: string; vigente: boolean } | null };

/** N2: si la puerta ya dijo lo del apto (el gimnasio prendió que la entrada avise o frene), no se repite el aviso aparte. */
const aptoYaDicho = (v: Veredicto) => /^Apto físico/.test(v.texto) || (v.avisos ?? []).some((a) => /^Apto físico/.test(a));

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
    const apto = !a.pide ? null : !a.apto ? "No presentó el apto físico" : !a.apto.vigente ? `El apto físico venció el ${dia(a.apto.vence)}` : null;
    const firmar = docs.pendientes.length ? `Falta firmar: ${docs.pendientes.map((d) => d.titulo).join(", ")}` : null;
    return { v, guia, apto: aptoYaDicho(v) ? null : apto, firmar, eventosHoy };
  } catch (e) { return { error: (e as Error).message }; }
}

/**
 * F1.1/F0: el ingreso del aviso en UNA sola llamada del navegador y dos esperas a la base (antes eran dos llamadas y cuatro):
 * primero, a la vez, el contexto y todo lo que mira el veredicto; después, solo si corresponde anotar, el ingreso.
 * No revalida la pantalla (eso frenaba el aviso): el navegador la refresca después de mostrarlo.
 * La decisión de anotar es la de siempre: la base dice si puede (estado_acceso) y la guía dice si el botón es "anotar".
 */
export async function entradaRapida(socioId: string, sedeId: string, soloEnVerde: boolean): Promise<{ v?: Veredicto; guia?: Guia; apto?: string | null; firmar?: string | null; eventosHoy?: EventoHoy[]; r?: ResultadoIngreso; error?: string }> {
  const panelP = contextoPanel();
  panelP.catch(() => undefined);   // si falla, se vuelve a tirar abajo: acá no debe quedar sin atender
  let datos;
  try {
    datos = await Promise.all([
      rpc<Veredicto>("estado_acceso", { p_socio_id: socioId, p_sede_id: sedeId }),
      rpc<Apto>("apto_socio", { p_socio_id: socioId }),
      rpc<{ pendientes: { titulo: string }[] }>("documentos_socio", { p_socio_id: socioId }),
      rpc<Guia>("guia_entrada", { p_socio_id: socioId, p_sede_id: sedeId }),
      rpc<EventoHoy[]>("eventos_del_dia_socio", { p_socio_id: socioId }).catch((): EventoHoy[] => []),
    ]);
  } catch (e) { await panelP; return { error: (e as Error).message }; }
  const panel = await panelP;   // sin sesión redirige; sin permiso tira el error de siempre
  try {
    const { sede } = sedeActiva(panel, sedeId);
    const [v, a, docs, guia, eventosHoy] = datos;
    const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const apto = !a.pide ? null : !a.apto ? "No presentó el apto físico" : !a.apto.vigente ? `El apto físico venció el ${dia(a.apto.vence)}` : null;
    const firmar = docs.pendientes.length ? `Falta firmar: ${docs.pendientes.map((d) => d.titulo).join(", ")}` : null;
    const anotable = v.puede && guia.boton === "anotar" && (!soloEnVerde || v.color === "verde") && !apto && !firmar;
    const aptoMostrado = aptoYaDicho(v) ? null : apto;
    if (!anotable) return { v, guia, apto: aptoMostrado, firmar, eventosHoy };
    const r = await rpc<ResultadoIngreso>("registrar_ingreso", { p_socio_id: socioId, p_sede_id: sede.id, p_via_acceso: "recepcion", p_forzar_motivo: null, p_promete_pagar_el: null });
    return { v, guia, apto: aptoMostrado, firmar, eventosHoy, r };
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
