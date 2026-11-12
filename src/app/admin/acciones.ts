"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { contrasenaElegida, darAcceso, mailValido, nuevaContrasena } from "@/lib/cuentas";
import { dominioBase } from "@/lib/dominios";
import { urlGimnasio, urlPanel } from "@/lib/urls";
import { rpc } from "@/lib/panel/servidor";
import { normalizarSlug, errorDeSlug } from "@/lib/admin/slug";
import { agregarDominio as agregarDominioVercel, configuracionVercel, verificarDominio as verificarDominioVercel, type EstadoDominio, type Fetch as VercelFetch } from "@/lib/admin/vercel-dominios";
import { leerPago } from "@/lib/mercadopago";
import { procesarPagoMP } from "@/lib/mp-procesar";
import { clienteServicio } from "@/lib/supabase/servicio";

// Todas las acciones del super admin siguen el mismo orden: primero la base
// valida con la sesión de quien pide (admin_* / *_para_*), recién después el
// servidor usa la clave de servicio. Ningún error se pierde: todo vuelve como
// texto a la pantalla.

export type EstadoAlta = {
  error?: string;
  ok?: { gimnasio_id: string; slug: string; nombre: string; email?: string; contrasena?: string; aviso: string; pendiente?: boolean;
         equipoId?: string; yaExistia?: boolean; contrasenaNoAplicada?: boolean; bienvenida?: { texto: string; wa: string | null };
         accesos?: Accesos; prueba?: PruebaGimnasio };
};

/** P5 (EDIT-S02): lo que se le pasa al dueño, listo para copiar o mandar por wa.me. La contraseña solo se ve al crearla. */
export type Accesos = { panel: string; web: string; email: string; contrasena?: string; texto: string; wa: string | null };
/** Cuando el mail ya tenía cuenta, la contraseña que escribió quien crea no se aplica: se dice en palabras y se ofrece “Contraseña nueva”. */
const AVISO_NO_APLICADA = "Ese mail ya tenía cuenta: la contraseña que escribiste NO se aplicó. Entra con la que ya tiene, o poné una nueva con “Contraseña nueva”.";
export type PasoPrueba = { clave: string; titulo: string; estado: "ok" | "falta" | "aviso"; detalle?: string; arreglo?: string | null };
export type PruebaPersona = { equipo_id: string; nombre: string; rol: string; email: string | null; gimnasio: string; ok: boolean; pasos: PasoPrueba[] };
export type PruebaGimnasio = { gimnasio_id: string; nombre: string; ok: boolean; pasos: PasoPrueba[]; duenos: PruebaPersona[] };

const COLOR = /^#[0-9a-fA-F]{6}$/;

/** Las direcciones del gimnasio: la web (su raíz) y la puerta del dueño. Sin subdominios propios, se abre desde la plataforma (/g/<slug>). */
function direccionesDe(slug: string) {
  return { web: urlGimnasio(slug), panel: urlPanel(slug, "dueno") };
}

