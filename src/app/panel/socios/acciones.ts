"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import { conflictoDe } from "@/lib/panel/version";

export type EstadoForm = {
  error?: string; destino?: string; valores?: Record<string, string>; version?: string;
  /** VD-6: el alta salió bien: el socio, si hay que cobrar ahora y si el plan no se pudo asignar. */
  socioId?: string; cobrar?: boolean; sinPlan?: boolean; nombre?: string;
};

const CAMPOS = ["nombre", "apellido", "dni", "telefono", "email", "fecha_nacimiento", "contacto_emergencia_nombre", "contacto_emergencia_telefono", "notas", "responsable_nombre", "responsable_telefono"] as const;

export async function guardarSocio(socioId: string | null, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const panel = await contextoPanel();
  const datos = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "").trim()]));
  // Los teléfonos van como los escribió (387 15 555-1234, 011…): los normaliza la base.
  const prospecto = socioId ? "" : String(form.get("prospecto") ?? "");
  // Alta en un paso (SOC-13): el plan y, si se eligió, ir directo a cobrar.
  const plan = socioId ? "" : String(form.get("plan_id") ?? "");
  const cobrar = !!plan && form.get("despues") === "cobrar";
  let id: string;
  // VD-34: si otra persona tocó la ficha desde que se abrió, se avisa en vez de pisarla.
  if (socioId) {
    const c = await conflictoDe(panel.gimnasio.id, "socios", socioId, String(form.get("version") ?? ""));
    if (c) return { error: c.error, version: c.version, valores: datos };
  }
  try {
    id = await rpc<string>("guardar_socio", { p_gimnasio_id: panel.gimnasio.id, p_socio_id: socioId, p_datos: datos });
    if (prospecto) {
      await rpc("prospecto_es_socio", { p_gimnasio_id: panel.gimnasio.id, p_prospecto_id: prospecto, p_socio_id: id });
      revalidatePath("/panel/prospectos");
    }
    revalidatePath("/panel/socios");
  } catch (e) {
    return { error: (e as Error).message, valores: datos };
  }
  // Desde un prospecto se va directo a la ficha desde el servidor: la página del alta
  // ya no sirve (el prospecto pasó a socio) y volver a dibujarla daría error.
  // El socio ya quedó dado de alta: si el plan no se pudo asignar, se sigue en la ficha (ahí se asigna).
  let conPlan = false;
  if (plan) {
    try { await rpc("asignar_plan", { p_socio_id: id, p_plan_id: plan }); conPlan = true; revalidatePath(`/panel/socios/${id}`); }
    catch { conPlan = false; }
  }
  // VD-5b/VD-6: con cobro, la pantalla abre la hoja Cobrar en el lugar (el destino a Vender queda de respaldo,
  // si la hoja no está montada). Desde un prospecto se vuelve al alta con el socio ya creado ("listo").
  const destino = cobrar && conPlan ? `/panel/vender?socio=${id}&cuota=1` : `/panel/socios/${id}${plan && !conPlan ? "?sin_plan=1" : ""}`;
  if (prospecto) redirect(cobrar && conPlan ? `/panel/socios/nuevo?listo=${id}&cobrar=1` : destino);
  return { destino, socioId: id, cobrar: cobrar && conPlan, sinPlan: !!plan && !conPlan, nombre: `${datos.nombre} ${datos.apellido}`.trim() };
}

export type PlanParaAlta = {
  plan_id: string; nombre: string; descripcion: string | null; duracion_meses: number | null;
  renovacion: "continua" | "desde_pago" | "dia_fijo" | null; dia_fijo: number | null;
  lista: number | null; efectivo: number | null; matricula: number | null; total_lista: number | null; total_efectivo: number | null;
};

