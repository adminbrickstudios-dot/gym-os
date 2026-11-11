"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { conflictoDe, versionDe } from "@/lib/panel/version";
import { clienteServicio } from "@/lib/supabase/servicio";
import { svgSeguro, tipoReal } from "@/lib/imagenes";
import { achicarFoto } from "@/lib/imagenes-servidor";

export async function guardarConfiguracion(datos: Record<string, unknown>, version?: string | null): Promise<{ error?: string; version?: string }> {
  const panel = await contextoPanel();
  // VD-34: si otra persona guardó la configuración mientras esta estaba abierta, se avisa antes de pisarla.
  const choque = await conflictoDe(panel.gimnasio.id, "configuracion", panel.gimnasio.id, version);
  if (choque) return choque;
  try {
    await rpc("guardar_configuracion", { p_gimnasio_id: panel.gimnasio.id, p_datos: datos });
    revalidatePath("/panel", "layout");
    return { version: (await versionDe(panel.gimnasio.id, "configuracion", panel.gimnasio.id)) ?? undefined };
  } catch (e) { return { error: (e as Error).message }; }
}

/**
 * Pestaña Gimnasio: nombre, contacto y sedes, todo junto o nada. Devuelve lo
 * guardado tal como quedó en la base (teléfonos e Instagram normalizados).
 */