/** VD-40 / P5: el mensaje de bienvenida y la tarjeta "Accesos" (link del panel, mail, contraseña y link de la web). */
function bienvenida(nombre: string, dueno: string, slug: string, email: string, contrasena: string | undefined, celular: string) {
  const { web, panel } = direccionesDe(slug);
  const lineaClave = contrasena ? `Contraseña: ${contrasena}\n` : "Entrá con la contraseña que ya tenés.\n";
  const texto = `Hola ${dueno.split(" ")[0]}! Ya está listo ${nombre} en Base.\nTu panel: ${panel}\nMail: ${email}\n${lineaClave}Tu web: ${web}${contrasena ? "\nCambiá la contraseña apenas entres (Mi cuenta)." : ""}`;
  const digitos = celular.replace(/\D/g, "");
  const wa = digitos.length >= 8 ? `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
  return { bienvenida: { texto, wa: digitos.length >= 8 ? wa : null }, accesos: { panel, web, email, contrasena, texto, wa } satisfies Accesos };
}

export async function crearGimnasio(_: EstadoAlta, f: FormData): Promise<EstadoAlta> {
  // P4: la dirección se normaliza siempre acá (sin tildes ni espacios) y se valida antes de tocar nada.
  const nombre = String(f.get("nombre") ?? "").trim();
  const slug = normalizarSlug(String(f.get("slug") ?? "")) || normalizarSlug(nombre);
  const errSlug = errorDeSlug(slug);
  if (errSlug) return { error: errSlug };
  const dueno = String(f.get("dueno") ?? "").trim();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (email && !mailValido(email)) return { error: "El mail del dueño no es válido" };
  const base = dominioBase();
  if (!base) return { error: "Falta NEXT_PUBLIC_DOMINIO_BASE en Vercel (Settings → Environment Variables) y redeployar." };

  // U1: si un alta anterior se cortó a la mitad (el gimnasio quedó sin acceso para el dueño), el reintento con la misma
  // dirección termina ESE gimnasio: no crea otro ni dice "ya existe".
  const pendiente = await altaPendiente(slug);
  let r: { gimnasio_id: string; equipo_id: string; host: string };
  if (pendiente) {
    r = { ...pendiente, host: "" };
  } else {
    try {
      r = await rpc("admin_crear_gimnasio", { p_slug: slug, p_nombre: nombre, p_dominio_base: base, p_dueno_nombre: dueno });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  revalidatePath("/admin");
  // ADM-1: la plantilla del tipo (si falla, el gimnasio ya está creado: se dice, no se esconde).
  const tipo = pendiente ? "" : String(f.get("tipo") ?? "");
  let avisoPlantilla = "";
  if (tipo) {
    try { await rpc("admin_aplicar_plantilla", { p_gimnasio_id: r.gimnasio_id, p_tipo: tipo }); }
    catch (e) { avisoPlantilla = ` No se pudo aplicar la plantilla: ${(e as Error).message}.`; }
    // F9.1: el tipo queda guardado para que le lleguen las plantillas de textos de su tipo.
    try { await rpc("admin_guardar_tipo_gimnasio", { p_gimnasio_id: r.gimnasio_id, p_tipo: tipo }); } catch { /* el tipo es una mejora: el alta ya quedó hecha */ }
  }
  // VD-40: la marca del paso 2 (colores). Si falla, el gimnasio ya está creado: se dice.
  const acento = String(f.get("color_acento") ?? ""), fondo = String(f.get("color_fondo") ?? "");
  if (!pendiente && COLOR.test(acento) && COLOR.test(fondo)) {
    try { await rpc("admin_guardar_marca", { p_gimnasio_id: r.gimnasio_id, p_acento: acento, p_fondo: fondo }); }
    catch (e) { avisoPlantilla += ` No se pudieron guardar los colores: ${(e as Error).message}.`; }
  }
  // P4: el plan de Base elegido en el alta (si falla, el gimnasio ya está creado y se dice).
  const planBrik = String(f.get("plan_brik") ?? "");
  if (!pendiente && /^[0-9a-f-]{36}$/i.test(planBrik)) {
    try { await rpc("admin_asignar_plan_brik", { p_gimnasio_id: r.gimnasio_id, p_plan_id: planBrik }); }
    catch (e) { avisoPlantilla += ` No se pudo asignar el plan de Base: ${(e as Error).message}.`; }
  }
  const creado = { gimnasio_id: r.gimnasio_id, slug, nombre };
  if (!email) return { ok: { ...creado, aviso: `${nombre} está creado. Para que el dueño entre, dale acceso con su mail desde el gimnasio.${avisoPlantilla}` } };
  try {
    const { contrasena, yaExistia, contrasenaNoAplicada } = await darAcceso(r.equipo_id, email, dueno, contrasenaElegida(f));
    // P4: al terminar se corre "Probar acceso" solo (filas del gimnasio y del dueño); si no se puede correr, el alta igual quedó hecha.
    let prueba: PruebaGimnasio | undefined;
    try { prueba = await rpc<PruebaGimnasio>("admin_probar_acceso_gimnasio", { p_gimnasio_id: r.gimnasio_id }); } catch { prueba = undefined; }
    // P5: la tarjeta Accesos nunca ofrece una contraseña que no se aplicó (si el mail ya tenía cuenta, se manda sin contraseña).
    const b = bienvenida(nombre, dueno, slug, email, contrasena, String(f.get("celular") ?? ""));
    const aviso = contrasenaNoAplicada ? AVISO_NO_APLICADA : contrasena ? "Pasale al dueño su mail y esta contraseña." : "El dueño ya tenía cuenta: entra con la suya.";
    return { ok: { ...creado, email, contrasena, aviso: aviso + avisoPlantilla, equipoId: r.equipo_id, yaExistia, contrasenaNoAplicada,
      bienvenida: contrasena ? b.bienvenida : undefined, accesos: b.accesos, prueba } };
  } catch (e) {
    // U1: el gimnasio queda creado y se dice qué falta y qué hacer; "Terminar alta" está en su ficha y en la lista.
    return { ok: { ...creado, pendiente: true, aviso: `El alta quedó a medias: ${nombre} está creado, pero el dueño todavía no tiene acceso. ${(e as Error).message} Cuando lo arregles, entrá a la ficha y usá “Terminar alta: dar acceso al dueño” (o repetí este alta con la misma dirección: no crea otro gimnasio).` } };
  }
}

/** Un alta cortada: el gimnasio de esa dirección existe y su dueño todavía no tiene cuenta. Devuelve el gimnasio y la persona del equipo a la que falta darle acceso. */
async function altaPendiente(slug: string): Promise<{ gimnasio_id: string; equipo_id: string } | null> {
  try {
    const lista = await rpc<{ gimnasio_id: string; slug: string; duenos_sin_cuenta: number }[]>("admin_gimnasios");
    const g = lista.find((x) => x.slug === slug && x.duenos_sin_cuenta > 0);
    if (!g) return null;
    const d = await rpc<{ equipo: { equipo_id: string; rol: string; activo: boolean; es_soporte: boolean; tiene_cuenta: boolean }[] }>("admin_gimnasio", { p_gimnasio_id: g.gimnasio_id });
    const e = d.equipo.find((p) => p.rol === "dueno" && p.activo && !p.es_soporte && !p.tiene_cuenta);
    return e ? { gimnasio_id: g.gimnasio_id, equipo_id: e.equipo_id } : null;
  } catch { return null; }
}

export type Resultado = { error?: string; aviso?: string; email?: string; contrasena?: string; contrasenaNoAplicada?: boolean };

/** Alta de una persona en el equipo de un gimnasio, con acceso si se carga el mail. */
export async function agregarPersona(_: Resultado, f: FormData): Promise<Resultado> {
  const gimnasioId = String(f.get("gimnasio_id") ?? "");
  const nombre = String(f.get("nombre") ?? "").trim();
  const rol = String(f.get("rol") ?? "");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (email && !mailValido(email)) return { error: "El mail no es válido" };
  let equipoId: string;
  try {
    equipoId = await rpc<string>("admin_agregar_persona", { p_gimnasio_id: gimnasioId, p_nombre: nombre, p_rol: rol });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/admin/${gimnasioId}`);
  if (!email) return { aviso: `${nombre} quedó en el equipo, sin acceso al sistema.` };
  try {
    const { contrasena, contrasenaNoAplicada } = await darAcceso(equipoId, email, nombre, contrasenaElegida(f));
    return contrasena
      ? { email, contrasena, aviso: `Pasale a ${nombre} su mail y esta contraseña provisoria.` }
      : { email, contrasenaNoAplicada, aviso: contrasenaNoAplicada ? AVISO_NO_APLICADA : `${email} ya tenía cuenta: entra con su contraseña de siempre.` };
  } catch (e) {
    return { error: `${nombre} quedó en el equipo, pero sin acceso: ${(e as Error).message}` };
  }
}