/** Las membresías con su primer pago, calculado por la base (cuota + matrícula). */
export async function planesParaAlta(sedeId: string): Promise<{ planes?: PlanParaAlta[]; error?: string }> {
  try {
    const panel = await contextoPanel();
    const { sede } = sedeActiva(panel, sedeId);
    return { planes: await rpc<PlanParaAlta[]>("planes_para_alta", { p_sede_id: sede.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export type ProspectoOfrecido = { id: string; nombre: string; creado_en: string };

/** El Interesado con ese celular, para ofrecerlo en el alta. Un celular a medio escribir no coincide con nadie. */
export async function prospectoPorTelefono(telefono: string): Promise<{ prospecto?: ProspectoOfrecido | null; error?: string }> {
  try {
    const panel = await contextoPanel();
    if (telefono.replace(/\D/g, "").length < 8) return { prospecto: null };
    return { prospecto: await rpc<ProspectoOfrecido | null>("prospecto_por_telefono", { p_gimnasio_id: panel.gimnasio.id, p_telefono: telefono }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/**
 * VD-6 · Alta rápida desde la Entrada: crea al socio (y le asigna el plan) sin salir de la ventana.
 * Si algo falla devuelve el error y no borra nada de lo escrito; si el socio ya quedó creado y solo el plan
 * falló, lo dice (`sinPlan`) para seguir desde la ficha.
 */
export async function altaRapida(datos: { nombre: string; apellido?: string; dni?: string; telefono?: string }, planId: string | null, prospectoId?: string | null)
  : Promise<{ socioId?: string; numero?: number | null; sinPlan?: boolean; error?: string }> {
  try {
    const panel = await contextoPanel();
    const limpio = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, String(v ?? "").trim()]));
    if (!limpio.nombre) return { error: "Escribí el nombre." };
    const id = await rpc<string>("guardar_socio", { p_gimnasio_id: panel.gimnasio.id, p_socio_id: null, p_datos: limpio });
    if (prospectoId) {
      try { await rpc("prospecto_es_socio", { p_gimnasio_id: panel.gimnasio.id, p_prospecto_id: prospectoId, p_socio_id: id }); } catch { /* ya quedó socio; el Interesado se marca después */ }
    }
    let sinPlan = false;
    if (planId) {
      try { await rpc("asignar_plan", { p_socio_id: id, p_plan_id: planId }); } catch { sinPlan = true; }
    }
    let numero: number | null = null;
    try { numero = (await rpc<{ socio: { numero: number } }>("ficha_socio", { p_socio_id: id })).socio.numero; } catch { /* sin número en pantalla */ }
    revalidatePath("/panel/socios");
    if (prospectoId) revalidatePath("/panel/prospectos");
    return { socioId: id, numero, sinPlan };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function asignarPlan(socioId: string, planId: string, cambiar: boolean): Promise<{ error?: string }> {
  try {
    await rpc(cambiar ? "cambiar_plan" : "asignar_plan", { p_socio_id: socioId, p_plan_id: planId });
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export type VistaCambio = { plan_viejo: string | null; plan_nuevo: string; precio_viejo: number | null; precio_nuevo: number | null;
  hasta: string | null; dias_a_favor: number; congelado: boolean };

/** Qué pasa si se cambia de plan, antes de confirmarlo (PLA-6). */
export async function vistaCambioPlan(socioId: string, planId: string): Promise<{ error?: string; vista?: VistaCambio }> {
  try { return { vista: await rpc<VistaCambio>("vista_cambio_plan", { p_socio_id: socioId, p_plan_id: planId }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function darDeBaja(socioId: string, motivo: string): Promise<{ error?: string }> {
  try {
    await rpc("dar_de_baja", { p_socio_id: socioId, p_motivo: motivo });
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** Un socio dado de baja que vuelve: se borra la baja (queda en el historial) y después se le asigna plan. */
export async function volverADarDeAlta(socioId: string): Promise<{ error?: string }> {
  try {
    await rpc("volver_a_dar_de_alta", { p_socio_id: socioId });
    revalidatePath(`/panel/socios/${socioId}`);
    revalidatePath("/panel/socios");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Notas y etiquetas (SOC-3) ───────────────────────────────────────
async function hacer(socioId: string, fn: () => Promise<unknown>): Promise<{ error?: string }> {
  try { await fn(); revalidatePath(`/panel/socios/${socioId}`); revalidatePath("/panel/socios"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
export async function agregarNota(socioId: string, texto: string) { return hacer(socioId, () => rpc("agregar_nota", { p_socio_id: socioId, p_texto: texto })); }
export async function borrarNota(socioId: string, notaId: string) { return hacer(socioId, () => rpc("borrar_nota", { p_nota_id: notaId })); }
export async function ponerEtiqueta(socioId: string, nombre: string) { return hacer(socioId, () => rpc("poner_etiqueta", { p_socio_id: socioId, p_nombre: nombre })); }
export async function sacarEtiqueta(socioId: string, etiquetaId: string) { return hacer(socioId, () => rpc("sacar_etiqueta", { p_socio_id: socioId, p_etiqueta_id: etiquetaId })); }

// ── Foto (SOC-7) ────────────────────────────────────────────────────
// La base arma la ruta y la confirma; el servidor sube con la clave de servicio
// (el bucket es privado y nadie sube con su sesión) y borra la foto anterior.
export async function guardarFoto(socioId: string, form: FormData): Promise<{ error?: string }> {
  const archivo = form.get("foto");
  if (!(archivo instanceof Blob) || archivo.size === 0) return { error: "No llegó la foto." };
  if (archivo.type !== "image/jpeg" || archivo.size > 512 * 1024) return { error: "La foto tiene que ser JPG de hasta 512 KB." };
  try {
    const ruta = await rpc<string>("preparar_foto_socio", { p_socio_id: socioId });
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const sb = clienteServicio().storage.from("fotos_socios");
    const { error } = await sb.upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: "image/jpeg", upsert: false });
    if (error) return { error: `No se pudo subir la foto: ${error.message}` };
    const anterior = await rpc<string | null>("confirmar_foto_socio", { p_socio_id: socioId, p_ruta: ruta });
    if (anterior) await sb.remove([anterior]);
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function quitarFoto(socioId: string): Promise<{ error?: string }> {
  try {
    const anterior = await rpc<string | null>("confirmar_foto_socio", { p_socio_id: socioId, p_ruta: null });
    if (anterior) {
      const { clienteServicio } = await import("@/lib/supabase/servicio");
      await clienteServicio().storage.from("fotos_socios").remove([anterior]);
    }
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Grupo familiar (SOC-5) ──────────────────────────────────────────
export async function vincularFamilia(socioId: string, otroId: string) { return hacer(socioId, async () => { await rpc("vincular_familia", { p_socio_id: socioId, p_otro_id: otroId }); revalidatePath(`/panel/socios/${otroId}`); }); }
export async function sacarDeFamilia(socioId: string, quienId: string) { return hacer(socioId, async () => { await rpc("sacar_de_familia", { p_socio_id: quienId }); revalidatePath(`/panel/socios/${quienId}`); }); }

// ── Pausas (SOC-9) ──────────────────────────────────────────────────
// El dueño o el encargado la dan; la recepción la pide. La base decide quién puede.
export async function darPausa(socioId: string, suscripcionId: string, desde: string, vuelve: string, motivo: string, nota: string) {
  return hacer(socioId, async () => { await rpc("congelar", { p_suscripcion_id: suscripcionId, p_desde: desde, p_hasta: vuelve, p_categoria: motivo, p_nota: nota || null }); revalidatePath("/panel"); });
}
export async function pedirPausa(socioId: string, suscripcionId: string, desde: string, vuelve: string, motivo: string, nota: string) {
  return hacer(socioId, async () => { await rpc("pedir_pausa", { p_suscripcion_id: suscripcionId, p_desde: desde, p_hasta: vuelve, p_categoria: motivo, p_nota: nota || null }); revalidatePath("/panel"); });
}
export async function resolverPedidoPausa(socioId: string, pedidoId: string, aprobar: boolean) {
  return hacer(socioId, async () => { await rpc("resolver_pedido_pausa", { p_pedido_id: pedidoId, p_aprobar: aprobar }); revalidatePath("/panel"); });
}
export async function volvioAntes(socioId: string, pausaId: string) { return hacer(socioId, () => rpc("descongelar", { p_congelamiento_id: pausaId })); }
export async function anularPausa(socioId: string, pausaId: string, motivo: string) { return hacer(socioId, () => rpc("anular_congelamiento", { p_congelamiento_id: pausaId, p_motivo: motivo })); }

// ── Apto físico (SOC-11) ────────────────────────────────────────────
export async function cargarApto(socioId: string, vence: string) { return hacer(socioId, () => rpc("cargar_apto", { p_socio_id: socioId, p_vence: vence })); }
export async function anularApto(socioId: string, aptoId: string) { return hacer(socioId, () => rpc("anular_apto", { p_apto_id: aptoId })); }

// ── Llavero (ENT-7) ─────────────────────────────────────────────────
export async function asignarLlavero(socioId: string, codigo: string) { return hacer(socioId, () => rpc("asignar_llavero", { p_socio_id: socioId, p_codigo: codigo })); }
export async function quitarLlavero(socioId: string) { return hacer(socioId, () => rpc("quitar_llavero", { p_socio_id: socioId })); }

/** VEN-3: asignar (reemplaza) o quitar el convenio del socio. Dueño y encargado. */
export async function asignarConvenio(socioId: string, convenioId: string, hasta: string): Promise<{ error?: string }> {
  try { await rpc("asignar_convenio", { p_socio_id: socioId, p_convenio_id: convenioId, p_hasta: hasta || null }); revalidatePath(`/panel/socios/${socioId}`); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
export async function quitarConvenio(socioId: string): Promise<{ error?: string }> {
  try { await rpc("quitar_convenio", { p_socio_id: socioId }); revalidatePath(`/panel/socios/${socioId}`); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** APP-8: el socio pidió la baja desde la app; se habló y se queda, o se le da la baja con su motivo. */
export async function resolverPedidoBaja(socioId: string, pedidoId: string, darDeBaja: boolean): Promise<{ error?: string }> {
  try {
    await rpc("resolver_pedido_baja", { p_pedido_id: pedidoId, p_dar_de_baja: darDeBaja });
    revalidatePath(`/panel/socios/${socioId}`); revalidatePath("/panel");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** SEG-6: borrar los datos personales de un ex socio (solo el dueño; quedan los pagos). */
export async function anonimizarSocio(socioId: string, confirmo: string): Promise<{ error?: string }> {
  try {
    await rpc("anonimizar_socio", { p_socio_id: socioId, p_confirmo: confirmo });
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