export async function guardarDatosGimnasio(datos: Record<string, unknown>): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_datos_gimnasio", { p_gimnasio_id: panel.gimnasio.id, p_datos: datos });
    revalidatePath("/panel", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Logo, ícono y fotos ─────────────────────────────────────────────
// La base decide (permiso, tipo, tamaño, cupo, ruta); recién después el
// servidor sube o borra con la clave de servicio. El navegador nunca
// escribe en el bucket.
type TipoImagen = "logo" | "favicon" | "foto";
const TIPOS: TipoImagen[] = ["logo", "favicon", "foto"];

async function borrarArchivos(rutas: (string | null | undefined)[]) {
  const r = rutas.filter((x): x is string => !!x);
  if (!r.length) return;
  // Si falla, queda un archivo sin usar en el bucket: no rompe nada y no se le muestra a nadie.
  const { error } = await clienteServicio().storage.from("marcas").remove(r);
  if (error) console.error(`No se pudo borrar ${r.join(", ")}: ${error.message}`);
}

export async function subirImagen(formulario: FormData): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  const tipo = formulario.get("tipo") as TipoImagen;
  const archivo = formulario.get("archivo");
  if (!TIPOS.includes(tipo) || !(archivo instanceof File)) return { error: "Elegí un archivo." };
  try {
    let bytes: Uint8Array = new Uint8Array(await archivo.arrayBuffer());
    let mime = tipoReal(bytes);
    if (!mime) return { error: `“${archivo.name}” no es una imagen que podamos usar (PNG, JPG, WEBP o SVG).` };
    if (mime === "image/svg+xml" && !svgSeguro(new TextDecoder().decode(bytes))) {
      return { error: "Ese SVG trae código o links adentro y no lo podemos mostrar. Exportalo de nuevo como PNG." };
    }
    // VD-47X: logos y fotos se guardan a 800 px como mucho y en webp (el ícono y el SVG quedan como vienen).
    if (mime !== "image/svg+xml" && tipo !== "favicon") { const a = await achicarFoto(bytes, mime); bytes = a.bytes; mime = a.mime; }
    const ruta = await rpc<string>("preparar_imagen_marca", { p_gimnasio_id: panel.gimnasio.id, p_tipo: tipo, p_tipo_mime: mime, p_bytes: bytes.length });
    const { error } = await clienteServicio().storage.from("marcas").upload(ruta, Buffer.from(bytes), { contentType: mime, upsert: false, cacheControl: "31536000" });
    if (error) return { error: `No se pudo subir la imagen: ${error.message}` };
    let anterior: string | null;
    try {
      anterior = await rpc<string | null>("confirmar_imagen_marca", { p_gimnasio_id: panel.gimnasio.id, p_tipo: tipo, p_ruta: ruta });
    } catch (e) {
      await borrarArchivos([ruta]);
      throw e;
    }
    await borrarArchivos([anterior]);
    revalidatePath("/", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function quitarImagen(tipo: TipoImagen, ruta?: string): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  try {
    const sobra = await rpc<string | null>("quitar_imagen_marca", { p_gimnasio_id: panel.gimnasio.id, p_tipo: tipo, p_ruta: ruta ?? null });
    await borrarArchivos([sobra]);
    revalidatePath("/", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function ordenarFotos(rutas: string[]): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("ordenar_fotos", { p_gimnasio_id: panel.gimnasio.id, p_rutas: rutas });
    revalidatePath("/", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Horarios y cierres ──────────────────────────────────────────────
export async function guardarHorarios(sedeId: string, franjas: { dia: number; abre: string; cierra: string }[]): Promise<{ error?: string; agenda?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_horarios_apertura", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sedeId, p_franjas: franjas });
    revalidatePath("/", "layout");
    return { agenda: await rpc("horarios_apertura_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** El día siguiente a una fecha AAAA-MM-DD (la base guarda el cierre como [desde, hasta)). */
function diaSiguiente(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

async function listasDeCierres(gimnasioId: string) {
  const [cierres, agenda] = await Promise.all([
    rpc("cierres_panel", { p_gimnasio_id: gimnasioId }),
    rpc("horarios_apertura_panel", { p_gimnasio_id: gimnasioId }),
  ]);
  return { cierres, agenda };
}

/** VD-57: lo que le pasa al vencimiento de los socios si se carga este cierre (lo calcula la base según la regla del gimnasio). */
export type PrevioCierre = { suma_dias: boolean; dias: number; socios: number };
export async function previsualizarCierre(c: { desde: string; hasta: string; sedeId: string | null }): Promise<{ error?: string; previo?: PrevioCierre }> {
  const panel = await contextoPanel();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(c.hasta)) return { error: "Elegí las fechas del cierre." };
  if (c.hasta < c.desde) return { error: "El último día no puede ser antes del primero." };
  try {
    return { previo: await rpc<PrevioCierre>("previsualizar_cierre", { p_gimnasio_id: panel.gimnasio.id, p_desde: c.desde, p_hasta: diaSiguiente(c.hasta), p_sede_id: c.sedeId }, { lectura: true }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-57 · La regla del gimnasio: ¿los días cerrados se suman al vencimiento? (la ve el equipo que carga cierres; la cambia solo el dueño). */
export async function leerReglaCierres(): Promise<{ suma?: boolean; error?: string }> {
  try {
    const panel = await contextoPanel();
    return { suma: (await rpc<{ suma_dias: boolean }>("config_cierres", { p_gimnasio_id: panel.gimnasio.id }, { lectura: true })).suma_dias };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function guardarReglaCierres(suma: boolean): Promise<{ suma?: boolean; error?: string }> {
  try {
    const panel = await contextoPanel();
    const r = await rpc<{ suma_dias: boolean }>("guardar_config_cierres", { p_gimnasio_id: panel.gimnasio.id, p_suma_dias: suma });
    revalidatePath("/panel/configuracion");
    return { suma: r.suma_dias };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function crearCierre(c: { desde: string; hasta: string; motivo: string; sedeId: string | null }): Promise<{ error?: string; cierres?: unknown; agenda?: unknown }> {
  const panel = await contextoPanel();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(c.hasta)) return { error: "Elegí las fechas del cierre." };
  if (c.hasta < c.desde) return { error: "El último día no puede ser antes del primero." };
  try {
    // Si suma o no los días lo decide la regla del gimnasio (la base): el cierre ya no lo elige.
    await rpc("crear_cierre", {
      p_gimnasio_id: panel.gimnasio.id, p_desde: c.desde, p_hasta: diaSiguiente(c.hasta), p_motivo: c.motivo, p_sede_id: c.sedeId,
    });
    revalidatePath("/", "layout");
    return await listasDeCierres(panel.gimnasio.id);
  } catch (e) { return { error: (e as Error).message }; }
}

export async function anularCierre(cierreId: string, motivo: string): Promise<{ error?: string; cierres?: unknown; agenda?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("anular_cierre", { p_cierre_id: cierreId, p_motivo: motivo });
    revalidatePath("/", "layout");
    return await listasDeCierres(panel.gimnasio.id);
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Mensajes ────────────────────────────────────────────────────────
export async function guardarMensaje(clave: string, texto: string): Promise<{ error?: string; mensajes?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_mensaje", { p_gimnasio_id: panel.gimnasio.id, p_clave: clave, p_texto: texto });
    return { mensajes: await rpc("mensajes_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function restaurarMensaje(clave: string): Promise<{ error?: string; mensajes?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("restaurar_mensaje", { p_gimnasio_id: panel.gimnasio.id, p_clave: clave });
    return { mensajes: await rpc("mensajes_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Cómo queda un texto (sin guardar) con un socio real. */
export async function vistaPreviaMensaje(clave: string, texto: string): Promise<{ error?: string; vista?: unknown }> {
  const panel = await contextoPanel();
  try {
    return { vista: await rpc("vista_previa_mensaje", { p_gimnasio_id: panel.gimnasio.id, p_clave: clave, p_texto: texto }) };
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Página ──────────────────────────────────────────────────────────
export async function publicarPagina(publicada: boolean): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("publicar_pagina", { p_gimnasio_id: panel.gimnasio.id, p_publicada: publicada });
    revalidatePath("/", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Tablets en la puerta (ENT-3) ────────────────────────────────────
export type Tablet = { id: string; nombre: string; sede: string; ultimo_uso: string | null; creado_en: string; revocado: boolean };
/** La base genera el token y guarda solo su hash: se ve una sola vez, acá. */
export async function autorizarTablet(sedeId: string, nombre: string): Promise<{ error?: string; token?: string; tablets?: Tablet[] }> {
  try {
    const panel = await contextoPanel();
    const r = await rpc<{ token: string }>("autorizar_tablet", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sedeId, p_nombre: nombre });
    return { token: r.token, tablets: await rpc<Tablet[]>("tablets_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function revocarTablet(id: string): Promise<{ error?: string; tablets?: Tablet[] }> {
  try {
    const panel = await contextoPanel();
    await rpc("revocar_tablet", { p_dispositivo_id: id });
    return { tablets: await rpc<Tablet[]>("tablets_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

// ── MercadoPago (PAY-1): el token y la clave van a Vault, nunca vuelven ──
export type EstadoMP = { conectado: boolean; modo?: "prueba" | "produccion"; conectado_en?: string; por?: string | null };
export async function conectarMercadoPago(token: string, secreto: string, modo: string): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("guardar_mercadopago", { p_gimnasio_id: panel.gimnasio.id, p_token: token, p_secreto: secreto, p_modo: modo });
    revalidatePath("/panel/configuracion");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
/** BASE-7: "Probar conexión": usa el token ya guardado (nunca vuelve al navegador) y le pregunta a MercadoPago a qué cuenta pertenece. */
export async function probarMercadoPago(): Promise<{ error?: string; cuenta?: string }> {
  try {
    const panel = await contextoPanel();
    // Solo el dueño y el encargado: la base decide con el mismo permiso que usa para ver el estado de los pagos online.
    await rpc("estado_pagos_online", { p_gimnasio_id: panel.gimnasio.id });
    const { data, error } = await clienteServicio().rpc("credenciales_mp", { p_gimnasio_id: panel.gimnasio.id });
    if (error) return { error: error.message };
    const c = data as { token: string; modo: string } | null;
    if (!c?.token) return { error: "Todavía no conectaste MercadoPago: guardá tus credenciales y probá de nuevo." };
    const { cuentaDelToken } = await import("@/lib/mercadopago");
    try {
      const u = await cuentaDelToken(c.token);
      return { cuenta: u.nickname ?? u.email ?? String(u.id) };
    } catch (e) {
      const m = (e as Error).message;
      if (/ 40[13] /.test(m)) return { error: "MercadoPago no aceptó el Access Token: copialo de nuevo desde Credenciales (el de producción, o el de prueba si elegiste Prueba)." };
      return { error: "No pudimos hablar con MercadoPago. Probá de nuevo en un rato." };
    }
  } catch (e) { return { error: (e as Error).message }; }
}
export async function desconectarMercadoPago(): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("quitar_mercadopago", { p_gimnasio_id: panel.gimnasio.id });
    revalidatePath("/panel/configuracion");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Turnos fijos (CLA-2): se guarda en el momento ──
export async function guardarTurnosFijos(prendido: boolean): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("guardar_turnos_fijos", { p_gimnasio_id: panel.gimnasio.id, p_prendido: prendido });
    revalidatePath("/panel/configuracion");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-23b: la meta de visitas del mes que ve el socio en su Inicio (solo el dueño; la base valida 1 a 31). */
export async function guardarMetaVisitas(meta: number): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("guardar_meta_visitas", { p_gimnasio_id: panel.gimnasio.id, p_meta: meta });
    revalidatePath("/panel/configuracion");
    revalidatePath("/app");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** REV-2a: suma una sede (la base valida: solo el dueño, nombre único) y devuelve los datos como quedaron. */
export async function sumarSede(nombre: string): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("sumar_sede", { p_gimnasio_id: panel.gimnasio.id, p_nombre: nombre });
    revalidatePath("/panel", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** COM-10: el link de reseñas de Google (solo el dueño; vacío lo saca). */
export async function guardarLinkResena(link: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_link_resena", { p_gimnasio_id: panel.gimnasio.id, p_link: link }); revalidatePath("/panel/configuracion"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** VD-51 · La prueba gratis del gimnasio: no / 1 día / 1 clase (la lee el equipo de la puerta; solo el dueño la cambia). */
export type ModoPrueba = "no" | "dia" | "clase";
export async function leerPruebaGratis(): Promise<{ modo?: ModoPrueba; error?: string }> {
  try {
    const panel = await contextoPanel();
    return { modo: (await rpc<{ modo: ModoPrueba }>("config_prueba_gratis", { p_gimnasio_id: panel.gimnasio.id })).modo };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function guardarPruebaGratis(modo: ModoPrueba): Promise<{ modo?: ModoPrueba; error?: string }> {
  try {
    const panel = await contextoPanel();
    const r = await rpc<{ modo: ModoPrueba }>("guardar_prueba_gratis", { p_gimnasio_id: panel.gimnasio.id, p_modo: modo });
    revalidatePath("/panel/configuracion");
    revalidatePath("/panel", "layout");
    return { modo: r.modo };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-46G: prende o apaga el plan familiar/corporativo (solo el dueño; arranca apagado). */
export async function guardarPlanFamiliar(activo: boolean): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("guardar_plan_familiar", { p_gimnasio_id: panel.gimnasio.id, p_activo: activo });
    revalidatePath("/panel/configuracion");
    revalidatePath("/panel/socios");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

// ── FA-16 (D57): que el socio suba su foto desde la app. Apagado por defecto; lo prende solo el dueño. ──
export async function leerFotoSocioPermitida(): Promise<{ permitida?: boolean; error?: string }> {
  try {
    const panel = await contextoPanel();
    return { permitida: await rpc<boolean>("foto_socio_permitida_gimnasio", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function guardarFotoSocioPermitida(si: boolean): Promise<{ permitida?: boolean; error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("guardar_foto_socio_permitida", { p_gimnasio_id: panel.gimnasio.id, p_si: si });
    revalidatePath("/panel/configuracion");
    return { permitida: si };
  } catch (e) { return { error: (e as Error).message }; }
}

// ── FA-7: los primeros días, la entrada avisa pero no frena ──
export async function leerAvisarSinBloquear(): Promise<{ hasta?: string | null; activo?: boolean; error?: string }> {
  try {
    const panel = await contextoPanel();
    return await rpc<{ hasta: string | null; activo: boolean }>("avisar_sin_bloquear_estado", { p_gimnasio_id: panel.gimnasio.id });
  } catch (e) { return { error: (e as Error).message }; }
}
export async function guardarAvisarSinBloquear(dias: number): Promise<{ hasta?: string | null; activo?: boolean; error?: string }> {
  try {
    const panel = await contextoPanel();
    const r = await rpc<{ hasta: string | null; activo: boolean }>("guardar_avisar_sin_bloquear", { p_gimnasio_id: panel.gimnasio.id, p_dias: dias });
    revalidatePath("/panel", "layout");
    return r;
  } catch (e) { return { error: (e as Error).message }; }
}

// ── FA-23: plazo para aceptar el lugar de la lista de espera ──
export async function leerEsperaPlazo(): Promise<{ minutos?: number | null; error?: string }> {
  try {
    const panel = await contextoPanel();
    const r = await rpc<{ minutos: number | null }>("espera_plazo_gimnasio", { p_gimnasio_id: panel.gimnasio.id });
    return { minutos: r.minutos };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function guardarEsperaPlazo(minutos: number | null): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("guardar_espera_plazo", { p_gimnasio_id: panel.gimnasio.id, p_minutos: minutos });
    revalidatePath("/panel/configuracion");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