/** Primer acceso para alguien del equipo que no tenía cuenta. Sirve igual desde el super admin y desde el panel del dueño. */
export async function darAccesoPersona(_: Resultado, f: FormData): Promise<Resultado> {
  const equipoId = String(f.get("equipo_id") ?? "");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!mailValido(email)) return { error: "Escribí un mail válido" };
  try {
    const p = await rpc<{ nombre: string }>("persona_para_dar_acceso", { p_equipo_id: equipoId });
    const { contrasena, contrasenaNoAplicada } = await darAcceso(equipoId, email, p.nombre, contrasenaElegida(f));
    revalidatePath("/admin", "layout");
    revalidatePath("/panel/equipo");
    return contrasena
      ? { email, contrasena, aviso: `Pasale a ${p.nombre} su mail y esta contraseña provisoria.` }
      : { email, contrasenaNoAplicada, aviso: contrasenaNoAplicada ? AVISO_NO_APLICADA : `${email} ya tenía cuenta: ${p.nombre} entra con su contraseña de siempre.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Contraseña provisoria nueva para alguien que se la olvidó. */
export async function nuevaClavePersona(_: Resultado, f: FormData): Promise<Resultado> {
  const equipoId = String(f.get("equipo_id") ?? "");
  try {
    const c = await rpc<{ usuario_id: string; email: string | null; nombre: string }>("cuenta_para_nueva_clave", { p_equipo_id: equipoId });
    const contrasena = await nuevaContrasena(c.usuario_id, contrasenaElegida(f));
    return { email: c.email ?? undefined, contrasena, aviso: `Contraseña nueva para ${c.nombre}. La anterior ya no sirve.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function agregarDominio(_: Resultado, f: FormData): Promise<Resultado> {
  const gimnasioId = String(f.get("gimnasio_id") ?? "");
  const host = String(f.get("host") ?? "");
  try {
    await rpc("admin_agregar_dominio", { p_gimnasio_id: gimnasioId, p_host: host });
    revalidatePath(`/admin/${gimnasioId}`);
    return { aviso: "Dirección agregada. Sumala también en Vercel → Settings → Domains para que abra." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function quitarDominio(gimnasioId: string, dominioId: string): Promise<{ error?: string }> {
  try {
    await rpc("admin_quitar_dominio", { p_dominio_id: dominioId });
    revalidatePath(`/admin/${gimnasioId}`);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** ADM-6: una novedad para todos los dueños (la ven en Inicio hasta cerrarla). */
export async function publicarNovedadPlataforma(titulo: string, texto: string, link: string): Promise<{ error?: string }> {
  try { await rpc("admin_publicar_novedad", { p_titulo: titulo, p_texto: texto, p_link: link || null }); revalidatePath("/admin"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
export async function retirarNovedadPlataforma(id: string): Promise<{ error?: string }> {
  try { await rpc("admin_retirar_novedad", { p_id: id }); revalidatePath("/admin"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

// ── ADM-3 (D13): el abono de cada gimnasio a BRIK. El precio lo carga Mateo. ──
const hechoAdmin = async (f: () => Promise<unknown>, rutas: string[]) => {
  try { await f(); for (const r of rutas) revalidatePath(r); return {}; } catch (e) { return { error: (e as Error).message }; }
};
export const guardarPlanBrik = async (id: string | null, nombre: string, precio: number, activo = true) =>
  hechoAdmin(() => rpc("admin_guardar_plan_brik", { p_id: id, p_nombre: nombre, p_precio: precio, p_activo: activo }), ["/admin"]);
export const asignarPlanBrik = async (gimnasioId: string, planId: string | null) =>
  hechoAdmin(() => rpc("admin_asignar_plan_brik", { p_gimnasio_id: gimnasioId, p_plan_id: planId }), ["/admin", `/admin/${gimnasioId}`]);
export const registrarPagoBrik = async (gimnasioId: string, monto: number, cubreHasta: string, nota: string) =>
  hechoAdmin(() => rpc("admin_registrar_pago_brik", { p_gimnasio_id: gimnasioId, p_monto: monto, p_cubre_hasta: cubreHasta, p_nota: nota || null }), ["/admin", `/admin/${gimnasioId}`]);
export const anularPagoBrik = async (gimnasioId: string, pagoId: string) =>
  hechoAdmin(() => rpc("admin_anular_pago_brik", { p_pago_id: pagoId }), ["/admin", `/admin/${gimnasioId}`]);

// ── VD-40: ayuda del dueño y notas internas ──
export const resolverAyuda = async (id: string) => hechoAdmin(() => rpc("admin_resolver_ayuda", { p_id: id }), ["/admin"]);
export const agregarNotaBrik = async (gimnasioId: string, texto: string) =>
  hechoAdmin(() => rpc("admin_agregar_nota", { p_gimnasio_id: gimnasioId, p_texto: texto }), [`/admin/${gimnasioId}`]);

// ── Carril B (F2): ficha, favoritos y búsqueda. Todo pasa por funciones admin_* (la base valida y deja registro). ──
export const cambiarDueno = async (gimnasioId: string, equipoId: string) =>
  hechoAdmin(() => rpc("admin_cambiar_dueno", { p_gimnasio_id: gimnasioId, p_equipo_id: equipoId }), [`/admin/${gimnasioId}`, "/admin/gimnasios"]);
export const guardarModulos = async (gimnasioId: string, apagadas: string[]) =>
  hechoAdmin(() => rpc("admin_guardar_modulos", { p_gimnasio_id: gimnasioId, p_apagadas: apagadas }), [`/admin/${gimnasioId}`]);
/** F9.2: prende o apaga una función nueva en un gimnasio (arrancan apagadas; solo BRIK principal). */
export const guardarFuncion = async (gimnasioId: string, clave: string, activa: boolean) =>
  hechoAdmin(() => rpc("admin_funcion_gimnasio", { p_gimnasio_id: gimnasioId, p_clave: clave, p_activa: activa }), [`/admin/${gimnasioId}`]);
export const cambiarSlug = async (gimnasioId: string, slug: string) =>
  hechoAdmin(() => rpc("admin_cambiar_slug", { p_gimnasio_id: gimnasioId, p_slug: slug }), [`/admin/${gimnasioId}`, "/admin", "/admin/gimnasios"]);
export const marcarFavorito = async (gimnasioId: string, favorito: boolean) =>
  hechoAdmin(() => rpc("admin_marcar_favorito", { p_gimnasio_id: gimnasioId, p_favorito: favorito }), ["/admin/gimnasios"]);

export const guardarCiudad = async (gimnasioId: string, ciudad: string) =>
  hechoAdmin(() => rpc("admin_guardar_ciudad", { p_gimnasio_id: gimnasioId, p_ciudad: ciudad }), [`/admin/${gimnasioId}`, "/admin/gimnasios"]);
export const pausarGimnasio = async (gimnasioId: string, motivo: string) =>
  hechoAdmin(() => rpc("admin_pausar_gimnasio", { p_gimnasio_id: gimnasioId, p_motivo: motivo }), [`/admin/${gimnasioId}`, "/admin/gimnasios", "/admin"]);
export const reanudarGimnasio = async (gimnasioId: string) =>
  hechoAdmin(() => rpc("admin_reanudar_gimnasio", { p_gimnasio_id: gimnasioId }), [`/admin/${gimnasioId}`, "/admin/gimnasios", "/admin"]);
export const darDeBajaGimnasio = async (gimnasioId: string, motivo: string) =>
  hechoAdmin(() => rpc("admin_dar_de_baja", { p_gimnasio_id: gimnasioId, p_motivo: motivo }), [`/admin/${gimnasioId}`, "/admin/gimnasios", "/admin"]);
export const restaurarBaja = async (gimnasioId: string) =>
  hechoAdmin(() => rpc("admin_restaurar_baja", { p_gimnasio_id: gimnasioId }), [`/admin/${gimnasioId}`, "/admin/gimnasios", "/admin"]);
export const borrarSocio = async (gimnasioId: string, socioId: string, motivo: string) =>
  hechoAdmin(() => rpc("admin_borrar_socio", { p_gimnasio_id: gimnasioId, p_socio_id: socioId, p_motivo: motivo }), []);
export const exigir2fa = async (exigir: boolean) => hechoAdmin(() => rpc("admin_exigir_2fa", { p_exigir: exigir }), ["/admin/seguridad"]);
export const darRolBrik = async (email: string, rol: string) => hechoAdmin(() => rpc("admin_dar_rol_brik", { p_email: email, p_rol: rol }), ["/admin/seguridad"]);
export const quitarRolBrik = async (usuarioId: string) => hechoAdmin(() => rpc("admin_quitar_rol_brik", { p_usuario_id: usuarioId }), ["/admin/seguridad"]);
export async function crearDemo(interesado: string, tipo: string): Promise<{ error?: string; aviso?: string; gimnasioId?: string }> {
  try {
    const r = await rpc<{ gimnasio_id: string; host: string }>("admin_crear_demo", { p_interesado: interesado, p_tipo: tipo || null, p_dominio_base: dominioBase() });
    revalidatePath("/admin");
    return { aviso: `Demo lista en ${r.host}. Vence en 7 días.`, gimnasioId: r.gimnasio_id };
  } catch (e) { return { error: (e as Error).message }; }
}
export const borrarDemosVencidas = async () => hechoAdmin(() => rpc("admin_borrar_demos_vencidas"), ["/admin"]);

// ── Carril B (F2, tercera tanda): comunicación, abonos, plataforma, papelera, clonar y borrado ──
export async function publicarNovedadPara(titulo: string, texto: string, link: string, plan: string, ciudad: string, modulo: string): Promise<{ error?: string }> {
  try {
    await rpc("admin_publicar_novedad", { p_titulo: titulo, p_texto: texto, p_link: link || null, p_plan: plan || null, p_ciudad: ciudad || null, p_modulo: modulo || null });
    revalidatePath("/admin"); return {};
  } catch (e) { return { error: (e as Error).message }; }
}
export const programarMantenimiento = async (desde: string, hasta: string, texto: string) =>
  hechoAdmin(async () => { await rpc("admin_programar_mantenimiento", { p_desde: desde, p_hasta: hasta, p_texto: texto }); revalidateTag("mantenimiento", { expire: 0 }); }, ["/admin"]);
export const cancelarMantenimiento = async (id: string) => hechoAdmin(async () => { await rpc("admin_cancelar_mantenimiento", { p_id: id }); revalidateTag("mantenimiento", { expire: 0 }); }, ["/admin"]);
export const guardarPrueba = async (gimnasioId: string, dias: number) =>
  hechoAdmin(() => rpc("admin_guardar_prueba", { p_gimnasio_id: gimnasioId, p_dias: dias }), [`/admin/${gimnasioId}`, "/admin"]);
export const guardarDescuento = async (gimnasioId: string, porcentaje: number, motivo: string, hasta: string) =>
  hechoAdmin(() => rpc("admin_guardar_descuento", { p_gimnasio_id: gimnasioId, p_porcentaje: porcentaje, p_motivo: motivo, p_hasta: hasta }), [`/admin/${gimnasioId}`]);
export const quitarDescuento = async (gimnasioId: string) => hechoAdmin(() => rpc("admin_quitar_descuento", { p_gimnasio_id: gimnasioId }), [`/admin/${gimnasioId}`]);
export const guardarLinkPago = async (link: string) => hechoAdmin(() => rpc("admin_guardar_link_pago", { p_link: link }), ["/admin"]);
export const prenderFuncion = async (gimnasioId: string, clave: string, prendida: boolean) =>
  hechoAdmin(() => rpc("admin_prender_funcion", { p_gimnasio_id: gimnasioId, p_clave: clave, p_prendida: prendida }), ["/admin"]);
export const restaurarSocio = async (gimnasioId: string, socioId: string) =>
  hechoAdmin(() => rpc("admin_restaurar_socio", { p_gimnasio_id: gimnasioId, p_socio_id: socioId }), [`/admin/${gimnasioId}`]);
export const restaurarPlan = async (gimnasioId: string, planId: string) =>
  hechoAdmin(() => rpc("admin_restaurar_plan", { p_gimnasio_id: gimnasioId, p_plan_id: planId }), [`/admin/${gimnasioId}`]);
export async function clonarConfiguracion(origen: string, destino: string): Promise<{ error?: string; aviso?: string }> {
  try {
    const r = await rpc<{ planes: number; actividades: number }>("admin_clonar_configuracion", { p_origen: origen, p_destino: destino });
    revalidatePath(`/admin/${destino}`); return { aviso: `Copiados ${r.planes} planes y ${r.actividades} actividades (sin socios).` };
  } catch (e) { return { error: (e as Error).message }; }
}
export const borrarDefinitivo = async (gimnasioId: string, nombre: string) =>
  hechoAdmin(() => rpc("admin_borrar_definitivo", { p_gimnasio_id: gimnasioId, p_nombre: nombre }), [`/admin/${gimnasioId}`, "/admin", "/admin/gimnasios"]);

/**
 * Reprocesar un aviso de MercadoPago que falló, a pedido y con la misma lógica idempotente del webhook (por pago y estado).
 * La base valida quién es (admin_evento_webhook); la ruta del webhook no se toca. Si el pago ya estaba procesado, no se duplica.
 */
export async function reprocesarWebhook(eventoId: string, gimnasioId: string): Promise<{ error?: string; aviso?: string }> {
  try {
    const ev = await rpc<{ evento_id: string; gimnasio_id: string; id_externo: string; payload: unknown }>("admin_evento_webhook", { p_id: eventoId });
    const pagoId = ev.id_externo.split(":")[0];
    const db = clienteServicio();
    const { data: cred, error } = await db.rpc("credenciales_mp", { p_gimnasio_id: ev.gimnasio_id });
    const c = cred as { token: string } | null;
    if (error || !c?.token) return { error: error?.message ?? "Ese gimnasio ya no tiene MercadoPago conectado" };
    const pago = await leerPago(c.token, pagoId);
    const r = await procesarPagoMP(db, ev.gimnasio_id, pago, { reprocesado: true, evento: ev.evento_id });
    await db.rpc("cerrar_evento_webhook", { p_evento_id: ev.evento_id, p_error: null });
    revalidatePath(`/admin/${gimnasioId}`);
    return { aviso: r.ya ? "Ese pago ya estaba acreditado: no se duplicó." : `Reprocesado: ${r.resultado}.` };
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Fase P (P6 y P7): probar el acceso de cada persona y gestionarla ──
export async function probarAccesoPersona(equipoId: string): Promise<{ error?: string; prueba?: PruebaPersona }> {
  try { return { prueba: await rpc<PruebaPersona>("admin_probar_acceso", { p_equipo_id: equipoId }) }; }
  catch (e) { return { error: (e as Error).message }; }
}
/** El botón "Arreglar" de cada paso rojo: confirmar la cuenta, activar a la persona o reanudar el gimnasio. Dar acceso se hace desde su fila. */
export async function arreglarAcceso(equipoId: string, gimnasioId: string, arreglo: string): Promise<{ error?: string }> {
  const rutas = [`/admin/${gimnasioId}`, "/admin/gimnasios"];
  if (arreglo === "confirmar") return hechoAdmin(() => rpc("admin_confirmar_cuenta", { p_equipo_id: equipoId }), rutas);
  if (arreglo === "activar") return hechoAdmin(() => rpc("admin_estado_persona", { p_equipo_id: equipoId, p_activo: true }), rutas);
  if (arreglo === "reanudar") {
    return hechoAdmin(async () => {
      try { await rpc("admin_reanudar_gimnasio", { p_gimnasio_id: gimnasioId }); }
      catch { await rpc("admin_restaurar_baja", { p_gimnasio_id: gimnasioId }); }
    }, rutas);
  }
  return { error: "Eso se arregla dándole acceso: usá “Dar acceso” en su fila." };
}
export const estadoPersona = async (equipoId: string, gimnasioId: string, activo: boolean) =>
  hechoAdmin(() => rpc("admin_estado_persona", { p_equipo_id: equipoId, p_activo: activo }), [`/admin/${gimnasioId}`]);
export const cambiarRolPersona = async (equipoId: string, gimnasioId: string, rol: string) =>
  hechoAdmin(() => rpc("admin_cambiar_rol_persona", { p_equipo_id: equipoId, p_rol: rol }), [`/admin/${gimnasioId}`]);
export const moverPersona = async (equipoId: string, gimnasioId: string, destino: string, rol: string) =>
  hechoAdmin(() => rpc("admin_mover_persona", { p_equipo_id: equipoId, p_gimnasio_destino: destino, p_rol: rol || null }), [`/admin/${gimnasioId}`, `/admin/${destino}`, "/admin/gimnasios"]);

// ── F9.6 (ESC-08): límites por plan, en datos ──
export const guardarLimitesPlan = async (planId: string, maxSocios: number | null, maxSedes: number | null) =>
  hechoAdmin(() => rpc("admin_guardar_limites_plan", { p_plan_id: planId, p_max_socios: maxSocios, p_max_sedes: maxSedes }), ["/admin"]);

/** VD-26B: si el plan se muestra en la web de Base. */
export const guardarPlanPublico = async (planId: string, publico: boolean) => {
  const r = await hechoAdmin(() => rpc("admin_plan_publico", { p_plan_id: planId, p_publico: publico }), ["/admin"]);
  if (!r.error) { revalidatePath("/"); }
  return r;
};

// ── F9.1 (EDIT-S07): plantillas de textos en capas (plataforma → tipo → gimnasio) ──
export type TextoPlantilla = {
  clave: string; etiqueta: string; grupo: string; max: number; fabrica: string; plataforma: string | null;
  por_tipo: Record<string, string>; gimnasios_por_tipo: Record<string, number>;
};
async function conteo(f: () => Promise<number>, rutas: string[]): Promise<{ error?: string; gimnasios?: number }> {
  try { const n = await f(); for (const r of rutas) revalidatePath(r); return { gimnasios: n }; } catch (e) { return { error: (e as Error).message }; }
}
export const guardarPlantillaTexto = async (clave: string, tipo: string | null, valor: string) =>
  conteo(() => rpc<number>("admin_guardar_plantilla_texto", { p_clave: clave, p_tipo: tipo, p_valor: valor }), ["/admin/plantillas"]);
export const restaurarPlantillaTexto = async (clave: string, tipo: string | null) =>
  conteo(() => rpc<number>("admin_restaurar_plantilla_texto", { p_clave: clave, p_tipo: tipo }), ["/admin/plantillas"]);
export async function restaurarTextoGimnasio(gimnasioId: string, clave: string): Promise<{ error?: string; valor?: string }> {
  try { const valor = await rpc<string>("admin_restaurar_texto_gimnasio", { p_gimnasio_id: gimnasioId, p_clave: clave }); revalidatePath(`/admin/${gimnasioId}`); return { valor }; }
  catch (e) { return { error: (e as Error).message }; }
}

// ── P9 (PLAT-05): dominios desde el super admin, por la API de Vercel ──
// (pendiente) en producción hasta que Mateo cargue VERCEL_TOKEN y VERCEL_PROJECT_ID (y compre el dominio). Solo el usuario principal de BRIK.
const hablarConVercel: VercelFetch = async (url, init) => {
  const r = await fetch(url, { ...init, cache: "no-store" });
  return { status: r.status, json: () => r.json() };
};
async function soloPrincipal() {
  const s = await rpc<{ mi_rol: string }>("admin_estado_seguridad");
  if (s.mi_rol !== "principal") throw new Error("Solo el usuario principal de BRIK conecta dominios.");
}
export async function vercelListo(): Promise<{ lista: boolean; faltan?: string[] }> {
  const c = configuracionVercel(process.env);
  return c.lista ? { lista: true } : { lista: false, faltan: c.faltan };
}
async function operarDominio(accion: "agregar" | "verificar", dominio: string): Promise<{ error?: string; estado?: EstadoDominio }> {
  try {
    await soloPrincipal();
    const c = configuracionVercel(process.env);
    if (!c.lista) return { error: `Todavía no se puede: falta cargar ${c.faltan.join(" y ")} en Vercel (Settings → Environment Variables) y redeployar. Los pasos están arriba de docs/base/PROGRESO.md.` };
    const estado = accion === "agregar" ? await agregarDominioVercel(hablarConVercel, c.config, dominio) : await verificarDominioVercel(hablarConVercel, c.config, dominio);
    await rpc("admin_anotar_registro", { p_accion: accion === "agregar" ? "agregar_dominio_vercel" : "verificar_dominio_vercel", p_gimnasio_id: null, p_detalle: { dominio: estado.dominio, estado: estado.estado } });
    return { estado };
  } catch (e) { return { error: (e as Error).message }; }
}
export const conectarDominioVercel = async (dominio: string) => operarDominio("agregar", dominio);
export const verificarDominioEnVercel = async (dominio: string) => operarDominio("verificar", dominio);

export type PersonaEncontrada = { tipo: "socio" | "equipo"; rol: string; nombre: string; gimnasio_id: string; gimnasio: string; slug: string; baja: boolean; persona_id?: string };
/** SA-5: busca por mail, DNI o teléfono en todos los gimnasios. Pide motivo y queda registrado; devuelve nombre, gimnasio y rol. */
export async function buscarPersona(q: string, motivo: string): Promise<{ error?: string; personas?: PersonaEncontrada[] }> {
  try { return { personas: await rpc<PersonaEncontrada[]>("admin_buscar_persona", { p_q: q, p_motivo: motivo }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

// ── F2.8: equipos desde los que entran los usuarios de BRIK ──
/** Anota el equipo (por su navegador) y dice si es uno nuevo para esta cuenta. Nunca frena: si falla, no hay aviso. */
export async function registrarEquipoBrik(): Promise<{ nuevo: boolean }> {
  try { const r = await rpc<{ nuevo: boolean }>("admin_registrar_equipo"); return { nuevo: !!r.nuevo }; }
  catch (e) { console.error("admin_registrar_equipo:", (e as Error).message); return { nuevo: false }; }
}

// ── VD-26: pedidos de demo que llegan desde la página de Gym OS ──
export const atenderDemo = async (id: string) => hechoAdmin(() => rpc("admin_atender_demo", { p_id: id }), ["/admin"]);

// ── VD-62: el WhatsApp de la página de Gym OS ("Pedí una demo") ──
export async function guardarContactoPlataforma(whatsapp: string, mensaje: string): Promise<{ error?: string; contacto?: { whatsapp: string | null; mensaje_demo: string } }> {
  try {
    const contacto = await rpc<{ whatsapp: string | null; mensaje_demo: string }>("admin_guardar_contacto_plataforma", { p_whatsapp: whatsapp, p_mensaje: mensaje });
    revalidatePath("/admin"); revalidatePath("/");
    return { contacto };
  } catch (e) { return { error: (e as Error).message }; }
}
